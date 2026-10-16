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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';

/**
 * Shared pieces for all Memories screens.
 * Put this file next to MemoriesScreen.tsx (src/features/memories/MemoryKit.tsx).
 */

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type Photo = { id: string; uri: string | undefined };

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
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: height * 0.7, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="images" size={64} color="rgba(255,255,255,0.35)" />
      </LinearGradient>
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
          <Pressable key={p.id} onPress={() => onPressPhoto?.(i)}>
            <Image source={{ uri: p.uri }} style={{ width, height }} resizeMode="cover" />
          </Pressable>
        ))}
      </Animated.ScrollView>

      {/* bottom fade so the dots stay readable */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }}
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
                  backgroundColor: BRAND.gold,
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
            <Ionicons name="images" size={12} color="#FFFFFF" />
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
// Full-screen photo viewer
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
      <View style={{ flex: 1, backgroundColor: '#000' }}>
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
            <Image key={p.id} source={{ uri: p.uri }} style={{ width, height }} resizeMode="contain" />
          ))}
        </ScrollView>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
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
          borderRadius: radius.md,
          backgroundColor: colors[0],
          opacity: off ? 0.65 : 1,
          transform: [{ scale }],
          shadowColor: colors[1],
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
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
        accessibilityState={{ disabled: off, busy: !!busy }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 54,
            borderRadius: radius.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 12,
          }}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
              <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '700' }]} numberOfLines={1}>
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
export const SUCCESS_COLORS = ['#16A34A', '#22C55E'] as const;
export const DANGER_COLORS = ['#C0262D', '#E0405A'] as const;

/** Small coloured status pill (icon + label). */
export function StatusPill({ label, color, icon }: { label: string; color: string; icon: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(color, 0.16) }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Date chip, e.g. "2026-09-28". */
export function DatePill({ text, onDark }: { text: string; onDark?: boolean }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const fg = onDark ? '#FFFFFF' : colors.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: onDark ? 'rgba(0,0,0,0.45)' : withAlpha(colors.textSecondary, 0.12) }]}>
      <Ionicons name="calendar" size={12} color={fg} />
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Equalizer bars (animate while audio plays)
// ---------------------------------------------------------------------------

export function Equalizer({ active, color = BRAND.gold }: { active: boolean; color?: string }) {
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
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <LinearGradient
        colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gradient hero banner used at the top of simple screens
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
    <LinearGradient
      colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={[styles.blob, { top: -50, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.2) }]} />
      <View pointerEvents="none" style={[styles.blob, { bottom: -70, left: -40, backgroundColor: withAlpha(BRAND.water, 0.2) }]} />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  counter: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  viewerClose: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  emptyRing: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  emptyInner: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 22, borderRadius: 28, overflow: 'hidden' },
  blob: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.82)' },
});