/** Vendor-neutral scale data types and the `Protocol` contract drivers implement. Mirrors `brewscale-core`. */

export type WeightUnit = 'g' | 'oz' | { readonly unknown: number };

export interface Measurement {
  readonly elapsedMs: number;
  /** Grams, signed. */
  readonly weight: number;
  /** Grams per second, signed. */
  readonly flow: number;
  readonly unit: WeightUnit;
  readonly battery: number;
  readonly standbyMinutes: number;
  readonly beepLevel: number;
  readonly flowSmoothing: boolean;
}

export type AutoBrewState = 'stopped' | 'started' | 'ready' | 'exit-ready' | 'exit-done';

export interface AutoBrewEvent {
  readonly state: AutoBrewState;
  readonly elapsedMs: number;
  readonly weight: number;
  readonly result: number;
}

export type ScaleEvent =
  | ({ readonly type: 'measurement' } & Measurement)
  | { readonly type: 'powder-weight'; readonly weight: number }
  | ({ readonly type: 'auto-brew' } & AutoBrewEvent);

export type Command =
  | { readonly type: 'tare' }
  | { readonly type: 'start-timer' }
  | { readonly type: 'stop-timer' }
  | { readonly type: 'reset-timer' }
  | { readonly type: 'tare-and-start-timer' }
  | { readonly type: 'set-flow-smoothing'; readonly enabled: boolean }
  | { readonly type: 'set-beep-level'; readonly level: number }
  | { readonly type: 'set-auto-off'; readonly minutes: number }
  /** Target powder weight in grams, 0.1 g resolution. */
  | { readonly type: 'set-powder-weight'; readonly grams: number }
  | { readonly type: 'shutdown' }
  | { readonly type: 'keep-awake' };

export interface Capabilities {
  readonly timer: boolean;
  readonly powderWeight: boolean;
  readonly autoBrewEvents: boolean;
  readonly shutdown: boolean;
  readonly keepAwake: boolean;
  readonly maxBeepLevel: number;
}

export type DecodeErrorReason = 'length' | 'header' | 'checksum' | 'unknown-type';

export class DecodeError extends Error {
  readonly reason: DecodeErrorReason;
  constructor(reason: DecodeErrorReason, message: string) {
    super(message);
    this.name = 'DecodeError';
    this.reason = reason;
  }
}

export class EncodeError extends Error {
  readonly reason: 'unsupported' | 'out-of-range';
  constructor(reason: 'unsupported' | 'out-of-range', command: Command) {
    super(reason === 'unsupported' ? `${command.type} is not supported by this scale` : `${command.type} argument out of range`);
    this.name = 'EncodeError';
    this.reason = reason;
  }
}

/** One scale model's wire format. GATT UUIDs are 16-bit assigned numbers. */
export interface Protocol {
  readonly name: string;
  readonly service: number;
  readonly notifyCharacteristic: number;
  readonly commandCharacteristic: number;
  readonly capabilities: Capabilities;
  /** Throws `DecodeError` for malformed packets. */
  decode(packet: Uint8Array): ScaleEvent;
  /** Throws `EncodeError` for commands this model rejects. */
  encode(command: Command): Uint8Array;
}

/** What a transport knows about a device before attaching. */
export interface Advertisement {
  readonly name?: string;
  readonly services: readonly number[];
}

/** Picks a `Protocol` for a discovered device. One per vendor. */
export interface Driver {
  /** Scan filters a transport uses to find candidate devices. */
  readonly filters: readonly { readonly services?: readonly number[]; readonly namePrefix?: string }[];
  readonly services: readonly number[];
  detect(advertisement: Advertisement): Protocol | undefined;
}
