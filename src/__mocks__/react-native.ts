// Minimal mock for react-native in Jest (Node environment)
export const Platform = { OS: 'ios', select: (obj: Record<string, unknown>) => obj.default ?? obj.ios };
export default { Platform };
