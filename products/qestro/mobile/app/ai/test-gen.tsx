import { useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../src/hooks/useTheme';
import { aiApi } from '../../src/lib/api';
import { radius, spacing, touchTarget, typography } from '../../src/theme/tokens';
import { Button } from '../../src/components/atoms';
import { Header, ChatBubble, CodeViewer } from '../../src/components/molecules';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  code?: string;
}

export default function TestGenScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const addMsg = (text: string, isUser: boolean, code?: string) => {
    const msg: Message = { id: Date.now().toString(), text, isUser, timestamp: new Date().toISOString(), code };
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    return msg;
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMsg(text, true);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (!conversationId) {
        const res = await aiApi.startConversation({ context: text });
        if (res.data) {
          setConversationId(res.data.conversationId);
          addMsg(res.data.question, false);
        }
      } else {
        const res = await aiApi.answerQuestion(conversationId, text);
        if (res.data?.question) addMsg(res.data.question, false);
        if (res.data?.code) addMsg('Here is your generated test:', false, res.data.code);
        if (res.data?.done) setConversationId(null);
      }
    } catch {
      addMsg('Something went wrong. Please try again.', false);
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationId]);

  const renderItem = ({ item }: { item: Message }) => (
    <View>
      <ChatBubble message={item.text} isUser={item.isUser} timestamp={item.timestamp} />
      {item.code && <CodeViewer code={item.code} language="typescript" style={styles.codeBlock} />}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="AI Test Generator" showBack />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      <View style={[styles.inputRow, { backgroundColor: colors.bgSecondary, borderTopColor: colors.borderColor }]}>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          value={input}
          onChangeText={setInput}
          placeholder={conversationId ? 'Answer the question...' : 'Describe your test scenario...'}
          placeholderTextColor={colors.textMuted}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <Button variant="primary" size="sm" onPress={handleSend} disabled={!input.trim() || loading}>
          <Send size={18} color="#fff" />
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.base, paddingBottom: spacing.lg },
  codeBlock: { marginBottom: spacing.md },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, ...typography.body, maxHeight: 100,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.card, minHeight: touchTarget.minHeight,
  },
});
