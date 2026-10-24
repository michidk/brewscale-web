/**
 * BOOKOO Themis Mini/Ultra drivers. Mirrors `brewscale-bookoo`.
 * Every packet is `[0x03, type, data.., xor]` where `xor` covers all preceding bytes.
 */
import {
  DecodeError,
  EncodeError,
  type Advertisement,
  type AutoBrewState,
  type Capabilities,
  type Command,
  type Driver,
  type Protocol,
  type ScaleEvent,
} from '../core/protocol.ts';

export const SERVICE = 0x0ffe;
export const WEIGHT_CHARACTERISTIC = 0xff11;
export const COMMAND_CHARACTERISTIC = 0xff12;

const PRODUCT = 0x03;
const PACKET_LEN = 20;
const TYPE_COMMAND = 0x0a;
const TYPE_MEASUREMENT = 0x0b;
const TYPE_AUTO_BREW = 0x0d;
const TYPE_POWDER = 0x0f;
/** ASCII '-': the only sign byte value meaning negative. */
const MINUS = 0x2d;
const AUTO_BREW_STATES: readonly AutoBrewState[] = ['stopped', 'started', 'ready', 'exit-ready', 'exit-done'];
const hex = (n: number) => `0x${n.toString(16).padStart(2, '0')}`;

const xor = (bytes: Uint8Array) => bytes.reduce((a, b) => a ^ b, 0);
const u16 = (p: Uint8Array, i: number) => (p[i] << 8) | p[i + 1];
const u24 = (p: Uint8Array, i: number) => (p[i] << 16) | (p[i + 1] << 8) | p[i + 2];
const signed = (sign: number, magnitude: number) => (sign === MINUS ? -magnitude : magnitude);

/** Validates length, header and checksum. */
function check(p: Uint8Array): void {
  if (p.length !== PACKET_LEN) throw new DecodeError('length', `unexpected packet length ${p.length}`);
  if (p[0] !== PRODUCT) throw new DecodeError('header', `unexpected header byte ${hex(p[0])}`);
  const expected = xor(p.subarray(0, PACKET_LEN - 1));
  if (expected !== p[PACKET_LEN - 1]) {
    throw new DecodeError('checksum', `bad checksum: expected ${hex(expected)}, got ${hex(p[PACKET_LEN - 1])}`);
  }
}

const unknownType = (p: Uint8Array) => new DecodeError('unknown-type', `unknown packet type ${hex(p[1])}`);

function decodeMeasurement(p: Uint8Array): ScaleEvent {
  return {
    type: 'measurement',
    elapsedMs: u24(p, 2),
    unit: p[5] === 1 ? 'g' : p[5] === 2 ? 'oz' : { unknown: p[5] },
    weight: signed(p[6], u24(p, 7)) / 100,
    flow: signed(p[10], u16(p, 11)) / 100,
    battery: p[13],
    standbyMinutes: u16(p, 14) / 10,
    beepLevel: p[16],
    flowSmoothing: p[17] !== 0,
  };
}

function decodeAutoBrew(p: Uint8Array): ScaleEvent {
  const state = AUTO_BREW_STATES[p[2]];
  if (!state) throw unknownType(p);
  return {
    type: 'auto-brew',
    state,
    elapsedMs: u24(p, 3),
    weight: signed(p[6], u24(p, 7)) / 100,
    result: signed(p[10], u16(p, 11)) / 100,
  };
}

function frame(d1: number, d2 = 0, d3 = 0): Uint8Array {
  const f = new Uint8Array([PRODUCT, TYPE_COMMAND, d1, d2, d3, 0]);
  f[5] = xor(f.subarray(0, 5));
  return f;
}

/** Commands both models accept. `maxBeep` differs per model. */
function encodeCommon(command: Command, maxBeep: number): Uint8Array {
  switch (command.type) {
    case 'tare': return frame(0x01);
    case 'set-beep-level':
      if (!Number.isInteger(command.level) || command.level < 0 || command.level > maxBeep) break;
      return frame(0x02, 0, command.level);
    case 'set-auto-off':
      if (!Number.isInteger(command.minutes) || command.minutes < 5 || command.minutes > 30) break;
      return frame(0x03, 0, command.minutes);
    case 'start-timer': return frame(0x04);
    case 'stop-timer': return frame(0x05);
    case 'reset-timer': return frame(0x06);
    case 'tare-and-start-timer': return frame(0x07);
    case 'set-flow-smoothing': return frame(0x08, command.enabled ? 1 : 0);
    default: throw new EncodeError('unsupported', command);
  }
  throw new EncodeError('out-of-range', command);
}

const base = { service: SERVICE, notifyCharacteristic: WEIGHT_CHARACTERISTIC, commandCharacteristic: COMMAND_CHARACTERISTIC };

export const mini: Protocol = {
  ...base,
  name: 'BOOKOO Themis Mini',
  capabilities: { timer: true, powderWeight: false, autoBrewEvents: false, shutdown: false, keepAwake: false, maxBeepLevel: 5 } satisfies Capabilities,
  decode(packet) {
    check(packet);
    if (packet[1] === TYPE_MEASUREMENT) return decodeMeasurement(packet);
    throw unknownType(packet);
  },
  encode: command => encodeCommon(command, 5),
};

/** Command availability also depends on firmware version, which this driver cannot know. */
export const ultra: Protocol = {
  ...base,
  name: 'BOOKOO Themis Ultra',
  capabilities: { timer: true, powderWeight: true, autoBrewEvents: true, shutdown: true, keepAwake: true, maxBeepLevel: 3 },
  decode(packet) {
    check(packet);
    switch (packet[1]) {
      case TYPE_MEASUREMENT: return decodeMeasurement(packet);
      case TYPE_POWDER: return { type: 'powder-weight', weight: signed(packet[2], u24(packet, 3)) / 100 };
      case TYPE_AUTO_BREW: return decodeAutoBrew(packet);
      default: throw unknownType(packet);
    }
  },
  encode(command) {
    switch (command.type) {
      case 'set-powder-weight': {
        const deciGrams = Math.round(command.grams * 10);
        if (!(deciGrams >= 1 && deciGrams <= 9999)) throw new EncodeError('out-of-range', command);
        return frame(0x0d, deciGrams >> 8, deciGrams & 0xff);
      }
      case 'shutdown': return frame(0x15);
      case 'keep-awake': return frame(0x25);
      default: return encodeCommon(command, 3);
    }
  },
};

/**
 * Identifies the model from the advertised name: `BOOKOO_SC xxxx` (Mini) or `BOOKOO_SC U xxxx` (Ultra).
 * Matches from `OOKOO_SC` because Mini firmware 1.4.1 reportedly drops the leading `B`
 * (decentespresso/decaid#972), and falls back to Mini, the safe command subset, on a service match.
 */
export function identify({ name = '', services }: Advertisement): Protocol | undefined {
  const i = name.indexOf('OOKOO_SC');
  if (i >= 0) return /^ U( |$)/.test(name.slice(i + 8)) ? ultra : mini;
  return services.includes(SERVICE) ? mini : undefined;
}

export const driver: Driver = {
  filters: [{ services: [SERVICE] }, { namePrefix: 'BOOKOO_SC' }, { namePrefix: 'OOKOO_SC' }],
  services: [SERVICE],
  detect: identify,
};
