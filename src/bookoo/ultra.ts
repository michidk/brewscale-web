import { EncodeError, type Protocol } from '../core/protocol.ts';
import {
  base,
  check,
  decodeAutoBrew,
  decodeMeasurement,
  encodeCommon,
  frame,
  signed,
  TYPE_AUTO_BREW,
  TYPE_MEASUREMENT,
  TYPE_POWDER,
  u24,
  unknownType,
} from './wire.ts';

const MAX_BEEP_LEVEL = 3;

/** BOOKOO Themis Ultra. Command availability also depends on firmware version, which this driver cannot know. */
export const ultra: Protocol = {
  ...base,
  name: 'BOOKOO Themis Ultra',
  capabilities: {
    timer: true,
    powderWeight: true,
    autoBrewEvents: true,
    shutdown: true,
    keepAwake: true,
    maxBeepLevel: MAX_BEEP_LEVEL,
  },

  decode(packet) {
    check(packet);
    switch (packet[1]) {
      case TYPE_MEASUREMENT:
        return decodeMeasurement(packet);
      case TYPE_POWDER:
        return (() => {
          const weightCg = signed(packet[2], u24(packet, 3));
          return { type: 'powder-weight', weightCg, weight: weightCg / 100 };
        })();
      case TYPE_AUTO_BREW:
        return decodeAutoBrew(packet);
      default:
        throw unknownType(packet);
    }
  },

  encode(command) {
    switch (command.type) {
      case 'set-powder-weight': {
        const deciGrams = Math.round(command.grams * 10);
        if (!(deciGrams >= 1 && deciGrams <= 9999)) throw new EncodeError('out-of-range', command);
        return frame(0x0d, deciGrams >> 8, deciGrams & 0xff);
      }
      case 'shutdown':
        return frame(0x15);
      case 'keep-awake':
        return frame(0x25);
      default:
        return encodeCommon(command, MAX_BEEP_LEVEL);
    }
  },
};
