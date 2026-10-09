import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { getTodayQuote, DailyQuote } from '../../services/quotes';

export default function DailyQuoteCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const navigation = useNavigation<any>();

  const [quote, setQuote] = useState<DailyQuote | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setQuote(await getTodayQuote());
    } catch {
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const published = !!quote;

  return (
    <View
      style={{
        marginBottom: spacing.lg,
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: '#9A6735',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={[
            typography.bodySmall,
            { color: '#E6F0DC', fontWeight: '700' },
          ]}
        >
          {t('quote.title')}
        </Text>
        <Pressable
          onPress={() =>
            navigation.navigate('DailyQuoteHistory')
          }
          style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Text
            style={[
              typography.caption,
              { color: '#E6F0DC', textDecorationLine: 'underline' },
            ]}
          >
            {t('quote.previous7')}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <Text
          style={[
            typography.bodySmall,
            { color: '#E6F0DC', marginTop: spacing.md, opacity: 0.7 },
          ]}
        >
          …
        </Text>
      ) : published && quote ? (
        <>
          <Text
            style={[
              typography.body,
              { color: '#FFFFFF', marginTop: spacing.md, lineHeight: 22, fontStyle: 'italic' },
            ]}
          >
            "{quote.quoteText}"
          </Text>
          <Text
            style={[
              typography.caption,
              { color: '#E6F0DC', marginTop: spacing.sm, fontWeight: '600' },
            ]}
          >
            — {quote.source}
          </Text>
        </>
      ) : (
        <Text
          style={[
            typography.body,
            { color: '#FFFFFF', marginTop: spacing.md, opacity: 0.9 },
          ]}
        >
          {t('quote.noQuoteToday')}
        </Text>
      )}

      <Pressable
        onPress={() => navigation.navigate('DailyQuoteComposer')}
        disabled={published}
        style={{
          marginTop: spacing.lg,
          alignSelf: 'flex-start',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          backgroundColor: published ? 'transparent' : '#E6F0DC',
          borderWidth: 1,
          borderColor: '#E6F0DC',
          opacity: published ? 0.6 : 1,
        }}
      >
        <Text
          style={[
            typography.caption,
            { color: published ? '#E6F0DC' : '#9A6735', fontWeight: '700' },
          ]}
        >
          {published ? t('quote.alreadyPublished') : t('quote.addToday')}
        </Text>
      </Pressable>
    </View>
  );
}