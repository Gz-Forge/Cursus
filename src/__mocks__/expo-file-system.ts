// Minimal mock for expo-file-system in Jest
export const documentDirectory = '/tmp/';
export const EncodingType = { UTF8: 'utf8' };
export const readAsStringAsync = jest.fn();
export const writeAsStringAsync = jest.fn();
