# brewscale-web

A protocol-agnostic TypeScript library for coffee scales in the browser over Web Bluetooth. It provides vendor-neutral scale events, commands, capabilities, and transport boundaries. The Rust implementation is [brewscale-rs](https://github.com/michidk/brewscale-rs); both projects share the same design.

| Module | Rust counterpart | Contents |
| --- | --- | --- |
| `src/core` | `brewscale-core` | `Protocol`, `Driver`, events, commands, errors, and the transport-neutral `Scale` over a `Link` |
| `src/bookoo` | `brewscale-bookoo` | `mini`, `ultra`, model detection, packet decoding and command encoding |
| `src/web-bluetooth` | `brewscale` (btleplug) | `requestScale` and the `WebBluetoothLink` backend |
| `demo` | `examples` | Live readings page built on the public API |

## Supported models

The current built-in protocol support is:

- BOOKOO Themis Mini
- BOOKOO Themis Ultra

More vendors can be added by implementing `Driver` and `Protocol`.

## Usage

```ts
import { bookoo, requestScale } from 'brewscale-web';

// Must run inside a user gesture, e.g. a click handler.
const scale = await requestScale([bookoo.driver], {
  event: event => {
    if (event.type === 'measurement') console.log(event.weight, event.flow, event.elapsedMs);
  },
  error: error => console.warn('corrupt packet', error.reason),
  disconnect: () => console.log('scale disconnected'),
});

await scale.tare();
await scale.send({ type: 'set-powder-weight', grams: 18 }); // Ultra only, rejects with EncodeError on a Mini
scale.disconnect();
```

`scale.protocol.capabilities` tells you which commands and events the connected model supports. The Mini decodes measurements only; the Ultra adds powder-weight and auto-brew events plus shutdown and keep-awake.

Protocols are pure functions over bytes, so they work without Bluetooth:

```ts
import { bookoo } from 'brewscale-web';
const event = bookoo.ultra.decode(packet); // throws DecodeError on bad length, header or checksum
```

To support another transport, implement `Link` and call `Scale.attach(link, protocol, listener)`. To support another vendor, implement `Driver` and `Protocol` and pass the driver to `requestScale`.

The browser API uses JavaScript numbers, callbacks, promises, and the browser's
user-controlled chooser. Rust uses fixed-point values, pull-based async streams,
and explicit transport errors. These are intentional language and platform
choices; the shared contract is the meaning of events, commands, capabilities,
and protocol detection.

## Browser support

Web Bluetooth needs a secure context (HTTPS or localhost) in Chrome or Edge on desktop, or Chrome on Android. Safari and Firefox do not support it. Vivaldi may show its Bluetooth permission prompt but never open the device picker, even though it is Chromium-based.

Close the BOOKOO app before connecting; the scale accepts one connection at a time.

## Development

```sh
npm install
npm run dev        # demo with hot reload
npm test           # protocol and Scale tests, run directly from TypeScript
npm run check      # type-check library, tests and demo
npm run build      # library to dist/
npm run build:demo # static demo to dist-demo/
```

## BOOKOO protocol

The current BOOKOO implementation uses service `0x0FFE`, notify `0xFF11`, write `0xFF12`. Every packet is `[0x03, type, data.., xor]`, where `xor` is the XOR of all preceding bytes. Notifications are 20 bytes; weights and flow are sign byte plus big-endian magnitude in hundredths. The wire format is documented in [BooKooCode/OpenSource](https://github.com/BooKooCode/OpenSource).

## License

MIT
