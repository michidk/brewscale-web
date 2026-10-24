// Browser-side equivalent of brewscale-core's Protocol trait.
export const bookoo = {
  id: 'bookoo',
  name: 'BOOKOO Themis',
  service: 0x0ffe,
  notificationCharacteristic: 0xff11,
  commandCharacteristic: 0xff12,
  matches(device) {
    return /BOOKOO_SC|OOKOO_SC/i.test(device.name || '');
  },
  encode(command) {
    const codes = { tare: [1,0,0], startTimer: [4,0,0], stopTimer: [5,0,0], resetTimer: [6,0,0], tareAndStart: [7,0,0], keepAwake: [0x25,0,0], shutdown: [0x15,0,0] };
    const data = codes[command];
    if (!data) throw new Error(`Unsupported command: ${command}`);
    const frame = new Uint8Array(6); frame.set([3, 0x0a, ...data]); frame[5] = frame.slice(0,5).reduce((a,b) => a ^ b, 0);
    return frame;
  },
  decode(dataView) {
    if (dataView.byteLength !== 20) throw new Error('BOOKOO packet expected 20-byte packet.');
    const p = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
    if (p[0] !== 3) throw new Error('Invalid BOOKOO packet header.');
    if (p.slice(0, 19).reduce((a, b) => a ^ b, 0) !== p[19]) throw new Error('Invalid BOOKOO checksum.');
    const u24 = i => p[i] * 65536 + p[i + 1] * 256 + p[i + 2];
    const signed = (sign, n) => sign === 0x2d ? -n : n;
    if (p[1] === 0x0f) return { type: 'powder', powderWeight: signed(p[2], u24(3)) / 100 };
    if (p[1] === 0x0d) return { type: 'autoBrew', state: ['stopped','started','ready','exit-ready','done'][p[2]] || 'unknown', elapsedMs: u24(3), result: signed(p[6], dataView.getUint16(11)) / 100 };
    if (p[1] !== 0x0b) return null;
    return { weight: signed(p[6], u24(7)) / 100, flow: signed(p[10], dataView.getUint16(11)) / 100, elapsedMs: u24(2), battery: p[13], unit: p[5] === 1 ? 'g' : p[5] === 2 ? 'oz' : `unit ${p[5]}` };
  },
};

export const protocols = [bookoo];
