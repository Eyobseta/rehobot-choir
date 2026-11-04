import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { useHelpTr } from './helpStrings';
import type { HelpMessageModel } from './helpTypes';

function renderAnswer(text: string, color: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 22 }}>
      {parts.map((p, i) =>
        !p ? null : i % 2 === 1 ? (
          <Text key={i} style={{ fontWeight: '800' }}>{p}</Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

export default function HelpMessage({
  message,
  onOpenDeepLink,
  onFeedback,
}: {
  message: HelpMessageModel;
  onOpenDeepLink: (key: string) => void;
  onFeedback: (messageId: string, feedback: 'UP' | 'DOWN') => void;
}) {
  const tr = useHelpTr();
  const { theme } = useTheme();
  const { colors } = theme;

  if (message.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: 14 }}>
        <View
          style={{
            maxWidth: '82%',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 18,
            borderBottomRightRadius: 5,
            backgroundColor: BRAND.violet,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 15 }}>{message.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'flex-start', marginVertical: 4, paddingHorizontal: 14 }}>
      <View
        style={{
          maxWidth: '92%',
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {renderAnswer(message.text, colors.text)}

        {message.deepLink ? (
          <Pressable
            onPress={() => onOpenDeepLink(message.deepLink as string)}
            accessibilityRole="button"
            style={{
              marginTop: 10,
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: withAlpha(BRAND.violet, 0.12),
            }}
          >
            <Ionicons name="arrow-forward-circle" size={16} color={BRAND.violet} />
            <Text style={{ color: BRAND.violet, fontWeight: '800', fontSize: 13 }}>
              {tr('openAction')}
            </Text>
          </Pressable>
        ) : null}

        {message.logId ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1 }}>
              {message.feedback ? tr('feedbackThanks') : tr('feedbackHelpful')}
            </Text>
            {!message.feedback ? (
              <>
                <Pressable
                  onPress={() => onFeedback(message.id, 'UP')}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: withAlpha(colors.success, 0.12),
                  }}
                >
                  <Ionicons name="thumbs-up" size={14} color={colors.success} />
                </Pressable>
                <Pressable
                  onPress={() => onFeedback(message.id, 'DOWN')}
                  hitSlop={8}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: withAlpha(colors.error, 0.12),
                  }}
                >
                  <Ionicons name="thumbs-down" size={14} color={colors.error} />
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}