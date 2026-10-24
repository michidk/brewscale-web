import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mini } from '../bookoo/index.ts';
import type { DecodeError, ScaleEvent } from './protocol.ts';
import { Scale, type Link } from './scale.ts';

function mockLink() {
  const writes: { characteristic: number; data: number[] }[] = [];
  let push = (_: Uint8Array) => {};
  let dropped = () => {};
  const link: Link = {
    name: 'mock',
    subscribe: async (_s, _c, onPacket) => { push = onPacket; },
    write: async (_s, characteristic, data) => { writes.push({ characteristic, data: [...data] }); },
    prepare: async () => {},
    onDisconnect: callback => { dropped = callback; },
    disconnect: () => dropped(),
  };
  return { link, writes, push: (p: Uint8Array) => push(p), drop: () => dropped() };
}

const packet = (type: number) => {
  const p = new Uint8Array(20); p[0] = 3; p[1] = type;
  p[19] = p.subarray(0, 19).reduce((a, b) => a ^ b, 0);
  return p;
};

test('delivers events, reports corrupt packets and skips unknown types', async () => {
  const { link, push } = mockLink();
  const events: ScaleEvent[] = [];
  const errors: DecodeError[] = [];
  await Scale.attach(link, mini, { event: e => events.push(e), error: e => errors.push(e) });
  push(packet(0x0b));
  push(packet(0x0f));
  push(new Uint8Array(3));
  assert.deepEqual(events.map(e => e.type), ['measurement']);
  assert.deepEqual(errors.map(e => e.reason), ['length']);
});

test('writes encoded commands to the command characteristic and reports disconnects', async () => {
  const { link, writes } = mockLink();
  let disconnected = false;
  const scale = await Scale.attach(link, mini, { disconnect: () => { disconnected = true; } });
  await scale.tare();
  assert.deepEqual(writes, [{ characteristic: 0xff12, data: [3, 0x0a, 1, 0, 0, 0x08] }]);
  await assert.rejects(scale.send({ type: 'keep-awake' }), { reason: 'unsupported' });
  scale.disconnect();
  assert.ok(disconnected);
});

test('a failed attach does not report a disconnect', async () => {
  const { link } = mockLink();
  link.subscribe = async () => { throw new Error('GATT error'); };
  let disconnected = false;
  await assert.rejects(Scale.attach(link, mini, { disconnect: () => { disconnected = true; } }), /GATT error/);
  link.disconnect();
  assert.equal(disconnected, false);
});
