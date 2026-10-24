/** BOOKOO Themis Mini/Ultra drivers. Mirrors `brewscale-bookoo`. */
import type { Advertisement, Driver, Protocol } from '../core/protocol.ts';
import { mini } from './mini.ts';
import { ultra } from './ultra.ts';
import { SERVICE } from './wire.ts';

export { mini, ultra };
export { COMMAND_CHARACTERISTIC, SERVICE, WEIGHT_CHARACTERISTIC } from './wire.ts';

/**
 * Identifies the model from the advertised name: `BOOKOO_SC xxxx` (Mini) or `BOOKOO_SC U xxxx` (Ultra).
 * Matches from `OOKOO_SC` because Mini firmware 1.4.1 reportedly drops the leading `B`
 * (decentespresso/decaid#972). A bare service match can't tell models apart, so it falls back to
 * the Mini, whose commands are the safe subset.
 */
export function identify({ name = '', services }: Advertisement): Protocol | undefined {
  const i = name.indexOf('OOKOO_SC');
  if (i >= 0) return /^ U( |$)/.test(name.slice(i + 'OOKOO_SC'.length)) ? ultra : mini;
  return services.includes(SERVICE) ? mini : undefined;
}

export const driver: Driver = {
  filters: [{ services: [SERVICE] }, { namePrefix: 'BOOKOO_SC' }, { namePrefix: 'OOKOO_SC' }],
  services: [SERVICE],
  detect: identify,
};
