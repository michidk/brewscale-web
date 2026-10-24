/// <reference types="web-bluetooth" />
/** Web Bluetooth backend: the browser counterpart of `brewscale`'s btleplug transport. */
import type { Driver } from '../core/protocol.ts';
import { Scale, type Link, type ScaleListener } from '../core/scale.ts';

const uuid = (n: number) => BluetoothUUID.getService(n);

/** Wraps a connected GATT server. Characteristics are cached after the first lookup. */
export class WebBluetoothLink implements Link {
  private readonly device: BluetoothDevice;
  private readonly server: BluetoothRemoteGATTServer;
  private readonly characteristics = new Map<string, Promise<BluetoothRemoteGATTCharacteristic>>();

  private constructor(device: BluetoothDevice, server: BluetoothRemoteGATTServer) {
    this.device = device;
    this.server = server;
  }

  static async connect(device: BluetoothDevice): Promise<WebBluetoothLink> {
    if (!device.gatt) throw new Error(`${device.name ?? 'Device'} has no GATT server`);
    return new WebBluetoothLink(device, await device.gatt.connect());
  }

  get name(): string | undefined {
    return this.device.name;
  }

  /** Which of `candidates` the device exposes. Only services listed in `optionalServices` are visible. */
  async services(candidates: readonly number[]): Promise<number[]> {
    const present = new Set((await this.server.getPrimaryServices()).map(s => s.uuid));
    return candidates.filter(n => present.has(uuid(n)));
  }

  private characteristic(service: number, characteristic: number): Promise<BluetoothRemoteGATTCharacteristic> {
    const key = `${service}/${characteristic}`;
    let found = this.characteristics.get(key);
    if (!found) {
      found = this.server.getPrimaryService(service).then(s => s.getCharacteristic(characteristic));
      found.catch(() => this.characteristics.delete(key));
      this.characteristics.set(key, found);
    }
    return found;
  }

  async subscribe(service: number, characteristic: number, onPacket: (packet: Uint8Array) => void): Promise<void> {
    const c = await this.characteristic(service, characteristic);
    c.addEventListener('characteristicvaluechanged', () => {
      if (c.value) onPacket(new Uint8Array(c.value.buffer, c.value.byteOffset, c.value.byteLength));
    });
    await c.startNotifications();
  }

  async write(service: number, characteristic: number, data: Uint8Array): Promise<void> {
    const c = await this.characteristic(service, characteristic);
    await c.writeValueWithResponse(data as Uint8Array<ArrayBuffer>);
  }

  onDisconnect(callback: () => void): void {
    this.device.addEventListener('gattserverdisconnected', callback, { once: true });
  }

  disconnect(): void {
    this.device.gatt?.disconnect();
  }
}

export const isSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator && window.isSecureContext;

/** Opens the browser's device picker, connects, detects the protocol and attaches. Must run in a user gesture. */
export async function requestScale(drivers: readonly Driver[], listener: ScaleListener): Promise<Scale> {
  const services = [...new Set(drivers.flatMap(d => d.services))];
  const device = await navigator.bluetooth.requestDevice({
    filters: drivers.flatMap(d => d.filters.map(f => ({ ...f, services: f.services && [...f.services] }))),
    optionalServices: services,
  });
  const link = await WebBluetoothLink.connect(device);
  try {
    const advertisement = { name: device.name, services: await link.services(services) };
    const protocol = drivers.map(d => d.detect(advertisement)).find(p => p !== undefined);
    if (!protocol) throw new Error(`${device.name ?? 'Device'} is not a supported scale`);
    return await Scale.attach(link, protocol, listener);
  } catch (error) {
    link.disconnect();
    throw error;
  }
}
