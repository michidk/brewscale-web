import { bookoo } from '../src/protocols/bookoo/index.js';
import { connect } from '../src/transport/web-bluetooth.js';
const $ = (id) => document.getElementById(id);
let connection;
const points = [];
function render(event) {
    if (event.kind === 'measurement') {
        $('weight').textContent = event.weight.toFixed(2);
        $('flow').textContent = event.flow.toFixed(2);
        $('timer').textContent = `${String(Math.floor(event.elapsedMs / 60000)).padStart(2, '0')}:${String(Math.floor(event.elapsedMs / 1000) % 60).padStart(2, '0')}`;
        $('battery').textContent = `${event.battery} %`;
        $('reading-state').textContent = 'Live reading';
        points.push({ time: Date.now(), weight: event.weight });
        const recent = points.slice(-60);
        const min = Math.min(...recent.map(p => p.weight)) - 1;
        const max = Math.max(...recent.map(p => p.weight)) + 1;
        const d = recent.map((p, i) => `${i ? 'L' : 'M'}${i * 500 / Math.max(recent.length - 1, 1)} ${170 - (p.weight - min) / (max - min) * 130}`).join(' ');
        $('chart-line').setAttribute('d', d);
        $('area-path').setAttribute('d', `${d} L500 190 L0 190 Z`);
    }
    else if (event.kind === 'powder-weight')
        $('event-status').textContent = `Powder weight: ${event.weight.toFixed(2)} g`;
    else
        $('event-status').textContent = `Auto brew: ${event.state}`;
}
$('connect').addEventListener('click', async () => { try {
    connection?.disconnect();
    connection = await connect([bookoo], render);
    $('status-text').textContent = 'Connected';
    $('status-dot').classList.add('live');
    $('device-name').textContent = connection.device.name || 'BOOKOO scale';
    $('device-id').textContent = 'Bluetooth link active';
    $('connect').textContent = 'Disconnect';
}
catch (error) {
    $('status-text').textContent = 'Connection failed';
    $('device-id').textContent = error instanceof Error ? error.message : 'Bluetooth connection failed';
} });
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', async () => { if (!connection) {
    $('event-status').textContent = 'Connect a scale first.';
    return;
} try {
    await connection.send(button.dataset.command);
    if (button.dataset.command === 'tare') {
        points.length = 0;
        $('chart-line').setAttribute('d', '');
        $('area-path').setAttribute('d', '');
    }
    $('event-status').textContent = `${button.textContent} sent`;
}
catch (error) {
    $('event-status').textContent = error instanceof Error ? error.message : 'Command failed';
} }));
