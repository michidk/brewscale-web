# brewscale-web

A small static Web Bluetooth PoC for BOOKOO Themis Mini and Ultra coffee scales, based on the protocol in [michidk/brewscale](https://github.com/michidk/brewscale).

## Use

Serve the directory over HTTPS or localhost. For local development:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 in Chrome or Edge on desktop, or serve over HTTPS for Chrome on Android. Safari and Firefox do not currently support Web Bluetooth. Vivaldi may show its Bluetooth permission prompt but fail to open the device picker, even though it is Chromium-based. Use Chrome or Edge for this PoC. Open the page directly in a browser tab if an embedded preview blocks Bluetooth permissions.

Turn on your scale, close other apps connected to it, click **Connect BOOKOO**, and select it in the browser's device picker. The page shows weight, signed flow in g/s, battery, and the scale's timer. The chart retains the last 30 seconds of received weight readings. Click **Disconnect** to close the connection. Reconnect manually after a lost connection.

Readings stay in the browser. There is no backend or account. No simulated readings are displayed. Physical scale pairing must be checked on the user's Bluetooth-enabled device.

## Protocol

Service `0x0FFE`, notification characteristic `0xFF11`. Measurement packets are 20 bytes with header `0x03`, type `0x0B`, and an XOR checksum. Other valid packet types are ignored. Weight and flow use signed integer magnitudes divided by 100. Elapsed time comes from the scale, not a browser stopwatch. The displayed unit comes from the notification; flow is in grams per second as defined by brewscale.

The PoC reads notifications only. Tare, timer controls, and other scale brands are outside this version's scope.

## Verify

```sh
node --test protocol.test.mjs
```

Tests cover the reference brewscale measurement fixture, negative flow, scale time, invalid checksums, truncated frames, offset DataViews, and ignored packet types.
