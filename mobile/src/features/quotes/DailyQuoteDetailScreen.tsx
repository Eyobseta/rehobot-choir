import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Easing,
  Platform,
  Share,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { DailyQuote } from '../../services/quotes';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { formatEthDate, isValidEthDate } from '../../utils/ethiopianCalendar';

const CREAM = '#FFF4E0';
const SAND = '#F3DDB8';
const INK = '#7A4B22';
const YT = '#FF0000';
const GRADIENT = ['#2E1A12', '#6E3B1C', '#A2601F'] as const;
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

// Reader text-size steps (Aa button cycles through them).
const SIZE_STEPS = [0.88, 1, 1.15, 1.3];

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/**
 * Route params:
 *   { quote: DailyQuote }  — required (every caller already passes this)
 */
export default function DailyQuoteDetailScreen({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';

  const quote: DailyQuote | undefined = route.params?.quote;

  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  const [sizeStep, setSizeStep] = useState(1);

  // Same subscription pattern as SongDetailScreen
  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  // Entrance animation (fade + rise)
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [18 + i * 8, 0],
        }),
      },
    ],
  });

  // ---------- Missing data fallback ----------
  if (!quote) {
    return (
      <LinearGradient
        colors={GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
      >
        <SunGlow reduce={reduce} top={-50} right={-40} />
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="leaf-outline" size={34} color={SAND} />
        </View>
        <Text
          style={[
            typography.body,
            { color: '#FFFFFF', marginTop: spacing.md, textAlign: 'center' },
          ]}
        >
          {t('quote.empty')}
        </Text>
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </LinearGradient>
    );
  }

  // ---------- Derived values ----------
  const ethDate = {
    year: quote.dateEthYear,
    month: quote.dateEthMonth,
    day: quote.dateEthDay,
  };
  const dateLabel = isValidEthDate(ethDate)
    ? formatEthDate(ethDate, lang)
    : quote.dateGregorian;

  const mp = quote.submittedBy?.memberProfile;
  const publisherName =
    (mp?.fullName ?? '').trim() ||
    t('quote.unknownPublisher', { defaultValue: 'a choir member' });
  const publisherPhoto = mp?.profilePhotoUrl ?? null;

  // Audio key is namespaced so it can never collide with a song id.
  const audioKey = `quote-${quote.id}`;
  const hasAudio = Boolean(quote.audioUrl);
  const hasVideo = Boolean(quote.youtubeUrl);
  const mediaTitle = quote.source || t('quote.title');

  const isThisPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === audioKey &&
    playerStatus.isPlaying;

  const onTogglePlay = async () => {
    if (!quote.audioUrl) {
      Alert.alert(t('songs.noAudio'), t('songs.noAudioBody'));
      return;
    }
    const isThisTrack = getCurrentKey() === audioKey;

    if (playerStatus.isLoaded && isThisTrack && playerStatus.isPlaying) {
      await pauseTrack();
      return;
    }
    if (isThisTrack && playerStatus.isLoaded && !playerStatus.isPlaying) {
      await resumeTrack();
      return;
    }
    await playTrack({ key: audioKey, uri: quote.audioUrl, title: mediaTitle });
  };

  const onPlayVideo = () => {
    navigation.navigate('SongVideo', {
      youtubeUrl: quote.youtubeUrl,
      title: mediaTitle,
    });
  };

  const onShare = () => {
    Share.share({ message: `“${quote.quoteText}”\n— ${quote.source}` }).catch(() => {});
  };

  // Base size shrinks for long quotes; the reader can also scale it with "Aa".
  const long = quote.quoteText.length > 180;
  const mult = SIZE_STEPS[sizeStep];
  const quoteFont = Math.round((long ? 21 : 27) * mult);
  const quoteLine = Math.round(quoteFont * 1.55);

  return (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* ---------- decoration ---------- */}
      <SunGlow reduce={reduce} top={-60} right={-50} />
      <Text
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 50,
          left: 10,
          fontSize: 260,
          lineHeight: 280,
          fontWeight: '800',
          fontFamily: SERIF,
          color: 'rgba(255,255,255,0.07)',
        }}
      >
        “
      </Text>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -100,
          left: -80,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: 'rgba(255,214,150,0.12)',
        }}
      />

      {/* ---------- Header ---------- */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 17,
            backgroundColor: BRAND.gold,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: BRAND.gold,
            shadowOpacity: 0.5,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <Ionicons name="sunny" size={24} color={INK} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: SAND,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
          >
            {t('quote.title')}
          </Text>
          <Text
            style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '800', marginTop: 2 }}
            numberOfLines={1}
          >
            {dateLabel}
          </Text>
        </View>
        <GlassBackButton
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          size={44}
        />
      </View>

      {/* ---------- Quote body ---------- */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={fadeUp(0)}>
          <Text
            style={{
              color: BRAND.gold,
              fontSize: 70,
              lineHeight: 64,
              height: 38,
              fontFamily: SERIF,
              fontWeight: '800',
            }}
          >
            “
          </Text>

          <Text
            selectable
            style={{
              marginTop: spacing.sm,
              color: '#FFFFFF',
              fontSize: quoteFont,
              lineHeight: quoteLine,
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontWeight: '500',
              letterSpacing: 0.2,
              textShadowColor: 'rgba(0,0,0,0.28)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 5,
            }}
          >
            {quote.quoteText}
          </Text>

          {/* source */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginTop: spacing.lg,
            }}
          >
            <View style={{ width: 34, height: 2, borderRadius: 1, backgroundColor: BRAND.gold }} />
            <Text
              style={[
                typography.body,
                { color: SAND, fontWeight: '800', flexShrink: 1, letterSpacing: 0.3 },
              ]}
            >
              {quote.source}
            </Text>
          </View>

          {/* reader tools */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xl }}>
            <ToolPill
              icon="share-social"
              label={t('quote.share', { defaultValue: 'Share' })}
              onPress={onShare}
            />
            <ToolPill
              text="Aa"
              label={t('quote.textSize', { defaultValue: 'Text size' })}
              onPress={() => setSizeStep((s) => (s + 1) % SIZE_STEPS.length)}
              dots={SIZE_STEPS.length}
              active={sizeStep}
            />
          </View>

          {/* ---------- YouTube ---------- */}
          {hasVideo && (
            <Pressable
              onPress={onPlayVideo}
              accessibilityRole="button"
              style={{
                marginTop: spacing.lg,
                borderRadius: 20,
                overflow: 'hidden',
                shadowColor: YT,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
            >
              <LinearGradient
                colors={[YT, '#B3001B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 16,
                  borderRadius: 20,
                }}
              >
                <Ionicons name="logo-youtube" size={22} color="#FFFFFF" />
                <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                  {t('songs.watchOnYoutube')}
                </Text>
              </LinearGradient>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>

      {/* ---------- Bottom: audio player + publisher ---------- */}
      <Animated.View
        style={[
          {
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + 16,
          },
          fadeUp(1),
        ]}
      >
        {hasAudio && (
          <Pressable
            onPress={onTogglePlay}
            accessibilityRole="button"
            accessibilityLabel={isThisPlaying ? t('songs.pause') : t('songs.playAudio')}
            style={({ pressed }) => ({
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 12,
              borderRadius: 24,
              backgroundColor: pressed ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.24)',
              borderWidth: 1,
              borderColor: isThisPlaying ? withAlpha(BRAND.gold, 0.7) : 'rgba(255,255,255,0.2)',
            })}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: BRAND.gold,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: BRAND.gold,
                shadowOpacity: isThisPlaying ? 0.6 : 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Ionicons
                name={isThisPlaying ? 'pause' : 'play'}
                size={22}
                color={INK}
                style={{ marginLeft: isThisPlaying ? 0 : 3 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                {isThisPlaying ? t('songs.pause') : t('songs.playAudio')}
              </Text>
              <Text
                style={{ color: SAND, fontSize: 12, fontWeight: '600', marginTop: 2 }}
                numberOfLines={1}
              >
                {mediaTitle}
              </Text>
            </View>
            <EqBars active={isThisPlaying && !reduce} />
          </Pressable>
        )}

        {/* Publisher */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm + 2,
            padding: spacing.md,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        >
          {publisherPhoto ? (
            <Image
              source={{ uri: publisherPhoto }}
              style={{ width: 38, height: 38, borderRadius: 19 }}
            />
          ) : (
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
                {publisherName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <Text
            style={[typography.bodySmall, { color: CREAM, fontWeight: '700', flex: 1 }]}
            numberOfLines={1}
          >
            {t('quote.publishedBy', {
              name: publisherName,
              defaultValue: 'Published by {{name}}',
            })}
          </Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Small pieces (module scope)
// ---------------------------------------------------------------------------

/** Softly pulsing "rising sun" in the corner. */
function SunGlow({
  top,
  right,
  reduce,
}: {
  top: number;
  right: number;
  reduce: boolean;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        right,
        width: 260,
        height: 260,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: withAlpha(BRAND.gold, 0.09),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: withAlpha(BRAND.gold, 0.14),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }],
        }}
      />
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: withAlpha(BRAND.gold, 0.42),
        }}
      />
    </View>
  );
}

/** Glass pill button used for Share / text-size. */
function ToolPill({
  icon,
  text,
  label,
  onPress,
  dots,
  active,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  text?: string;
  label: string;
  onPress: () => void;
  dots?: number;
  active?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
      })}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={CREAM} />
      ) : (
        <Text style={{ color: CREAM, fontSize: 15, fontWeight: '800', fontFamily: SERIF }}>
          {text}
        </Text>
      )}
      <Text style={{ color: CREAM, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
      {dots ? (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {Array.from({ length: dots }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: i <= (active ?? 0) ? BRAND.gold : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Tiny equalizer shown while audio plays. */
const EQ_H = 20;
function EqBar({ dur, delay, active }: { dur: number; delay: number; active: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: dur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: dur,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, dur, delay, active]);

  return (
    <Animated.View
      style={{
        width: 4,
        height: EQ_H,
        borderRadius: 2,
        backgroundColor: BRAND.gold,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [EQ_H * 0.4, 0] }) },
          { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
        ],
      }}
    />
  );
}

function EqBars({ active }: { active: boolean }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: EQ_H, paddingRight: 6 }}
    >
      {[
        [520, 0],
        [380, 120],
        [640, 60],
        [450, 200],
      ].map(([d, l], i) => (
        <EqBar key={i} dur={d} delay={l} active={active} />
      ))}
    </View>
  );
}