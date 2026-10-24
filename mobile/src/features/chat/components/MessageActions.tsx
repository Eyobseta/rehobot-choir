import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeContext';
import { BRAND, withAlpha } from '../../auth/Auth_UI';
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
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: myEmojis.includes(e) ? withAlpha(BRAND.violet, 0.25) : 'transparent',
      }}
    >
      <Text style={{ fontSize: 26 }}>{e}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8 }}>
            {QUICK_EMOJIS.map(emojiBtn)}
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.background,
              }}
              accessibilityLabel={tr('more')}
            >
              <Ionicons name={expanded ? 'chevron-down' : 'add'} size={24} color={colors.text} />
            </Pressable>
          </View>

          {expanded ? (
            <ScrollView style={{ maxHeight: 190, marginTop: 8 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 8 }}>
              {ALL_EMOJIS.map(emojiBtn)}
            </ScrollView>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />

          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => {
                onClose();
                setTimeout(a.onPress, 120);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingHorizontal: 22,
                paddingVertical: 13,
                backgroundColor: pressed ? withAlpha(BRAND.violet, 0.08) : 'transparent',
              })}
            >
              <Ionicons name={a.icon} size={22} color={a.danger ? colors.error : colors.text} />
              <Text style={{ color: a.danger ? colors.error : colors.text, fontSize: 16, fontWeight: '600' }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
