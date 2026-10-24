export function decodeMeasurement(data) {
  if (data.byteLength !== 20) throw new Error('Expected a 20-byte BOOKOO packet.');
  const p = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (p[0] !== 3) throw new Error('Invalid BOOKOO packet header.');
  if (p.slice(0, 19).reduce((a, b) => a ^ b, 0) !== p[19]) throw new Error('Invalid BOOKOO checksum.');
  if (p[1] !== 0x0b) return null;
  const u24 = i => p[i] * 65536 + p[i + 1] * 256 + p[i + 2];
  const signed = (sign, n) => sign === 0x2d ? -n : n;
  return {
    weight: signed(p[6], u24(7)) / 100,
    flow: signed(p[10], data.getUint16(11)) / 100,
    elapsedMs: u24(2),
    battery: p[13],
    unit: p[5] === 1 ? 'g' : p[5] === 2 ? 'oz' : `unit ${p[5]}`,
  };
}
