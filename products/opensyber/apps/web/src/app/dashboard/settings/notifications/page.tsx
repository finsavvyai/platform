import { Bell, Mail, Globe, MessageSquare } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { CreateNotificationChannelForm } from '@/components/dashboard/security/CreateNotificationChannelForm';
import { DeleteNotificationChannelButton } from '@/components/dashboard/security/DeleteNotificationChannelButton';

export const metadata = { title: 'Notification Channels' };

interface NotificationChannel {
  id: string;
  channelType: 'email' | 'webhook' | 'slack';
  name: string;
  config: string;
  isActive: boolean;
  createdAt: string;
}

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  webhook: Globe,
  slack: MessageSquare,
};

export default async function NotificationsPage() {
  let channels: NotificationChannel[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ channels: NotificationChannel[] }>(
        '/api/security/user/notification-channels',
        { token },
      );
      channels = data.channels;
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Notification Channels</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure where security alerts and notifications are delivered
        </p>
      </div>

      {/* Existing Channels */}
      {channels.length > 0 ? (
        <div className="mb-8 space-y-3">
          {channels.map((channel) => {
            const Icon = channelIcons[channel.channelType] ?? Bell;
            let configSummary = '';
            try {
              const parsed = JSON.parse(channel.config);
              if (channel.channelType === 'email') configSummary = parsed.email ?? '';
              else if (channel.channelType === 'webhook') configSummary = parsed.url ?? '';
              else if (channel.channelType === 'slack') configSummary = parsed.webhookUrl ?? '';
            } catch {
              configSummary = '';
            }

            return (
              <div
                key={channel.id}
                className="flex items-center justify-between rounded border border-border bg-panel/30 p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
                    <Icon className="h-5 w-5 text-text-secondary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{channel.name}</p>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs capitalize text-text-secondary">
                        {channel.channelType}
                      </span>
                      {channel.isActive ? (
                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-dim">
                          Inactive
                        </span>
                      )}
                    </div>
                    {configSummary && (
                      <p className="mt-0.5 text-xs text-text-dim font-mono truncate max-w-sm">
                        {configSummary}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-text-dim">
                      Created {formatDate(channel.createdAt)}
                    </p>
                  </div>
                </div>
                <DeleteNotificationChannelButton channelId={channel.id} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-8 flex flex-col items-center justify-center rounded border border-dashed border-wire bg-panel/20 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Bell className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No notification channels</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Add a channel below to receive security alerts via email, webhook, or Slack.
          </p>
        </div>
      )}

      {/* Add New Channel */}
      <CreateNotificationChannelForm />
    </div>
  );
}
