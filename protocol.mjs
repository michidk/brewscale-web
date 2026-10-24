import { bookoo, protocols } from './protocols.mjs';
export { bookoo as protocol, protocols };
export { bookoo as default };
export const decodeMeasurement = (dataView) => { const reading = bookoo.decode(dataView); return reading?.type ? null : reading; };
