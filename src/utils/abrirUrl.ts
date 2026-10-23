import { Linking } from 'react-native';
import { isTauri } from './platform';

export async function abrirUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  await Linking.openURL(url);
}
