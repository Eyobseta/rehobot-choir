import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { listRecentQuotes, DailyQuote } from '../../services/quotes';
import { BRAND, withAlpha } from '../auth/Auth_UI';

const BROWN = '#9A6735';

/** Who published the quote (from DailyQuote.submittedBy). */
function publisherOf(item: DailyQuote): { name: string | null; photo: string | null } {
  const mp = item.submittedBy?.memberProfile;
  return {
    name: (mp?.fullName ?? '').trim() || null,
    photo: mp?.profilePhotoUrl ?? null,
  };
}

export default function DailyQuoteHistoryScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [items, setItems] = useState<DailyQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listRecentQuotes(7));
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: withAlpha(BROWN, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={BROWN} />
          </View>
          <Text
            style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
          >
            {t('quote.empty')}
          </Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const isLatest = index === 0;
        const isLast = index === items.length - 1;
        return (
          <View style={{ flexDirection: 'row' }}>
            {/* timeline rail */}
            <View style={{ width: 22, alignItems: 'center', marginRight: spacing.sm }}>
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  marginTop: spacing.lg,
                  borderWidth: 3,
                  borderColor: BROWN,
                  backgroundColor: isLatest ? BROWN : colors.background,
                }}
              />
              {!isLast && (
                <View
                  style={{
                    flex: 1,
                    width: 2,
                    marginTop: 4,
                    borderRadius: 1,
                    backgroundColor: withAlpha(BROWN, 0.28),
                  }}
                />
              )}
            </View>

            {/* card */}
            <View
              style={{
                flex: 1,
                padding: spacing.md + 2,
                marginBottom: spacing.md,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: isLatest ? withAlpha(BROWN, 0.55) : colors.border,
                backgroundColor: colors.surface,
                overflow: 'hidden',
              }}
            >
              <Text
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -14,
                  right: 10,
                  fontSize: 84,
                  lineHeight: 100,
                  fontWeight: '800',
                  color: withAlpha(BROWN, 0.1),
                }}
              >
                “
              </Text>

              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: 10,
                  backgroundColor: withAlpha(BRAND.violet, 0.12),
                }}
              >
                <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}>
                  {item.dateOnly.slice(0, 10)}
                </Text>
              </View>

              <Text
                style={[
                  typography.body,
                  {
                    color: colors.text,
                    marginTop: spacing.sm,
                    fontStyle: 'italic',
                    lineHeight: 24,
                  },
                ]}
              >
                {item.quoteText}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: spacing.sm + 2,
                }}
              >
                <View style={{ width: 18, height: 2, borderRadius: 1, backgroundColor: BROWN }} />
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, fontWeight: '700', flexShrink: 1 },
                  ]}
                >
                  {item.source}
                </Text>
              </View>

              {/* published by */}
              {(() => {
                const pub = publisherOf(item);
                const name =
                  pub.name ?? t('quote.unknownPublisher', { defaultValue: 'a choir member' });
                return (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      marginTop: spacing.md,
                      paddingTop: spacing.sm + 2,
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    {pub.photo ? (
                      <Image
                        source={{ uri: pub.photo }}
                        style={{ width: 26, height: 26, borderRadius: 13 }}
                      />
                    ) : (
                      <LinearGradient
                        colors={[BRAND.violet, BRAND.magenta]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSecondary, flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {t('quote.publishedBy', {
                        name,
                        defaultValue: 'Published by {{name}}',
                      })}
                    </Text>
                  </View>
                );
              })()}
            </View>
          </View>
        );
      }}
    />
  );
}