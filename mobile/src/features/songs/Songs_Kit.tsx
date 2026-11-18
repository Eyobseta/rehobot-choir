import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { subscribe, getSnapshot, getCurrentKey } from '../../services/audioPlayer';

/**
 * Shared building blocks for the Songs module screens.
 * Pure JS / Animated — safe for OTA updates.
 */

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const AMBER = '#E8A65D';
export const HEART = '#FF5C7A';

// [pastel fill, accent]: pastel tiles with a teal icon, accent for text and chips.
export const PALETTES: readonly [string, string][] = [
  ['#D3C3F8', '#7B5FC7'],
  ['#BDEBCB', '#2E9E5B'],
  ['#F7E1C8', '#C9822F'],
  ['#DDF59B', '#7FA800'],
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useReduceMotion(): boolean {
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

/** Which track key is loaded, and whether it is actually playing right now. */
export function useNowPlaying(): { key: string | null; playing: boolean } {
  const [st, setSt] = useState(getSnapshot());
  useEffect(() => {
    const unsub = subscribe(setSt);
    setSt(getSnapshot());
    return unsub;
  }, []);
  return { key: getCurrentKey(), playing: st.isLoaded && st.isPlaying };
}

/** Loop 0 -> 1 -> 0 (gentle pulses / shimmer). */
export function usePulse(active: boolean, duration: number): Animated.Value {
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

// ---------------------------------------------------------------------------
// Equalizer
// ---------------------------------------------------------------------------

function EqBar({
  h,
  dur,
  delay,
  active,
  color,
}: {
  h: number;
  dur: number;
  delay: number;
  active: boolean;
  color: string;
}) {
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
        width: Math.max(3, h / 6),
        height: h,
        borderRadius: 2,
        backgroundColor: color,
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [h * 0.4, 0] }) },
          { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
        ],
      }}
    />
  );
}

