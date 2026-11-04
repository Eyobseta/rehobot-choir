import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND } from '../auth/Auth_UI';
import { useHelpContext } from './HelpContext';
import { matchHelpQuery, pickAnswer, suggestCategories } from './helpMatcher';
import { resolveDeepLink } from './helpDeepLinks';
import { logHelpQuery, sendHelpFeedback } from './helpApi';
import { useHelpTr, pickLanguage, type HelpTrKey } from './helpStrings';
import HelpMessage from './HelpMessage';
import type { HelpLanguage, HelpMessageModel } from './helpTypes';

let seq = 0;
const newId = () => `help_${Date.now().toString(36)}_${++seq}`;

export default function HelpModal({
  visible,
  onClose,
  navigationRef,
}: {
  visible: boolean;
  onClose: () => void;
  navigationRef: NavigationContainerRefWithCurrent<any>;
}) {
  const tr = useHelpTr();
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();
  const lang: HelpLanguage = pickLanguage(i18n.language);

  const { entries, role, currentRoute } = useHelpContext();
  const [messages, setMessages] = useState<HelpMessageModel[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setMessages([]);
      setInput('');
      setThinking(false);
    }
  }, [visible]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length, thinking]);

  const send = async (raw: string) => {
    const query = raw.trim();
    if (!query || thinking) return;
    setInput('');
    setThinking(true);

    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', text: query, createdAt: Date.now() },
    ]);

    const match = matchHelpQuery(query, entries, {
      role,
      language: lang,
      currentScreen: currentRoute ?? undefined,
    });

    if (!match) {
      const cats = suggestCategories(entries, role, 6);
      const text = `${tr('fallbackTitle')}\n\n${tr('fallbackBody')}\n\n• ${cats.join('\n• ')}\n\n${tr('fallbackContact')}`;
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', text, createdAt: Date.now() },
      ]);
      setThinking(false);
      void logHelpQuery({
        screen: currentRoute ?? undefined,
        language: lang,
        rawQuery: query,
        matchedEntryId: null,
        matchScore: 0,
      });
      return;
    }

    const answer = pickAnswer(match.entry, lang);
    const logPromise = logHelpQuery({
      screen: currentRoute ?? undefined,
      language: lang,
      rawQuery: query,
      matchedEntryId: match.entry.id,
      matchScore: match.score,
    });

    const botId = newId();
    setMessages((prev) => [
      ...prev,
      {
        id: botId,
        role: 'assistant',
        text: answer,
        deepLink: match.entry.deepLink,
        matchedEntryId: match.entry.id,
        matchScore: match.score,
        logId: null,
        createdAt: Date.now(),
      },
    ]);
    setThinking(false);

    // Thumbs stay hidden until the server confirms the log row exists.
    const logId = await logPromise;
    if (logId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, logId } : m)),
      );
    }
  };

  const openDeepLink = (key: string) => {
    const ok = resolveDeepLink(navigationRef, key as any);
    if (ok) onClose();
  };

  const feedback = (messageId: string, kind: 'UP' | 'DOWN') => {
    const target = messages.find(
      (m) => m.id === messageId && m.role === 'assistant',
    );
    if (!target || target.feedback) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: kind } : m)),
    );
    if (target.logId) void sendHelpFeedback(target.logId, kind);
  };

  const suggestions: HelpTrKey[] = [
    'suggestion1',
    'suggestion2',
    'suggestion3',
    'suggestion4',
    'suggestion5',
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND.deep} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: BRAND.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="help-buoy" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
              {tr('title')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 }}>
              {tr('subtitle')}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={tr('close')}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && !thinking ? (
              <View style={{ padding: spacing.xl }}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                  {tr('emptyTitle')}
                </Text>
                <Text
                  style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 }}
                >
                  {tr('emptyHint')}
                </Text>

                <View style={{ marginTop: 20, gap: 8 }}>
                  {suggestions.map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => void send(tr(key))}
                      accessibilityRole="button"
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Ionicons name="sparkles" size={14} color={BRAND.magenta} />
                      <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
                        {tr(key)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <>
                {messages.map((m) => (
                  <HelpMessage
                    key={m.id}
                    message={m}
                    onOpenDeepLink={openDeepLink}
                    onFeedback={feedback}
                  />
                ))}
                {thinking ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                    }}
                  >
                    <ActivityIndicator size="small" color={BRAND.violet} />
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {tr('thinking')}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 10),
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                paddingHorizontal: 14,
                justifyContent: 'center',
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={tr('inputPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
                style={{ color: colors.text, fontSize: 15, paddingVertical: 10 }}
              />
            </View>
            <Pressable
              onPress={() => void send(input)}
              disabled={thinking || input.trim().length === 0}
              accessibilityRole="button"
              accessibilityLabel={tr('send')}
              style={{ opacity: thinking || input.trim().length === 0 ? 0.5 : 1 }}
            >
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}