type BluetoothServiceUUID = number | string;
type BluetoothCharacteristicUUID = number | string;
interface BluetoothLEScanFilter { services?: BluetoothServiceUUID[]; namePrefix?: string; }
interface BluetoothRemoteGATTCharacteristic extends EventTarget { value?: DataView; startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>; writeValue(value: Uint8Array): Promise<void>; }
interface BluetoothRemoteGATTService { getCharacteristic(uuid: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>; }
interface BluetoothRemoteGATTServer { getPrimaryService(uuid: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>; }
interface BluetoothDevice { name?: string; gatt?: { connected: boolean; connect(): Promise<BluetoothRemoteGATTServer>; disconnect(): void }; }
interface Bluetooth { requestDevice(options: { filters: BluetoothLEScanFilter[]; optionalServices: BluetoothServiceUUID[] }): Promise<BluetoothDevice>; }
interface Navigator { bluetooth: Bluetooth; }

