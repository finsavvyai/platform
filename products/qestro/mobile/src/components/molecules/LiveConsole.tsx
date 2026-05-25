import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, radius } from '../../theme/tokens';

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  message: string;
  timestamp?: string;
}

interface LiveConsoleProps {
  logs: LogEntry[];
  autoScroll?: boolean;
  style?: ViewStyle;
}

const levelColors: Record<LogEntry['level'], string> = {
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  debug: '#6b7280',
  success: '#10b981',
};

const levelPrefix: Record<LogEntry['level'], string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERR ',
  debug: 'DBG ',
  success: 'PASS',
};

function LogLine({ entry }: { entry: LogEntry }) {
  const color = levelColors[entry.level];
  return (
    <View style={styles.logLine}>
      <Text style={[styles.prefix, { color }]}>[{levelPrefix[entry.level]}]</Text>
      {entry.timestamp && (
        <Text style={styles.timestamp}>{formatTime(entry.timestamp)}</Text>
      )}
      <Text style={[styles.message, { color: entry.level === 'error' ? color : '#e5e5e7' }]}>
        {entry.message}
      </Text>
    </View>
  );
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

export function LiveConsole({ logs, autoScroll = true, style }: LiveConsoleProps) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<LogEntry>>(null);

  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [autoScroll, logs.length]);

  return (
    <View style={[styles.container, { backgroundColor: '#0d1117', borderColor: colors.borderColor }, style]}>
      <FlatList
        ref={listRef}
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LogLine entry={item} />}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Waiting for logs...</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', minHeight: 200, maxHeight: 400 },
  content: { padding: spacing.md },
  logLine: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  prefix: { fontFamily: 'Menlo', fontSize: 12, fontWeight: '600', width: 40 },
  timestamp: { fontFamily: 'Menlo', fontSize: 11, color: '#484f58' },
  message: { fontFamily: 'Menlo', fontSize: 12, flex: 1 },
  emptyText: { fontFamily: 'Menlo', fontSize: 12, color: '#484f58', textAlign: 'center' },
});
