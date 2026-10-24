import { bookoo, protocols } from './protocols.mjs';
export { bookoo as protocol, protocols };
export { bookoo as default };
export const decodeMeasurement = (dataView) => bookoo.decode(dataView);
