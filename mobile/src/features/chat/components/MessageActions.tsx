import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeContext';
import { withAlpha } from '../../auth/Auth_UI';
import { QUICK_EMOJIS, ALL_EMOJIS } from '../chatUtils';
import { useTr } from '../chatStrings';

export type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onPress: () => void;
};

export function MessageActions({
  visible,
  actions,
  myEmojis,
  onReact,
  onClose,
}: {
  visible: boolean;
  actions: ActionItem[];
  myEmojis: string[];
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  const emojiBtn = (e: string) => (
    <Pressable
      key={e}
      onPress={() => {
        onReact(e);
        onClose();
      }}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: myEmojis.includes(e) ? withAlpha(colors.primary, 0.25) : 'transparent',
        transform: [{ scale: pressed ? 0.9 : 1 }],
      })}
    >
      <Text style={{ fontSize: 26 }}>{e}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            style={{ alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }}
          />

          {/* Reaction bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              marginHorizontal: 14,
              paddingVertical: 6,
              paddingHorizontal: 4,
              borderRadius: 26,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {QUICK_EMOJIS.map(emojiBtn)}
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceAlt,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel={tr('more')}
            >
              <Ionicons name={expanded ? 'chevron-down' : 'add'} size={22} color={colors.text} />
            </Pressable>
          </View>

          {expanded ? (
            <ScrollView
              style={{ maxHeight: 190, marginTop: 8 }}
              contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 8 }}
            >
              {ALL_EMOJIS.map(emojiBtn)}
            </ScrollView>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 6, marginHorizontal: 14 }} />

          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => {
                onClose();
                setTimeout(a.onPress, 120);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                marginHorizontal: 8,
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 18,
                backgroundColor: pressed ? withAlpha(colors.primary, 0.08) : 'transparent',
              })}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: a.danger ? withAlpha(colors.error, 0.14) : withAlpha(colors.accent, 0.14),
                }}
              >
                <Ionicons name={a.icon} size={20} color={a.danger ? colors.error : colors.accent} />
              </View>
              <Text style={{ color: a.danger ? colors.error : colors.text, fontSize: 16, fontWeight: '700' }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}