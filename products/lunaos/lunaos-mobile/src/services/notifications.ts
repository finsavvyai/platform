/**
 * Push Notifications Service — Expo notifications for execution events
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/** Register for push notifications and return the Expo push token */
export async function registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
        console.warn('Push notifications require a physical device');
        return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        return null;
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('execution', {
            name: 'Agent Executions',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#007AFF',
        });
    }

    const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'lunaos-mobile',
    });

    return token.data;
}

/** Send a local notification for a completed execution */
export async function notifyExecutionComplete(
    agentName: string,
    status: 'success' | 'error',
    executionId: string,
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: status === 'success' ? `${agentName} Complete` : `${agentName} Failed`,
            body: status === 'success'
                ? `Agent "${agentName}" finished successfully.`
                : `Agent "${agentName}" encountered an error.`,
            data: { executionId, agentName, status },
            sound: true,
        },
        trigger: null, // Immediately
    });
}

/** Send a local notification for a completed chain */
export async function notifyChainComplete(
    chainName: string,
    nodeCount: number,
    status: 'completed' | 'failed' | 'paused',
) {
    const messages = {
        completed: `Chain "${chainName}" completed ${nodeCount} steps.`,
        failed: `Chain "${chainName}" failed during execution.`,
        paused: `Chain "${chainName}" paused — waiting for input.`,
    };

    await Notifications.scheduleNotificationAsync({
        content: {
            title: `Chain: ${chainName}`,
            body: messages[status],
            data: { chainName, status },
            sound: true,
        },
        trigger: null,
    });
}

/** Add a listener for notification taps (for navigation) */
export function addNotificationResponseListener(
    callback: (executionId: string) => void,
) {
    return Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data?.executionId) {
            callback(data.executionId as string);
        }
    });
}

/** Get current badge count */
export async function getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
}

/** Clear badge count */
export async function clearBadge(): Promise<void> {
    await Notifications.setBadgeCountAsync(0);
}
