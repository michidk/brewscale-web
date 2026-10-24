import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EncodeError } from '../core/protocol.ts';
import { identify, mini, ultra } from './index.ts';

/** Reference measurement fixture from brewscale-rs. */
function packet(bytes: number[] = [3, 0x0b, 1, 2, 3, 1, 43, 0, 7, 12, 45, 0, 250, 87, 2, 88, 2, 1, 0]): Uint8Array {
  return Uint8Array.from([...bytes, bytes.reduce((a, b) => a ^ b, 0)]);
}

test('decodes a measurement with signed flow, scale time and settings', () => {
  assert.deepEqual(mini.decode(packet()), {
    type: 'measurement', elapsedMs: 66051, unit: 'g', weightCg: 1804, weight: 18.04,
    flowCgPerS: -250, flow: -2.5, battery: 87, standbyDeciMin: 600,
    standbyMinutes: 60, beepLevel: 2, flowSmoothing: true,
  });
});

test('decodes from a view with an offset', () => {
  const storage = new Uint8Array(24);
  storage.set(packet(), 4);
  assert.equal((mini.decode(storage.subarray(4)) as { weight: number }).weight, 18.04);
});

test('rejects truncated, foreign and corrupt packets', () => {
  assert.throws(() => mini.decode(packet().subarray(0, 19)), { name: 'DecodeError', reason: 'length' });
  const foreign = packet(); foreign[0] = 4;
  assert.throws(() => mini.decode(foreign), { reason: 'header' });
  const corrupt = packet(); corrupt[8] ^= 1;
  assert.throws(() => mini.decode(corrupt), { reason: 'checksum' });
});

test('only the Ultra decodes powder and auto-brew packets', () => {
  const powder = packet([3, 0x0f, 0x2d, 0, 0x07, 0xd0, ...Array(13).fill(0)]);
  assert.deepEqual(ultra.decode(powder), { type: 'powder-weight', weightCg: -2000, weight: -20 });
  assert.throws(() => mini.decode(powder), { reason: 'unknown-type' });
  const autoBrew = packet([3, 0x0d, 4, 0, 0x75, 0x30, 0, 0, 0x0f, 0xa0, 0, 0x01, 0x2c, ...Array(6).fill(0)]);
  assert.deepEqual(ultra.decode(autoBrew), { type: 'auto-brew', state: 'exit-done', elapsedMs: 30000, weightCg: 4000, weight: 40, resultC: 300, result: 3 });
});

test('encodes command frames with checksum', () => {
  assert.deepEqual([...mini.encode({ type: 'tare' })], [3, 0x0a, 1, 0, 0, 0x08]);
  assert.deepEqual([...ultra.encode({ type: 'set-powder-weight', grams: 18.5 })], [3, 0x0a, 0x0d, 0, 185, 3 ^ 0x0a ^ 0x0d ^ 185]);
});

test('rejects unsupported and out-of-range commands', () => {
  assert.throws(() => mini.encode({ type: 'shutdown' }), { reason: 'unsupported' });
  assert.throws(() => ultra.encode({ type: 'set-beep-level', level: 4 }), EncodeError);
  assert.doesNotThrow(() => mini.encode({ type: 'set-beep-level', level: 5 }));
  assert.throws(() => mini.encode({ type: 'set-auto-off', minutes: 31 }), { reason: 'out-of-range' });
  assert.throws(() => ultra.encode({ type: 'set-powder-weight', grams: 0 }), { reason: 'out-of-range' });
});

test('identifies the model from the advertised name', () => {
  assert.equal(identify({ name: 'BOOKOO_SC 1234', services: [] }), mini);
  assert.equal(identify({ name: 'BOOKOO_SC U 1234', services: [] }), ultra);
  assert.equal(identify({ name: 'OOKOO_SC U', services: [] }), ultra);
  assert.equal(identify({ name: 'Scale', services: [0x0ffe] }), mini);
  assert.equal(identify({ name: 'Scale', services: [] }), undefined);
});
