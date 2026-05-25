import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

const SCHEME = 'qestro';
const WEB_HOST = 'app.qestro.io';

type DeepLinkPath =
  | `runs/${string}`
  | `cases/${string}`
  | `recording/${string}`
  | `explorations/${string}`
  | `plans/${string}`;

export function buildDeepLink(path: DeepLinkPath): string {
  return `${SCHEME}://${path}`;
}

export function buildWebLink(path: DeepLinkPath): string {
  return `https://${WEB_HOST}/${path}`;
}

export async function shareDeepLink(path: DeepLinkPath): Promise<void> {
  const link = buildDeepLink(path);
  await Clipboard.setStringAsync(link);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function parseDeepLink(url: string): { screen: string; id: string } | null {
  const stripped = url.replace(`${SCHEME}://`, '').replace(`https://${WEB_HOST}/`, '');
  const parts = stripped.split('/');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { screen: parts[0], id: parts[1] };
  }
  return null;
}

export function routeFromDeepLink(url: string): string | null {
  const parsed = parseDeepLink(url);
  if (!parsed) return null;
  const { screen, id } = parsed;
  const routeMap: Record<string, string> = {
    runs: `/runs/${id}`,
    cases: `/cases/${id}`,
    recording: `/recording/active?id=${id}`,
    explorations: `/explorations/${id}`,
    plans: `/plans/${id}`,
  };
  return routeMap[screen] ?? null;
}

export async function getInitialDeepLink(): Promise<string | null> {
  const url = await Linking.getInitialURL();
  if (!url) return null;
  return routeFromDeepLink(url);
}
