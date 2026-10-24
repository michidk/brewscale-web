/**
 * BOOKOO wire format shared by both models. Mirrors the helpers in `brewscale-bookoo/src/lib.rs`.
 * Every packet is `[0x03, type, data.., xor]` where `xor` covers all preceding bytes.
 * Spec: https://github.com/BooKooCode/OpenSource
 */
import { DecodeError, EncodeError, type AutoBrewState, type Command, type ScaleEvent } from '../core/protocol.ts';

export const SERVICE = 0x0ffe;
export const WEIGHT_CHARACTERISTIC = 0xff11;
export const COMMAND_CHARACTERISTIC = 0xff12;

const PRODUCT = 0x03;
const PACKET_LEN = 20;
const TYPE_COMMAND = 0x0a;
export const TYPE_MEASUREMENT = 0x0b;
export const TYPE_AUTO_BREW = 0x0d;
export const TYPE_POWDER = 0x0f;
/** ASCII '-': the only sign byte value meaning negative. */
const MINUS = 0x2d;
const AUTO_BREW_STATES: readonly AutoBrewState[] = ['stopped', 'started', 'ready', 'exit-ready', 'exit-done'];
const hex = (n: number) => `0x${n.toString(16).padStart(2, '0')}`;

const xor = (bytes: Uint8Array) => bytes.reduce((a, b) => a ^ b, 0);
const u16 = (p: Uint8Array, i: number) => (p[i] << 8) | p[i + 1];
export const u24 = (p: Uint8Array, i: number) => (p[i] << 16) | (p[i + 1] << 8) | p[i + 2];
export const signed = (sign: number, magnitude: number) => (sign === MINUS ? -magnitude : magnitude);

/** Validates length, header and checksum. */
export function check(p: Uint8Array): void {
  if (p.length !== PACKET_LEN) throw new DecodeError('length', `unexpected packet length ${p.length}`);
  if (p[0] !== PRODUCT) throw new DecodeError('header', `unexpected header byte ${hex(p[0])}`);
  const expected = xor(p.subarray(0, PACKET_LEN - 1));
  if (expected !== p[PACKET_LEN - 1]) {
    throw new DecodeError('checksum', `bad checksum: expected ${hex(expected)}, got ${hex(p[PACKET_LEN - 1])}`);
  }
}

export const unknownType = (p: Uint8Array) => new DecodeError('unknown-type', `unknown packet type ${hex(p[1])}`);

export function decodeMeasurement(p: Uint8Array): ScaleEvent {
  const weightCg = signed(p[6], u24(p, 7));
  const flowCgPerS = signed(p[10], u16(p, 11));
  const standbyDeciMin = u16(p, 14);
  return {
    type: 'measurement',
    elapsedMs: u24(p, 2),
    unit: p[5] === 1 ? 'g' : p[5] === 2 ? 'oz' : { unknown: p[5] },
    weightCg,
    weight: weightCg / 100,
    flowCgPerS,
    flow: flowCgPerS / 100,
    battery: p[13],
    standbyDeciMin,
    standbyMinutes: standbyDeciMin / 10,
    beepLevel: p[16],
    flowSmoothing: p[17] !== 0,
  };
}

export function decodeAutoBrew(p: Uint8Array): ScaleEvent {
  const state = AUTO_BREW_STATES[p[2]];
  if (!state) throw unknownType(p);
  const weightCg = signed(p[6], u24(p, 7));
  const resultC = signed(p[10], u16(p, 11));
  return {
    type: 'auto-brew',
    state,
    elapsedMs: u24(p, 3),
    weightCg,
    weight: weightCg / 100,
    resultC,
    result: resultC / 100,
  };
}

export function frame(d1: number, d2 = 0, d3 = 0): Uint8Array {
  const f = new Uint8Array([PRODUCT, TYPE_COMMAND, d1, d2, d3, 0]);
  f[5] = xor(f.subarray(0, 5));
  return f;
}

const inRange = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** Commands both models accept. `maxBeep` differs per model. */
export function encodeCommon(command: Command, maxBeep: number): Uint8Array {
  switch (command.type) {
    case 'tare':
      return frame(0x01);
    case 'set-beep-level':
      if (!inRange(command.level, 0, maxBeep)) throw new EncodeError('out-of-range', command);
      return frame(0x02, 0, command.level);
    case 'set-auto-off':
      if (!inRange(command.minutes, 5, 30)) throw new EncodeError('out-of-range', command);
      return frame(0x03, 0, command.minutes);
    case 'start-timer':
      return frame(0x04);
    case 'stop-timer':
      return frame(0x05);
    case 'reset-timer':
      return frame(0x06);
    case 'tare-and-start-timer':
      return frame(0x07);
    case 'set-flow-smoothing':
      return frame(0x08, command.enabled ? 1 : 0);
    default:
      throw new EncodeError('unsupported', command);
  }
}

export const base = {
  service: SERVICE,
  notifyCharacteristic: WEIGHT_CHARACTERISTIC,
  commandCharacteristic: COMMAND_CHARACTERISTIC,
} as const;