export function EqBars({
  active,
  color = BRAND.gold,
  height = 18,
}: {
  active: boolean;
  color?: string;
  height?: number;
}) {
  const reduce = useReduceMotion();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height }}
    >
      {(
        [
          [520, 0],
          [380, 120],
          [640, 60],
          [450, 200],
        ] as [number, number][]
      ).map(([d, l], i) => (
        <EqBar key={i} h={height} dur={d} delay={l} active={active && !reduce} color={color} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero header
// ---------------------------------------------------------------------------

export function ScreenHero({
  gradient: _gradient,
  icon,
  overline,
  title,
  onBack,
  children,
}: {
  gradient?: readonly [string, string, ...string[]];
  icon: IconName;
  overline: string;
  title: string;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: BRAND.teal, 
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: 22,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        overflow: 'hidden',
      }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top,
          right: -42,
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: BRAND.lime,
        }}
      />
      {/* faint floating notes */}
      <Ionicons
        name="musical-notes"
        size={74}
        color="rgba(255,255,255,0.07)"
        style={{ position: 'absolute', right: 66, top: 46, transform: [{ rotate: '14deg' }] }}
      />
      <Ionicons
        name="musical-note"
        size={44}
        color="rgba(255,255,255,0.06)"
        style={{ position: 'absolute', left: 150, bottom: 8, transform: [{ rotate: '-12deg' }] }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
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
          <Ionicons name={icon} size={23} color={BRAND.deep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.78)',
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
            numberOfLines={1}
          >
            {overline}
          </Text>
          <Text
            style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        {onBack ? (
          <GlassBackButton
            onPress={onBack}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            size={44}
          />
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Small translucent pill for hero (counts etc.). */
export function HeroPill({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 14,
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: BRAND.tealDark,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Ionicons name={icon} size={13} color={BRAND.gold} />
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Notices / empty / skeleton
// ---------------------------------------------------------------------------

export function SavedPill() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { typography } = theme;
  return (
    <View
      accessibilityRole="text"
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
      <Text style={[typography.caption, { color: AMBER, fontWeight: '800' }]}>
        {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon,
  text,
  ring = [BRAND.lime, BRAND.mint, BRAND.lavender],
}: {
  icon: IconName;
  text: string;
  ring?: readonly [string, string, ...string[]];
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const v = usePulse(true, 1800);
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
      <Animated.View
        style={{
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
        }}
      >
        <LinearGradient
          colors={ring as any}
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
            <Ionicons name={icon} size={40} color={colors.textSecondary} />
          </View>
        </LinearGradient>
      </Animated.View>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
        {text}
      </Text>
    </View>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const v = usePulse(true, 850);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  return (
    <View accessibilityState={{ busy: true }} style={{ gap: spacing.sm + 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            height: 76,
            borderRadius: 20,
            backgroundColor: colors.border,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Song row (Songs + Favorites)
// ---------------------------------------------------------------------------

export function SongRow({
  index,
  title,
  subtitle,
  icon,
  palette,
  playing,
  trailing,
  onPress,
}: {
  index: number;
  title: string;
  subtitle?: string | null;
  icon: IconName;
  palette: readonly [string, string];
  playing?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        marginBottom: spacing.sm + 4,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          paddingLeft: 16,
          borderRadius: 22,
          borderWidth: playing ? 1.5 : 1,
          borderColor: playing ? withAlpha(palette[1], 0.7) : colors.border,
          backgroundColor: playing ? withAlpha(palette[1], 0.07) : colors.surface,
          overflow: 'hidden',
        }}
      >
        <View style={{ backgroundColor: palette[0],  position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <View style={{ backgroundColor: palette[0], 
            width: 54,
            height: 54,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: palette[1],
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}>
          {playing ? (
            <EqBars active color={BRAND.teal} height={20} />
          ) : (
            <Ionicons name={icon} size={24} color={BRAND.teal} />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {playing ? (
            <Text
              style={[typography.caption, { color: palette[1], marginTop: 2, fontWeight: '800' }]}
              numberOfLines={1}
            >
              {t('songs.nowPlaying')}
            </Text>
          ) : subtitle ? (
            <Text
              style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing ?? (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: withAlpha(palette[1], 0.16),
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 8,
            }}
          >
            <Ionicons name="chevron-forward" size={18} color={palette[1]} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Pastel grid card for the library's grid view. Same props as SongRow plus `width`. */
export function SongTile({
  index,
  title,
  subtitle,
  icon,
  palette,
  playing,
  onPress,
  width,
}: {
  index: number;
  title: string;
  subtitle?: string | null;
  icon: IconName;
  palette: readonly [string, string];
  playing?: boolean;
  onPress: () => void;
  width: number;
}) {
  const { t } = useTranslation();
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        width,
        marginBottom: 12,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={{
          height: 164,
          borderRadius: 26,
          padding: 14,
          justifyContent: 'space-between',
          overflow: 'hidden',
          backgroundColor: palette[0],
          borderWidth: playing ? 2 : 0,
          borderColor: BRAND.teal,
        }}
      >
        <Text
          style={{
            position: 'absolute',
            right: 10,
            top: -4,
            fontSize: 66,
            fontWeight: '800',
            color: withAlpha(BRAND.teal, 0.08),
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {playing ? (
              <EqBars active color={BRAND.teal} height={18} />
            ) : (
              <Ionicons name={icon} size={20} color={BRAND.teal} />
            )}
          </View>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 9,
              backgroundColor: BRAND.teal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={playing ? 'pause' : 'play'} size={12} color={BRAND.lime} />
          </View>
        </View>

        <View>
          <Text
            style={{ color: BRAND.teal, fontSize: 15, lineHeight: 20, fontWeight: '800' }}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            style={{ color: withAlpha(BRAND.teal, 0.7), fontSize: 12, fontWeight: '700', marginTop: 3 }}
            numberOfLines={1}
          >
            {playing ? t('songs.nowPlaying') : subtitle ?? ' '}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** List / grid switch, sits in the hero. UI-only state. */
export function ViewToggle({
  mode,
  onChange,
}: {
  mode: 'list' | 'grid';
  onChange: (m: 'list' | 'grid') => void;
}) {
  const opt = (m: 'list' | 'grid', icon: IconName) => {
    const active = mode === m;
    return (
      <Pressable
        key={m}
        onPress={() => onChange(m)}
        accessibilityRole="button"
        accessibilityLabel={m}
        accessibilityState={{ selected: active }}
        style={{
          width: 36,
          height: 32,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active ? BRAND.lime : 'transparent',
        }}
      >
        <Ionicons name={icon} size={16} color={active ? BRAND.teal : 'rgba(255,255,255,0.8)'} />
      </Pressable>
    );
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        backgroundColor: BRAND.tealDark,
      }}
    >
      {opt('list', 'list')}
      {opt('grid', 'grid')}
    </View>
  );
}