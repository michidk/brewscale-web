import { DecodeError, type Command, type Protocol, type ScaleEvent } from './protocol.ts';

/** A connected device. Implemented by transport backends such as `web-bluetooth`. */
export interface Link {
  readonly name?: string;
  subscribe(service: number, characteristic: number, onPacket: (packet: Uint8Array) => void): Promise<void>;
  write(service: number, characteristic: number, data: Uint8Array): Promise<void>;
  onDisconnect(callback: () => void): void;
  disconnect(): void;
}

export interface ScaleListener {
  event?(event: ScaleEvent): void;
  /** Corrupt packets. The scale stays usable. */
  error?(error: DecodeError): void;
  disconnect?(): void;
}

/** A connected scale: decoded events out, commands in. */
export class Scale {
  readonly link: Link;
  readonly protocol: Protocol;

  private constructor(link: Link, protocol: Protocol) {
    this.link = link;
    this.protocol = protocol;
  }

  /** Subscribe to the protocol's notifications and start delivering events. */
  static async attach(link: Link, protocol: Protocol, listener: ScaleListener): Promise<Scale> {
    await link.subscribe(protocol.service, protocol.notifyCharacteristic, packet => {
      let event: ScaleEvent;
      try {
        event = protocol.decode(packet);
      } catch (error) {
        if (!(error instanceof DecodeError)) throw error;
        if (error.reason !== 'unknown-type') listener.error?.(error);
        return;
      }
      listener.event?.(event);
    });
    // Registered only once attached, so a failed attach never reports a disconnect.
    link.onDisconnect(() => listener.disconnect?.());
    return new Scale(link, protocol);
  }

  /** Rejects with `EncodeError` for commands the protocol does not support. */
  async send(command: Command): Promise<void> {
    await this.link.write(this.protocol.service, this.protocol.commandCharacteristic, this.protocol.encode(command));
  }

  tare(): Promise<void> {
    return this.send({ type: 'tare' });
  }

  disconnect(): void {
    this.link.disconnect();
  }
}
