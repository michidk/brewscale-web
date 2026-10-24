export type WeightUnit = 'g' | 'oz' | `unknown:${number}`;

export interface Measurement {
  readonly kind: 'measurement';
  readonly weight: number;
  readonly flow: number;
  readonly elapsedMs: number;
  readonly battery: number;
  readonly unit: WeightUnit;
}

export interface PowderWeightEvent { readonly kind: 'powder-weight'; readonly weight: number; }
export interface AutoBrewEvent { readonly kind: 'auto-brew'; readonly state: 'stopped' | 'started' | 'ready' | 'exit-ready' | 'done' | 'unknown'; readonly elapsedMs: number; readonly weight: number; readonly result: number; }
export type ScaleEvent = Measurement | PowderWeightEvent | AutoBrewEvent;
export type Command = 'tare' | 'start-timer' | 'stop-timer' | 'reset-timer' | 'tare-and-start' | 'keep-awake' | 'shutdown';

export interface ScaleCapabilities { readonly timer: boolean; readonly powderWeight: boolean; readonly autoBrewEvents: boolean; readonly keepAwake: boolean; readonly shutdown: boolean; }
export interface ScaleProtocol {
  readonly id: string; readonly name: string; readonly services: readonly BluetoothServiceUUID[]; readonly notificationCharacteristic: BluetoothCharacteristicUUID; readonly commandCharacteristic?: BluetoothCharacteristicUUID; readonly capabilities: ScaleCapabilities;
  readonly filters: readonly BluetoothLEScanFilter[];
  decode(data: DataView): ScaleEvent | null;
  encode?(command: Command): Uint8Array;
}
