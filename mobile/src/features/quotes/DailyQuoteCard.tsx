import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { getTodayQuote, DailyQuote } from '../../services/quotes';

const CREAM = '#FFF4E0';
const SAND = '#F3DDB8';

export default function DailyQuoteCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { spacing, radius, typography } = theme;
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
        borderRadius: 28,
        shadowColor: '#5A3414',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
      }}
    >
      <LinearGradient
        colors={['#B98045', '#9A6735', '#6E4220']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 28, padding: spacing.lg, overflow: 'hidden' }}
      >
        {/* decorative giant quote mark + glow */}
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -26,
            right: 8,
            fontSize: 150,
            lineHeight: 170,
            fontWeight: '800',
            color: 'rgba(255,255,255,0.12)',
          }}
        >
          “
        </Text>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -60,
            left: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: 'rgba(255,230,180,0.14)',
          }}
        />

        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 11,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sunny" size={16} color={CREAM} />
            </View>
            <Text
              style={[typography.bodySmall, { color: CREAM, fontWeight: '800' }]}
              numberOfLines={1}
            >
              {t('quote.title')}
            </Text>
          </View>

          <Pressable
            onPress={() => navigation.navigate('DailyQuoteHistory')}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              paddingLeft: spacing.sm + 2,
              paddingRight: spacing.xs + 2,
              paddingVertical: spacing.xs,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <Text style={[typography.caption, { color: CREAM, fontWeight: '700' }]}>
              {t('quote.previous7')}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={CREAM} />
          </Pressable>
        </View>

        {/* body */}
        {loading ? (
          <Text
            style={[
              typography.bodySmall,
              { color: CREAM, marginTop: spacing.lg, opacity: 0.7 },
            ]}
          >
            …
          </Text>
        ) : published && quote ? (
          <>
            <Text
              style={[
                typography.body,
                {
                  color: '#FFFFFF',
                  marginTop: spacing.lg,
                  fontSize: 19,
                  lineHeight: 28,
                  fontStyle: 'italic',
                  fontWeight: '500',
                },
              ]}
            >
              {quote.quoteText}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: spacing.md,
              }}
            >
              <View style={{ width: 22, height: 2, borderRadius: 1, backgroundColor: SAND }} />
              <Text
                style={[
                  typography.caption,
                  { color: SAND, fontWeight: '800', flexShrink: 1 },
                ]}
              >
                {quote.source}
              </Text>
            </View>
          </>
        ) : (
          <View
            style={{
              marginTop: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <Ionicons name="leaf-outline" size={20} color={SAND} />
            <Text
              style={[
                typography.body,
                { color: '#FFFFFF', opacity: 0.92, flex: 1 },
              ]}
            >
              {t('quote.noQuoteToday')}
            </Text>
          </View>
        )}

        {/* action */}
        <Pressable
          onPress={() => navigation.navigate('DailyQuoteComposer')}
          disabled={published}
          style={{
            marginTop: spacing.lg,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md + 2,
            borderRadius: radius.md + 6,
            backgroundColor: published ? 'rgba(255,255,255,0.12)' : CREAM,
            borderWidth: 1,
            borderColor: published ? 'rgba(255,255,255,0.3)' : CREAM,
            opacity: published ? 0.75 : 1,
          }}
        >
          <Ionicons
            name={published ? 'checkmark-circle' : 'add-circle'}
            size={16}
            color={published ? CREAM : '#9A6735'}
          />
          <Text
            style={[
              typography.caption,
              { color: published ? CREAM : '#7A4B22', fontWeight: '800' },
            ]}
          >
            {published ? t('quote.alreadyPublished') : t('quote.addToday')}
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}