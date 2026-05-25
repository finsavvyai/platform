import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, typography } from '../../theme/tokens';

type FeedStatus = 'passed' | 'failed' | 'running' | 'pending';

interface LiveFeedItemProps {
  title: string;
  status: FeedStatus;
  timestamp: string;
  environment?: string;
}

const statusIcons = {
  passed: CheckCircle,
  failed: XCircle,
  running: Loader,
  pending: Clock,
};

export function LiveFeedItem({ title, status, timestamp, environment }: LiveFeedItemProps) {
  const { colors } = useTheme();
  const Icon = statusIcons[status];
  const iconColor = {
    passed: colors.accentSuccess,
    failed: colors.accentError,
    running: colors.accentPrimary,
    pending: colors.accentWarning,
  }[status];

  const timeAgo = formatTimeAgo(timestamp);

  return (
    <View style={[styles.container, { borderBottomColor: colors.borderColor }]}>
      <Icon size={16} color={iconColor} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo}</Text>
          {environment && (
            <Text style={[styles.env, { color: colors.textMuted }]}>{environment}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
  title: { ...typography.subheadline },
  meta: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  time: { ...typography.caption1 },
  env: { ...typography.caption1 },
});
