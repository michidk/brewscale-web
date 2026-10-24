export async function connect(protocols, onEvent) {
    const device = await navigator.bluetooth.requestDevice({ filters: protocols.flatMap(p => p.filters), optionalServices: protocols.flatMap(p => p.services) });
    const server = await device.gatt?.connect() ?? (() => { throw new Error('Bluetooth GATT connection failed.'); })();
    let selected;
    for (const protocol of protocols)
        for (const serviceId of protocol.services) {
            try {
                selected = { protocol, service: await server.getPrimaryService(serviceId) };
                break;
            }
            catch { /* try next protocol */ }
            if (selected)
                break;
        }
    if (!selected)
        throw new Error('No supported scale protocol found.');
    const characteristic = await selected.service.getCharacteristic(selected.protocol.notificationCharacteristic);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => { const value = event.target.value; if (value) {
        const decoded = selected?.protocol.decode(value);
        if (decoded)
            onEvent(decoded);
    } });
    return { device, protocol: selected.protocol, async send(command) { if (!selected?.protocol.encode || !selected.protocol.commandCharacteristic)
            throw new Error('This scale does not support commands.'); const characteristic = await selected.service.getCharacteristic(selected.protocol.commandCharacteristic); await characteristic.writeValue(selected.protocol.encode(command)); }, disconnect() { device.gatt?.disconnect(); } };
}
