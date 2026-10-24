import type { Protocol } from '../core/protocol.ts';
import { base, check, decodeMeasurement, encodeCommon, TYPE_MEASUREMENT, unknownType } from './wire.ts';

const MAX_BEEP_LEVEL = 5;

/** BOOKOO Themis Mini: measurements only, the common command set. */
export const mini: Protocol = {
  ...base,
  name: 'BOOKOO Themis Mini',
  capabilities: {
    timer: true,
    powderWeight: false,
    autoBrewEvents: false,
    shutdown: false,
    keepAwake: false,
    maxBeepLevel: MAX_BEEP_LEVEL,
  },

  decode(packet) {
    check(packet);
    if (packet[1] === TYPE_MEASUREMENT) return decodeMeasurement(packet);
    throw unknownType(packet);
  },

  encode(command) {
    return encodeCommon(command, MAX_BEEP_LEVEL);
  },
};
