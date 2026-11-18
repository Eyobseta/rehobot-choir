import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Animated,
  Easing,
  Platform,
  Share,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { useTodayQuoteQuery } from '../home/useHomeData';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import {
  ethTodayFromInstant,
  formatEthDate,
  isValidEthDate,
} from '../../utils/ethiopianCalendar';

/**
 * Daily Quote card — "golden hour" edition.
 *
 * Logic is unchanged: cached-first query, tap card -> DailyQuoteDetail,
 * "previous" -> DailyQuoteHistory, CTA -> DailyQuoteComposer (only when no
 * quote is published yet). Everything new is pure JS (OTA-safe).
 */

const CREAM = '#FAF3EB';
const SAND = '#D3C3F8';
const INK = '#1D4550';
const SHADOW = '#0E262C';

// Serif for the quote body (system fonts only — no asset/rebuild needed).
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/** Loop a 0 -> 1 -> 0 value (used for gentle pulses). */
function usePulse(active: boolean, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, active, duration]);
  return v;
}

export default function DailyQuoteCard() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { spacing } = theme;
  const navigation = useNavigation<any>();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  const reduce = useReduceMotion();

  // Cached-first: renders cached quote immediately, revalidates in background.
  const { data: quote, isPending, isError, refetch } = useTodayQuoteQuery();

  // Only show the skeleton when there is genuinely no cache.
  const loading = isPending && quote === undefined;
  const failed = isError && quote === undefined;
  const published = !!quote;

  // ---------- Motion ----------
  const sun = usePulse(!reduce, 2600);
  const skeleton = usePulse(loading, 850);
  const ctaPulse = usePulse(!reduce && !published && !loading, 1100);

  const press = useRef(new Animated.Value(1)).current;
  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 5, useNativeDriver: true }).start();

  // Light sweep across the card every few seconds.
  const [w, setW] = useState(0);
  const sheen = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!w || reduce) return;
    sheen.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(6000),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [w, reduce, sheen]);

  // Cross-fade the body whenever the quote (or the state) changes.
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [quote?.id, loading, failed, fade]);

  // ---------- Derived ----------
  const ethDate = quote
    ? { year: quote.dateEthYear, month: quote.dateEthMonth, day: quote.dateEthDay }
    : null;
  const dateLabel =
    ethDate && isValidEthDate(ethDate)
      ? formatEthDate(ethDate, lang)
      : quote
        ? quote.dateGregorian
        : formatEthDate(ethTodayFromInstant(new Date()), lang);

  const mp = quote?.submittedBy?.memberProfile;
  const publisherName = (mp?.fullName ?? '').trim();
  const publisherPhoto = mp?.profilePhotoUrl ?? null;

  const len = quote?.quoteText.length ?? 0;
  const fontSize = len > 180 ? 17 : len > 100 ? 19 : 22;
  const lineHeight = Math.round(fontSize * 1.5);

  const onShare = () => {
    if (!quote) return;
    Share.share({ message: `“${quote.quoteText}”\n— ${quote.source}` }).catch(() => {});
  };

  const openDetail = () => quote && navigation.navigate('DailyQuoteDetail', { quote });

  return (
    <Animated.View
      style={{
        marginBottom: spacing.lg,
        borderRadius: 30,
        transform: [{ scale: press }],
        shadowColor: SHADOW,
        shadowOpacity: 0.45,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 14 },
        elevation: 12,
      }}
    >
      <Pressable
        onPress={openDetail}
        onPressIn={() => quote && pressTo(0.98)}
        onPressOut={() => pressTo(1)}
        disabled={!quote}
        accessibilityRole="button"
        accessibilityLabel={
          quote ? `${t('quote.title')}: ${quote.quoteText}` : t('quote.title')
        }
        style={{ borderRadius: 30 }}
      >
        <LinearGradient
          colors={['#102A31', '#1D4550', '#2F6B78']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={{ borderRadius: 30, padding: 20, overflow: 'hidden' }}
        >
          {/* ---------- Decoration ---------- */}
          {/* soft sun, tucked into the bottom corner so nothing sits behind the header buttons */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -70,
              right: -50,
              width: 170,
              height: 170,
              borderRadius: 85,
              backgroundColor: withAlpha(BRAND.lavender, 0.14),
              transform: [
                { scale: sun.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
              ],
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 34,
              right: 34,
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: withAlpha(BRAND.lime, 0.6),
              transform: [{ rotate: '45deg' }],
            }}
          />

          {/* giant quote mark */}
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 38,
              left: 10,
              fontSize: 150,
              lineHeight: 170,
              fontWeight: '800',
              fontFamily: SERIF,
              color: 'rgba(255,255,255,0.08)',
            }}
          >
            “
          </Text>

          {/* light sweep */}
          {w > 0 && !reduce ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -40,
                left: 0,
                width: 54,
                height: 400,
                backgroundColor: 'rgba(250,243,235,0.10)',
                transform: [
                  {
                    translateX: sheen.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-90, w + 60],
                    }),
                  },
                  { rotate: '18deg' },
                ],
              }}
            />
          ) : null}

          {/* ---------- Header ---------- */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: BRAND.gold,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: BRAND.gold,
                shadowOpacity: 0.5,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Ionicons name="sunny" size={21} color={INK} />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: SAND,
                  fontSize: 10.5,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                }}
                numberOfLines={1}
              >
                {t('quote.title')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text
                  style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800', flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {dateLabel}
                </Text>
                {published ? (
                  <View
                    accessibilityLabel={t('quote.alreadyPublished')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 8,
                      backgroundColor: 'rgba(255,255,255,0.16)',
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={11} color={BRAND.gold} />
                  </View>
                ) : null}
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('DailyQuoteHistory')}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                paddingLeft: 11,
                paddingRight: 7,
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.13)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.22)',
              })}
            >
              <Text style={{ color: CREAM, fontSize: 11.5, fontWeight: '800' }} numberOfLines={1}>
                {t('quote.previous7')}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={CREAM} />
            </Pressable>
          </View>

          {/* ---------- Body ---------- */}
          {loading ? (
            <View style={{ marginTop: spacing.lg + 4, gap: 10 }}>
              {[1, 0.92, 0.6].map((frac, i) => (
                <Animated.View
                  key={i}
                  style={{
                    height: 14,
                    width: `${frac * 100}%`,
                    borderRadius: 7,
                    backgroundColor: 'rgba(255,255,255,0.28)',
                    opacity: skeleton.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  }}
                />
              ))}
            </View>
          ) : quote ? (
            <Animated.View
              style={{
                opacity: fade,
                transform: [
                  { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                ],
              }}
            >
              <Text
                numberOfLines={6}
                style={{
                  marginTop: spacing.lg + 4,
                  color: '#FFFFFF',
                  fontSize,
                  lineHeight,
                  fontFamily: SERIF,
                  fontStyle: 'italic',
                  fontWeight: '500',
                  letterSpacing: 0.2,
                  textShadowColor: 'rgba(0,0,0,0.25)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                {quote.quoteText}
              </Text>

              {/* source */}
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}
              >
                <View
                  style={{ width: 26, height: 2, borderRadius: 1, backgroundColor: BRAND.gold }}
                />
                <Text
                  style={{
                    color: SAND,
                    fontSize: 12.5,
                    fontWeight: '800',
                    letterSpacing: 0.3,
                    flexShrink: 1,
                  }}
                  numberOfLines={2}
                >
                  {quote.source}
                </Text>
              </View>

              {/* footer: publisher + actions */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 16,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.16)',
                }}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {publisherName ? (
                    <>
                      {publisherPhoto ? (
                        <Image
                          source={{ uri: publisherPhoto }}
                          style={{ width: 26, height: 26, borderRadius: 13 }}
                        />
                      ) : (
                        <View style={{ backgroundColor: BRAND.lime, 
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Text style={{ color: BRAND.teal, fontSize: 12, fontWeight: '800' }}>
                            {publisherName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={{ color: CREAM, fontSize: 11.5, fontWeight: '700', flex: 1 }}
                        numberOfLines={1}
                      >
                        {t('quote.publishedBy', {
                          name: publisherName,
                          defaultValue: 'Published by {{name}}',
                        })}
                      </Text>
                    </>
                  ) : null}

                  {/* media hints */}
                  {quote.audioUrl ? (
                    <Ionicons name="headset" size={15} color={withAlpha(CREAM, 0.85)} />
                  ) : null}
                  {quote.youtubeUrl ? (
                    <Ionicons name="logo-youtube" size={16} color={withAlpha(CREAM, 0.85)} />
                  ) : null}
                </View>

                <Pressable
                  onPress={onShare}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('quote.share', { defaultValue: 'Share' })}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.22)',
                  })}
                >
                  <Ionicons name="share-social" size={16} color={CREAM} />
                </Pressable>

                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: BRAND.gold,
                  }}
                >
                  <Ionicons name="arrow-forward" size={17} color={INK} />
                </View>
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              style={{
                opacity: fade,
                marginTop: spacing.lg + 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.14)',
                }}
              >
                <Ionicons name={failed ? 'cloud-offline-outline' : 'leaf-outline'} size={22} color={SAND} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 21 }}>
                  {failed
                    ? t('quote.loadFailed', { defaultValue: "Couldn't load today's quote." })
                    : t('quote.noQuoteToday')}
                </Text>
                {failed ? (
                  <Pressable onPress={() => refetch()} hitSlop={8} style={{ marginTop: 4 }}>
                    <Text style={{ color: BRAND.gold, fontSize: 12.5, fontWeight: '800' }}>
                      {t('common.retry', { defaultValue: 'Tap to retry' })}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          )}

          {/* ---------- CTA (only while nothing is published) ---------- */}
          {!published && !loading ? (
            <Animated.View
              style={{
                marginTop: spacing.lg,
                alignSelf: 'flex-start',
                transform: [
                  { scale: ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
                ],
              }}
            >
              <Pressable
                onPress={() => navigation.navigate('DailyQuoteComposer')}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: pressed ? SAND : CREAM,
                  shadowColor: SHADOW,
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 5,
                })}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: INK,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={16} color={CREAM} />
                </View>
                <Text style={{ color: INK, fontSize: 13, fontWeight: '800' }}>
                  {t('quote.addToday')}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}