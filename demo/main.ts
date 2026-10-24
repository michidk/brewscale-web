import { bookoo, isSupported, requestScale, type Capabilities, type Command, type Scale, type ScaleEvent } from '../src/index.ts';

const WINDOW_MS = 30_000;

const $ = (id: string) => document.getElementById(id)!;
const commandButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-command]')];
const samples: { time: number; weight: number }[] = [];
let scale: Scale | undefined;

function setStatus(text: string, live = false): void {
  $('status').textContent = text;
  $('status-dot').classList.toggle('live', live);
}

function setConnected(connected: Scale | undefined): void {
  scale = connected;
  $('connect').textContent = scale ? 'Disconnect' : 'Connect';
  for (const button of commandButtons) {
    const needs = button.dataset.needs as keyof Capabilities | undefined;
    button.disabled = !scale || (needs !== undefined && !scale.protocol.capabilities[needs]);
  }
}

const formatTime = (ms: number) =>
  `${String(Math.floor(ms / 60_000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function drawChart(): void {
  const now = Date.now();
  while (samples.length && samples[0].time < now - WINDOW_MS) samples.shift();
  const weights = samples.map(s => s.weight);
  const min = Math.min(...weights) - 1;
  const max = Math.max(...weights) + 1;
  const line = samples
    .map((s, i) => `${i ? 'L' : 'M'}${(500 * (s.time - now + WINDOW_MS)) / WINDOW_MS} ${170 - ((s.weight - min) / (max - min)) * 130}`)
    .join(' ');
  $('chart-line').setAttribute('d', line);
  $('chart-area').setAttribute('d', line && `${line} L500 190 L${line.split(' ')[0].slice(1)} 190 Z`);
}

function show(event: ScaleEvent): void {
  switch (event.type) {
    case 'measurement':
      $('weight').textContent = event.weight.toFixed(2);
      $('unit').textContent = typeof event.unit === 'string' ? ` ${event.unit}` : '';
      $('flow').textContent = event.flow.toFixed(2);
      $('timer').textContent = formatTime(event.elapsedMs);
      $('battery').textContent = `${event.battery} %`;
      samples.push({ time: Date.now(), weight: event.weight });
      drawChart();
      break;
    case 'powder-weight':
      $('message').textContent = `Powder weight: ${event.weight.toFixed(2)} g`;
      break;
    case 'auto-brew':
      $('message').textContent = `Auto brew: ${event.state}`;
      break;
  }
}

async function connect(): Promise<void> {
  if (!isSupported()) {
    setStatus('Web Bluetooth unavailable');
    $('device-detail').textContent = 'Open this page over HTTPS in Chrome or Edge.';
    return;
  }
  try {
    setStatus('connecting…');
    const connected = await requestScale([bookoo.driver], {
      event: show,
      error: error => { $('message').textContent = `Dropped packet: ${error.message}`; },
      disconnect: () => {
        setConnected(undefined);
        setStatus('disconnected');
        $('device-detail').textContent = 'Connection closed';
      },
    });
    setConnected(connected);
    setStatus('connected', true);
    $('device-name').textContent = connected.link.name ?? connected.protocol.name;
    $('device-detail').textContent = connected.protocol.name;
  } catch (error) {
    setStatus('connection failed');
    $('device-detail').textContent = error instanceof Error ? error.message : String(error);
  }
}

$('connect').addEventListener('click', () => (scale ? scale.disconnect() : connect()));

for (const button of commandButtons) {
  button.addEventListener('click', async () => {
    if (!scale) return;
    try {
      await scale.send({ type: button.dataset.command } as Command);
      if (button.dataset.command === 'tare') {
        samples.length = 0;
        drawChart();
      }
      $('message').textContent = `${button.textContent} sent`;
    } catch (error) {
      $('message').textContent = error instanceof Error ? error.message : String(error);
    }
  });
}
