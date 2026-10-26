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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { listRecentQuotes, DailyQuote } from '../../services/quotes';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { formatEthDate } from '../../utils/ethiopianCalendar'; // NEW

const BROWN = '#9A6735';
const CREAM = '#FFF4E0';

function publisherOf(item: DailyQuote): { name: string | null; photo: string | null } {
  const mp = item.submittedBy?.memberProfile;
  return {
    name: (mp?.fullName ?? '').trim() || null,
    photo: mp?.profilePhotoUrl ?? null,
  };
}

export default function DailyQuoteHistoryScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Full-bleed amber hero ---------- */}
      <LinearGradient
        colors={['#C98B4A', '#A56B36', '#6E4220']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}
      >
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -34,
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
            top: -40,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: 'rgba(255,215,140,0.14)',
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.24)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="time" size={22} color={CREAM} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('quote.title')}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('quote.previous7')}
            </Text>
          </View>

          <GlassBackButton
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            size={44}
          />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BROWN} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={BROWN}
              colors={[BROWN]}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={['#C98B4A', '#A56B36', '#6E4220']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={BROWN} />
                </View>
              </LinearGradient>
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
            const pub = publisherOf(item);
            const name =
              pub.name ?? t('quote.unknownPublisher', { defaultValue: 'a choir member' });

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
                      backgroundColor: withAlpha(BROWN, 0.14),
                    }}
                  >
                    <Ionicons name="calendar-outline" size={12} color={BROWN} />
                    {/* FIXED: use formatEthDate with the Ethiopian date fields */}
                    <Text style={[typography.caption, { color: BROWN, fontWeight: '800' }]}>
                      {formatEthDate(
                        {
                          year: item.dateEthYear,
                          month: item.dateEthMonth,
                          day: item.dateEthDay,
                        },
                        'en',
                      )}
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
                        fontSize: 15.5,
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
                      style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
                      numberOfLines={1}
                    >
                      {t('quote.publishedBy', {
                        name,
                        defaultValue: 'Published by {{name}}',
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}