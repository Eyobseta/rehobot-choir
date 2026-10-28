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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { DailyQuote, getTodayQuote, getCachedQuoteById } from '../../services/quotes';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';
import { BRAND } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { formatEthDate, isValidEthDate } from '../../utils/ethiopianCalendar';

const CREAM = '#FFF4E0';
const SAND = '#F3DDB8';
const YT = '#FF0000';

/**
 * Route params:
 *   { quote: DailyQuote }              — preferred (from history / today card)
 *   { id: string }                     — fallback; resolved from cache
 *   {}                                 — last resort: today's cached quote
 */
export default function DailyQuoteDetailScreen({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const paramQuote: DailyQuote | undefined = route.params?.quote;
  const paramId: string | undefined = route.params?.id;

  const [resolvedQuote, setResolvedQuote] = useState<DailyQuote | undefined>(paramQuote);
  const [resolving, setResolving] = useState(!paramQuote);

  // If the caller passed the quote directly, use it. Otherwise try the cache
  // so deep-links still work offline (today's quote, then by-id lookup).
  useEffect(() => {
    if (paramQuote) {
      setResolvedQuote(paramQuote);
      setResolving(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (paramId) {
          const byId = await getCachedQuoteById(paramId);
          if (!cancelled && byId) {
            setResolvedQuote(byId);
            return;
          }
        }
        const today = await getTodayQuote();
        if (!cancelled && today) {
          setResolvedQuote(today);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paramQuote, paramId]);

  const quote = resolvedQuote;

  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());

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
    if (resolving) {
      return (
        <LinearGradient
          colors={['#C98B4A', '#A56B36', '#6E4220']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color={SAND} />
        </LinearGradient>
      );
    }
    return (
      <LinearGradient
        colors={['#C98B4A', '#A56B36', '#6E4220']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
      >
        <Ionicons name="leaf-outline" size={40} color={SAND} />
        <Text style={[typography.body, { color: '#FFFFFF', marginTop: spacing.md, textAlign: 'center' }]}>
          {t('quote.empty')}
        </Text>
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </LinearGradient>
    );
  }

  // ---------- Derived values ----------
  const lang: 'en' | 'am' = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
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

  // Shrink the type a little for long quotes so it always reads well.
  const long = quote.quoteText.length > 180;
  const quoteFont = long ? 21 : 27;
  const quoteLine = long ? 33 : 42;

  return (
    <LinearGradient
      colors={['#C98B4A', '#A56B36', '#6E4220']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      {/* decorative layers */}
      <Text
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 40,
          left: 14,
          fontSize: 260,
          lineHeight: 280,
          fontWeight: '800',
          color: 'rgba(255,255,255,0.10)',
        }}
      >
        “
      </Text>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -60,
          right: -50,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: 'rgba(255,215,140,0.16)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -90,
          left: -70,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(255,232,180,0.14)',
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
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.24)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="sunny" size={22} color={CREAM} />
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
            numberOfLines={1}
          >
            {t('quote.title')}
          </Text>
          <Text
            style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 }}
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
          {/* date pill */}
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.24)',
            }}
          >
            <Ionicons name="calendar-outline" size={13} color={CREAM} />
            <Text style={[typography.caption, { color: CREAM, fontWeight: '800' }]}>
              {dateLabel}
            </Text>
          </View>

          <Text
            selectable
            style={{
              marginTop: spacing.lg,
              color: '#FFFFFF',
              fontSize: quoteFont,
              lineHeight: quoteLine,
              fontStyle: 'italic',
              fontWeight: '500',
              letterSpacing: 0.2,
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
            <View style={{ width: 30, height: 2, borderRadius: 1, backgroundColor: SAND }} />
            <Text
              style={[
                typography.body,
                { color: SAND, fontWeight: '800', flexShrink: 1, letterSpacing: 0.3 },
              ]}
            >
              {quote.source}
            </Text>
          </View>

          {/* ---------- YouTube ---------- */}
          {hasVideo && (
            <Pressable
              onPress={onPlayVideo}
              accessibilityRole="button"
              style={{
                marginTop: spacing.xl,
                borderRadius: 18,
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
                  borderRadius: 18,
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
        {/* Audio: same design + logic as SongDetailScreen */}
        {hasAudio && (
          <Pressable
            onPress={onTogglePlay}
            style={{
              marginBottom: 14,
              borderRadius: 18,
              overflow: 'hidden',
              shadowColor: BRAND.violet,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 5,
            }}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 12,
                paddingVertical: 16,
                paddingHorizontal: 20,
                borderRadius: 18,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isThisPlaying ? 'pause' : 'play'}
                  size={20}
                  color={BRAND.violet}
                  style={{ marginLeft: isThisPlaying ? 0 : 2 }}
                />
              </View>
              <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                {isThisPlaying ? t('songs.pause') : t('songs.playAudio')}
              </Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Publisher */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm + 2,
            padding: spacing.md,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.14)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          {publisherPhoto ? (
            <Image
              source={{ uri: publisherPhoto }}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
          ) : (
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
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