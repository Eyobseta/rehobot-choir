import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useTodayQuoteQuery } from '../home/useHomeData';

const CREAM = '#FFF4E0';
const SAND = '#F3DDB8';

export default function DailyQuoteCard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { spacing, radius, typography } = theme;
  const navigation = useNavigation<any>();

  // Cached-first: renders cached quote immediately, revalidates in background.
  const { data: quote, isPending, isError } = useTodayQuoteQuery();

  // Only show the "loading" ellipsis when there is genuinely no cache.
  const loading = isPending && quote === undefined;
  const published = !!quote;

  // Same UI as before, driven by cached data.
  return (
    <View
      style={{
        marginBottom: spacing.lg,
        borderRadius: 28,
        shadowColor: '#3A1F08',
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      }}
    >
      <Pressable
        onPress={() => quote && navigation.navigate('DailyQuoteDetail', { quote })}
        disabled={!quote}
        accessibilityRole="button"
        style={{ borderRadius: 28 }}
      >
        <LinearGradient
          colors={['#C98B4A', '#A56B36', '#6E4220']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 28, padding: spacing.lg, overflow: 'hidden' }}
        >
          {/* ... unchanged decorative elements ... */}
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -30,
              right: 6,
              fontSize: 170,
              lineHeight: 190,
              fontWeight: '800',
              color: 'rgba(255,255,255,0.14)',
            }}
          >
            “
          </Text>

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -70,
              left: -50,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,232,180,0.16)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -40,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: 'rgba(255,215,140,0.14)',
            }}
          />

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
                  width: 32,
                  height: 32,
                  borderRadius: 11,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="sunny" size={17} color={CREAM} />
              </View>
              <Text
                style={[typography.bodySmall, { color: CREAM, fontWeight: '800', letterSpacing: 0.4 }]}
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
                gap: 3,
                paddingLeft: spacing.sm + 2,
                paddingRight: spacing.xs + 2,
                paddingVertical: spacing.xs + 1,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            >
              <Text style={[typography.caption, { color: CREAM, fontWeight: '800' }]}>
                {t('quote.previous7')}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={CREAM} />
            </Pressable>
          </View>

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
                    fontSize: 20,
                    lineHeight: 30,
                    fontStyle: 'italic',
                    fontWeight: '500',
                    letterSpacing: 0.2,
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
                  marginTop: spacing.md + 2,
                }}
              >
                <View style={{ width: 24, height: 2, borderRadius: 1, backgroundColor: SAND }} />
                <Text
                  style={[
                    typography.caption,
                    { color: SAND, fontWeight: '800', flexShrink: 1, letterSpacing: 0.3 },
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
              shadowColor: published ? 'transparent' : '#3A1F08',
              shadowOpacity: published ? 0 : 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Ionicons
              name={published ? 'checkmark-circle' : 'add-circle'}
              size={16}
              color={published ? CREAM : '#7A4B22'}
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
      </Pressable>
    </View>
  );
}