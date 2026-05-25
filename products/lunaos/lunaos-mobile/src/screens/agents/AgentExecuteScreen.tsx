/**
 * Agent execution screen — input context, stream SSE output.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeColors } from '../../hooks/useThemeColors';
import { spacing, radii, typography, TOUCH_TARGET } from '../../theme';
import { Button } from '../../components/Button';
import { useExecutionStore } from '../../store/executionStore';
import type { AgentsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AgentsStackParamList, 'AgentExecute'>;

export function AgentExecuteScreen({ route }: Props): React.ReactElement {
  const { slug, name, category } = route.params;
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);

  const {
    output,
    isStreaming,
    streamError,
    executionId,
    durationMs,
    ragSources,
    run,
    reset,
  } = useExecutionStore();

  const [context, setContext] = useState('');

  const handleRun = useCallback(async () => {
    if (!context.trim()) return;
    reset();
    await run({ agent: slug, context: context.trim() });
  }, [slug, context, run, reset]);

  const hasOutput = output.length > 0 || isStreaming;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
      >
        <View style={styles.header}>
          <Text style={[styles.agentName, { color: colors.textPrimary }]}>
            {name}
          </Text>
          <Text style={[styles.category, { color: colors.textTertiary }]}>
            {category}
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Context
          </Text>
          <RNTextInput
            style={[
              styles.contextInput,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              },
            ]}
            value={context}
            onChangeText={setContext}
            placeholder="Describe what you need help with..."
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            editable={!isStreaming}
            accessibilityLabel="Agent context input"
            accessibilityHint="Describe what you need help with"
            allowFontScaling={true}
            maxFontSizeMultiplier={1.5}
          />
        </View>

        <Button
          title={isStreaming ? 'Running...' : 'Run Agent'}
          onPress={handleRun}
          loading={isStreaming}
          disabled={!context.trim()}
          style={styles.runButton}
        />

        {ragSources !== null && ragSources > 0 ? (
          <View style={[styles.ragBadge, { backgroundColor: colors.fill }]}>
            <Text style={[styles.ragText, { color: colors.accent }]}>
              RAG: {ragSources} sources injected
            </Text>
          </View>
        ) : null}

        {hasOutput ? (
          <View
            style={[
              styles.outputBox,
              { backgroundColor: colors.surface, borderColor: colors.cardBorder },
            ]}
          >
            <Text
              style={[styles.outputText, { color: colors.textPrimary }]}
              selectable
            >
              {output}
              {isStreaming ? '\u2588' : ''}
            </Text>
          </View>
        ) : null}

        {streamError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.error + '1A' }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {streamError}
            </Text>
          </View>
        ) : null}

        {executionId ? (
          <View style={styles.meta}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              Execution: {executionId.slice(0, 8)}...
            </Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              Duration: {((durationMs ?? 0) / 1000).toFixed(1)}s
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.md },
  agentName: { ...typography.title1 },
  category: { ...typography.footnote, textTransform: 'capitalize', marginTop: 2 },
  inputSection: { marginBottom: spacing.md },
  label: { ...typography.subheadline, marginBottom: spacing.xs },
  contextInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    ...typography.body,
  },
  runButton: { marginBottom: spacing.md },
  ragBadge: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  ragText: { ...typography.caption, fontWeight: '600' },
  outputBox: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: TOUCH_TARGET * 2,
  },
  outputText: { ...typography.body, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  errorBox: { padding: spacing.md, borderRadius: radii.sm, marginBottom: spacing.md },
  errorText: { ...typography.footnote },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { ...typography.caption },
});
