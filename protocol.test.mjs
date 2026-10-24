import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeMeasurement } from './protocol.mjs';
const fixture = () => {
  const p = Uint8Array.from([3, 11, 1, 2, 3, 1, 43, 0, 7, 12, 45, 0, 250, 87, 2, 88, 2, 1, 0, 0]);
  p[19] = p.slice(0, 19).reduce((a,b) => a ^ b, 0);
  return p;
};
test('decodes the brewscale BOOKOO measurement fixture including signed flow and scale time', () => {
  assert.deepEqual(decodeMeasurement(new DataView(fixture().buffer)), {
    weight: 18.04, flow: -2.5, elapsedMs: 66051, battery: 87, unit: 'g',
  });
});
test('rejects corrupt and truncated notifications', () => {
  const p = fixture(); p[8] ^= 1;
  assert.throws(() => decodeMeasurement(new DataView(p.buffer)), /checksum/);
  assert.throws(() => decodeMeasurement(new DataView(p.buffer, 0, 19)), /20-byte/);
});
test('supports DataViews with offsets and ignores other valid packet types', () => {
  const storage = new Uint8Array(24); storage.set(fixture(), 4);
  assert.equal(decodeMeasurement(new DataView(storage.buffer, 4)).weight, 18.04);
  const p = fixture(); p[1] = 13; p[19] = p.slice(0,19).reduce((a,b) => a^b,0);
  assert.equal(decodeMeasurement(new DataView(p.buffer)), null);
});
