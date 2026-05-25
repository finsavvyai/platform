import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushNotificationState {
  token: string | null;
  isEnabled: boolean;
  error: string | null;
}

export function usePushNotifications(): PushNotificationState & { requestPermission: () => Promise<boolean> } {
  const router = useRouter();
  const [state, setState] = useState<PushNotificationState>({ token: null, isEnabled: false, error: null });
  const notifListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  useEffect(() => {
    registerForPush().then((token) => {
      if (token) setState((s) => ({ ...s, token, isEnabled: true }));
    });

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      routeNotification(data as Record<string, unknown>, router);
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === 'granted';
    setState((s) => ({ ...s, isEnabled: granted }));
    return granted;
  };

  return { ...state, requestPermission };
}

async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default', importance: Notifications.AndroidImportance.MAX,
      });
    }
    return token;
  } catch { return null; }
}

function routeNotification(data: Record<string, unknown>, router: ReturnType<typeof useRouter>) {
  const type = data?.type as string | undefined;
  const id = data?.id as string | undefined;
  if (!type || !id) return;
  const routes: Record<string, string> = {
    run_completed: `/runs/${id}`,
    run_failed: `/runs/${id}`,
    test_case_updated: `/cases/${id}`,
    recording_ready: `/recording/active`,
  };
  const route = routes[type];
  if (route) router.push(route as never);
}
