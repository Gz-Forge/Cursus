import { LazyStore } from '@tauri-apps/plugin-store';

// Una sola instancia del store para toda la app
const store = new LazyStore('cursus.json');

export const getItem = async (key: string): Promise<string | null> => {
  const value = await store.get<string>(key);
  return value ?? null;
};

export const setItem = async (key: string, value: string): Promise<void> => {
  await store.set(key, value);
  await store.save();
};

export const removeItem = async (key: string): Promise<void> => {
  await store.delete(key);
  await store.save();
};
