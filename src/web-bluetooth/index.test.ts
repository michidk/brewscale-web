import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WebBluetoothLink } from './index.ts';

test('writes run one at a time and a failed write does not block the next', async () => {
  let inFlight = 0;
  const order: number[] = [];
  const characteristic = {
    async writeValueWithResponse(data: Uint8Array) {
      assert.equal(inFlight++, 0, 'overlapping GATT writes');
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      order.push(data[0]);
      if (data[0] === 2) throw new Error('write failed');
    },
  };
  const server = { getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) };
  const device = { gatt: { connect: async () => server } } as unknown as BluetoothDevice;
  const link = await WebBluetoothLink.connect(device);
  const writes = [1, 2, 3].map(n => link.write(1, 2, Uint8Array.of(n)));
  const results = await Promise.allSettled(writes);
  assert.deepEqual(order, [1, 2, 3]);
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected', 'fulfilled']);
});
