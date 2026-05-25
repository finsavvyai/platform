import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { radius, spacing, touchTarget } from '../../theme/tokens';

interface CodeViewerProps {
  code: string;
  language?: string;
  maxHeight?: number;
  style?: ViewStyle;
}

export function CodeViewer({ code, language, maxHeight = 300, style }: CodeViewerProps) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.container, { backgroundColor: '#0d1117', borderColor: colors.borderColor }, style]}>
      <View style={[styles.header, { borderBottomColor: colors.borderColor }]}>
        {language && <Text style={styles.lang}>{language}</Text>}
        <Pressable onPress={handleCopy} style={styles.copyBtn} accessibilityLabel="Copy code">
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#8b949e" />}
          <Text style={[styles.copyText, { color: copied ? '#10b981' : '#8b949e' }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight }} contentContainerStyle={styles.codeContainer}>
        <Text style={styles.code}>{code}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lang: { fontFamily: 'Menlo', fontSize: 11, color: '#8b949e' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    minWidth: touchTarget.minWidth, minHeight: 28, justifyContent: 'center',
  },
  copyText: { fontSize: 11, fontFamily: 'Menlo' },
  codeContainer: { padding: spacing.md },
  code: { fontFamily: 'Menlo', fontSize: 12, color: '#e6edf3', lineHeight: 20 },
});
