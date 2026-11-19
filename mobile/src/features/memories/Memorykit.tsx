import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { EthDate } from '../../utils/ethiopianCalendar';
import GlassBackButton from '../../components/GlassBackButton';

/**
 * Shared pieces for all Memories screens.
 * Put this file next to MemoriesScreen.tsx (src/features/memories/Memorykit.tsx).
 */

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type Photo = { id: string; uri: string | undefined };

/** Placeholder gradients for memories without a photo (teal / lavender / mint family). */
export const PALETTES: readonly (readonly [string, string])[] = [
  [BRAND.tealDark, '#2B6B7A'],
  ['#2B6B7A', BRAND.teal],
  ['#3B2F6B', '#7B5FC7'],
  [BRAND.teal, '#2E9E5B'],
];

const AMBER = '#E8A65D';

// ---------------------------------------------------------------------------
// Entrance animation helper
// ---------------------------------------------------------------------------

export function useEnter(ready: boolean = true) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) return;
    enter.setValue(0);
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [ready, enter]);

  const fadeUp = (i: number) => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 10, 0] }) }],
  });
  return { enter, fadeUp };
}

// ---------------------------------------------------------------------------
// Hero (teal header used by every memories screen)
// ---------------------------------------------------------------------------

export function MemoryHero({
  icon,
  overline,
  title,
  titleSize = 22,
  onBack,
  children,
}: {
  icon: IconName;
  overline: string;
  title: string;
  titleSize?: number;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View
      style={{
        backgroundColor: BRAND.teal,
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: 22,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top - 22,
          right: -52,
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: withAlpha(BRAND.lime, 0.14),
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -60,
          left: -50,
          width: 130,
          height: 130,
          borderRadius: 65,
          backgroundColor: withAlpha(BRAND.lavender, 0.1),
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            backgroundColor: BRAND.gold,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={22} color={BRAND.deep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {overline}
          </Text>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ color: '#FFFFFF', fontSize: titleSize, fontWeight: '800', marginTop: 2 }}
          >
            {title}
          </Text>
        </View>
        {onBack ? (
          <GlassBackButton onPress={onBack} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} />
        ) : null}
      </View>

      {children ? <View style={{ marginTop: 18 }}>{children}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Photo carousel with animated dots + counter
// ---------------------------------------------------------------------------

export function PhotoCarousel({
  photos,
  height = 320,
  onPressPhoto,
}: {
  photos: Photo[];
  height?: number;
  onPressPhoto?: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      const i = Math.round(value / width);
      setIndex((prev) => (prev === i ? prev : i));
    });
    return () => scrollX.removeListener(id);
  }, [scrollX, width]);

  if (photos.length === 0) {
    return (
      <View style={{ height: height * 0.7, backgroundColor: BRAND.teal, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: withAlpha(BRAND.lime, 0.9) }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -80, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: withAlpha(BRAND.lavender, 0.9) }} />
        <Ionicons name="images" size={64} color="rgba(255,255,255,0.35)" />
      </View>
    );
  }

  return (
    <View style={{ height }}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
      >
        {photos.map((p, i) => (
          <Pressable key={p.id} onPress={() => onPressPhoto?.(i)} accessibilityRole="imagebutton">
            <Image source={{ uri: p.uri }} style={{ width, height }} resizeMode="cover" />
          </Pressable>
        ))}
      </Animated.ScrollView>

      {/* top fade so the floating back button stays readable */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(14,38,44,0.55)', 'rgba(14,38,44,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 110 }}
      />
      {/* bottom fade so the dots stay readable */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(14,38,44,0)', 'rgba(14,38,44,0.55)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 }}
      />

      {photos.length > 1 && (
        <>
          <View pointerEvents="none" style={styles.dots}>
            {photos.map((p, i) => (
              <Animated.View
                key={p.id}
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: BRAND.lime,
                  width: scrollX.interpolate({
                    inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                    outputRange: [8, 24, 8],
                    extrapolate: 'clamp',
                  }),
                  opacity: scrollX.interpolate({
                    inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                    outputRange: [0.5, 1, 0.5],
                    extrapolate: 'clamp',
                  }),
                }}
              />
            ))}
          </View>
          <View pointerEvents="none" style={styles.counter}>
            <Ionicons name="images" size={12} color={BRAND.lime} />
            <Text style={styles.counterText}>
              {Math.min(index + 1, photos.length)}/{photos.length}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Thumbnail strip (opens the viewer at a given photo)
