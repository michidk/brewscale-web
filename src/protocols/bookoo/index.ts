import type { AutoBrewEvent, Command, ScaleEvent, ScaleProtocol } from '../../core/protocol.js';

const service = 0x0ffe; const notify = 0xff11; const command = 0xff12;
const u24 = (p: Uint8Array, i: number) => p[i] * 65536 + p[i + 1] * 256 + p[i + 2];
const signed = (sign: number, value: number) => sign === 0x2d ? -value : value;
const frame = (code: number, a = 0, b = 0) => { const result = new Uint8Array([3, 0x0a, code, a, b, 0]); result[5] = result.slice(0, 5).reduce((x, y) => x ^ y, 0); return result; };

export const bookoo: ScaleProtocol = {
  id: 'bookoo', name: 'BOOKOO Themis', services: [service], notificationCharacteristic: notify, commandCharacteristic: command,
  capabilities: { timer: true, powderWeight: true, autoBrewEvents: true, keepAwake: true, shutdown: true },
  filters: [{ services: [service] }, { namePrefix: 'BOOKOO_SC' }, { namePrefix: 'OOKOO_SC' }],
  encode(commandName: Command) { const codes: Partial<Record<Command, number>> = { tare: 1, 'start-timer': 4, 'stop-timer': 5, 'reset-timer': 6, 'tare-and-start': 7, 'keep-awake': 0x25, shutdown: 0x15 }; const code = codes[commandName]; if (code === undefined) throw new Error(`Unsupported command: ${commandName}`); return frame(code); },
  decode(data: DataView): ScaleEvent | null {
    if (data.byteLength !== 20) throw new Error('BOOKOO packet expected 20 bytes.');
    const p = new Uint8Array(data.buffer, data.byteOffset, data.byteLength); if (p[0] !== 3) throw new Error('Invalid BOOKOO packet header.'); if (p.slice(0, 19).reduce((a, b) => a ^ b, 0) !== p[19]) throw new Error('Invalid BOOKOO checksum.');
    if (p[1] === 0x0f) return { kind: 'powder-weight', weight: signed(p[2], u24(p, 3)) / 100 };
    if (p[1] === 0x0d) return { kind: 'auto-brew', state: ['stopped', 'started', 'ready', 'exit-ready', 'done'][p[2]] as AutoBrewEvent['state'] ?? 'unknown', elapsedMs: u24(p, 3), weight: signed(p[6], u24(p, 7)) / 100, result: signed(p[10], data.getUint16(11)) / 100 };
    if (p[1] !== 0x0b) return null;
    return { kind: 'measurement', weight: signed(p[6], u24(p, 7)) / 100, flow: signed(p[10], data.getUint16(11)) / 100, elapsedMs: u24(p, 2), battery: p[13], unit: p[5] === 1 ? 'g' : p[5] === 2 ? 'oz' : `unknown:${p[5]}` };
  },
};
