import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, typography } from '../../theme/tokens';

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
}

export function ChatBubble({ message, isUser, timestamp }: ChatBubbleProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, isUser && styles.userRow]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.accentPrimary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.bgTertiary, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[styles.text, { color: isUser ? '#fff' : colors.textPrimary }]}>
          {message}
        </Text>
      </View>
      {timestamp && (
        <Text style={[styles.time, { color: colors.textMuted }, isUser && styles.userTime]}>
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing.md, alignItems: 'flex-start' },
  userRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.modal },
  text: { ...typography.body, lineHeight: 22 },
  time: { ...typography.caption2, marginTop: 2, marginLeft: spacing.sm },
  userTime: { marginLeft: 0, marginRight: spacing.sm },
});