// ---------------------------------------------------------------------------

export function PhotoStrip({
  photos,
  onPressPhoto,
}: {
  photos: Photo[];
  onPressPhoto: (index: number) => void;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
      {photos.map((p, i) => (
        <Pressable
          key={p.id}
          onPress={() => onPressPhoto(i)}
          accessibilityRole="imagebutton"
          style={({ pressed }) => ({
            marginRight: 10,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Image
            source={{ uri: p.uri }}
            style={{
              width: 84,
              height: 84,
              borderRadius: 18,
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Full-screen photo viewer (pinch-to-zoom on iOS)
// ---------------------------------------------------------------------------

export function PhotoViewer({
  visible,
  photos,
  startIndex,
  onClose,
}: {
  visible: boolean;
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (visible) setIndex(startIndex);
  }, [visible, startIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#050F12' }}>
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: startIndex * width, y: 0 }}
          onLayout={() => ref.current?.scrollTo({ x: startIndex * width, animated: false })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {photos.map((p) => (
            <ScrollView
              key={p.id}
              style={{ width, height }}
              contentContainerStyle={{ width, height }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: p.uri }} style={{ width, height }} resizeMode="contain" />
            </ScrollView>
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={[styles.viewerClose, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        {photos.length > 1 && (
          <View style={[styles.viewerCounter, { bottom: insets.bottom + 24 }]}>
            <Text style={styles.counterText}>
              {index + 1}/{photos.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Buttons / chips
// ---------------------------------------------------------------------------

/** Generic gradient button with press spring (used for approve, reject, youtube...). */
export function GradientButton({
  label,
  onPress,
  colors,
  icon,
  busy,
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  colors: readonly [string, string];
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  flex?: number;
}) {
  const { theme } = useTheme();
  const { radius, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const off = !!busy || !!disabled;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        {
          borderRadius: radius.lg,
          backgroundColor: colors[0],
          opacity: off ? 0.65 : 1,
          transform: [{ scale }],
          shadowColor: colors[1],
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        },
        flex !== undefined ? { flex } : null,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off, busy: !!busy }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 54,
            borderRadius: radius.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 14,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
              <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]} numberOfLines={1}>
                {label}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export const YOUTUBE_COLORS = ['#FF2D2D', '#B3001B'] as const;
export const SUCCESS_COLORS = ['#2E9E5B', '#3FBF73'] as const;
export const DANGER_COLORS = ['#C0262D', '#E0405A'] as const;

/** Small coloured status pill (icon + label). */
export function StatusPill({ label, color, icon }: { label: string; color: string; icon: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.16) }]}>
      <Ionicons name={icon} size={14} color={color} />
      {label ? (
        <Text style={{ color, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Date chip, e.g. "2026-09-28". */
export function DatePill({ text, onDark }: { text: string; onDark?: boolean }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const fg = onDark ? '#FFFFFF' : colors.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: onDark ? 'rgba(14,38,44,0.62)' : withAlpha(colors.textSecondary, 0.12) }]}>
      <Ionicons name="calendar" size={12} color={onDark ? BRAND.lime : fg} />
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/** Round initial avatar for "submitted by". */
export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: BRAND.lavender,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: BRAND.teal, fontSize: Math.round(size * 0.5), fontWeight: '800' }}>{initial}</Text>
    </View>
  );
}

/** "Showing saved data" offline pill. */
export function SavedPill() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: withAlpha(AMBER, 0.14),
        borderWidth: 1,
        borderColor: withAlpha(AMBER, 0.4),
      }}
    >
      <Ionicons name="cloud-offline" size={13} color={AMBER} />
      <Text style={[theme.typography.caption, { color: AMBER, fontWeight: '800' }]}>
        {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Description + audio cards (shared by detail and review screens)
// ---------------------------------------------------------------------------

export function DescriptionCard({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: 14,
          padding: 18,
          borderRadius: 24,
          borderWidth: 1,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <View style={{ width: 4, borderRadius: 2, backgroundColor: BRAND.lime }} />
      <Text style={[typography.body, { color: colors.text, lineHeight: 25, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function AudioCard({
  label,
  subtitle,
  playing,
  onPress,
  positionMillis,
  durationMillis,
}: {
  label: string;
  subtitle: string;
  playing: boolean;
  onPress: () => void;
  /** Pass these only while this memory's track is the one loaded in the player. */
  positionMillis?: number;
  durationMillis?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  const hasProgress = durationMillis !== undefined && durationMillis > 0 && positionMillis !== undefined;
  const progress = hasProgress ? Math.min(1, positionMillis! / durationMillis!) : 0;

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        borderRadius: 26,
        backgroundColor: BRAND.teal,
        shadowColor: BRAND.deep,
        shadowOpacity: playing ? 0.45 : 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 7,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <LinearGradient
          colors={[BRAND.tealDark, BRAND.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 26, padding: 16, overflow: 'hidden' }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -40,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: withAlpha(BRAND.lime, 0.12),
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: BRAND.lime,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={playing ? 'pause' : 'play'}
                size={24}
                color={BRAND.teal}
                style={{ marginLeft: playing ? 0 : 3 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                {label}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {hasProgress ? `${fmt(positionMillis!)} / ${fmt(durationMillis!)}` : subtitle}
              </Text>
            </View>
            <Equalizer active={playing} />
          </View>
          {hasProgress && (
            <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 14, overflow: 'hidden' }}>
              <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: BRAND.lime }} />
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Equalizer bars (animate while audio plays)
// ---------------------------------------------------------------------------

export function Equalizer({ active, color = BRAND.lime }: { active: boolean; color?: string }) {
  const bars = useRef([0.35, 0.6, 0.45, 0.7].map((v) => new Animated.Value(v))).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((b, i) => Animated.timing(b, { toValue: [0.35, 0.6, 0.45, 0.7][i], duration: 200, useNativeDriver: false }).start());
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 320 + i * 110, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(b, { toValue: 0.2, duration: 320 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 26, gap: 4 }}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            borderRadius: 3,
            backgroundColor: color,
            height: b.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }),
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty state (optional action button)
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  text,
  actionLabel,
  onAction,
}: {
  icon: IconName;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <LinearGradient
        colors={[BRAND.lime, BRAND.mint, BRAND.lavender]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyRing}
      >
        <View style={[styles.emptyInner, { backgroundColor: colors.background }]}>
          <Ionicons name={icon} size={40} color={colors.textSecondary} />
        </View>
      </LinearGradient>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' }]}>
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: spacing.lg,
            paddingHorizontal: 20,
            minHeight: 44,
            borderRadius: 999,
            backgroundColor: BRAND.teal,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ color: BRAND.lime, fontWeight: '800', fontSize: 14 }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeletons (first load)
// ---------------------------------------------------------------------------

export function Pulse({ style }: { style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: theme.colors.surfaceAlt, opacity: v }, style]} />;
}

/** Card-shaped placeholders for the memories grid. */
export function MemoryListSkeleton({ rows = 3 }: { rows?: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            marginBottom: 16,
            borderRadius: 26,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pulse style={{ height: i === 0 ? 240 : 190 }} />
          <View style={{ padding: 14, gap: 8 }}>
            <Pulse style={{ height: 12, borderRadius: 6, width: '80%' }} />
            <Pulse style={{ height: 12, borderRadius: 6, width: '50%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Row-shaped placeholders for compact lists (my submissions / review queue). */
export function RowSkeleton({ rows = 4 }: { rows?: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 12,
            marginBottom: 12,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pulse style={{ width: 64, height: 64, borderRadius: 16 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Pulse style={{ height: 12, borderRadius: 6, width: '70%' }} />
            <Pulse style={{ height: 10, borderRadius: 5, width: '40%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Legacy banner (kept so any other import keeps compiling)
// ---------------------------------------------------------------------------

export function HeroBanner({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={[styles.blob, { top: -50, right: -40, backgroundColor: withAlpha(BRAND.lime, 0.14) }]} />
      <View style={styles.heroRow}>
        <View style={styles.heroIcon}>
          <Ionicons name={icon} size={26} color={BRAND.deep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  counter: {
    position: 'absolute',
    bottom: 36,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(14,38,44,0.62)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  viewerClose: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCounter: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  emptyRing: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  emptyInner: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 22, borderRadius: 28, overflow: 'hidden', backgroundColor: BRAND.teal },
  blob: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.82)' },
});

/**
 * Memories come from the backend with split Ethiopian date fields,
 * not a `date` object. Convert to an EthDate for formatEthDate.
 */
export function memoryToEthDate(m: {
  dateEthYear: number;
  dateEthMonth: number;
  dateEthDay: number;
}): EthDate {
  return {
    year: m.dateEthYear,
    month: m.dateEthMonth,
    day: m.dateEthDay,
  };
}