import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { MIN_TOUCH_SIZE } from '../../theme/tokens';
import { BRAND, withAlpha, onColor } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

/**
 * Shared UI kit for the attendance screens.
 * Lives next to them: src/features/attendance/Attendance_Kit.tsx
 *
 * Same design language as Auth / Songs: teal hero with flat lime + lavender
 * shapes, tealDark controls, squircle cards, colours from useTheme().
 */

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const CARD_RADIUS = 20;
export const CONTROL_RADIUS = 14;
export { MIN_TOUCH_SIZE };

// ---------------------------------------------------------------------------
// Press feedback
// ---------------------------------------------------------------------------

/** Pressable with the app's small spring-scale feedback. */
export function ScaleTap({
  children,
  onPress,
  disabled,
  to = 0.97,
  style,
  pressableStyle,
  hitSlop,
  accessibilityLabel,
  accessibilityState,
  accessibilityRole = 'button',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  to?: number;
  /** Style for the outer animated wrapper (layout: flex, margins). */
  style?: StyleProp<ViewStyle>;
  /** Style for the inner pressable (look: padding, background). */
  pressableStyle?: StyleProp<ViewStyle>;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityState?: React.ComponentProps<typeof Pressable>['accessibilityState'];
  accessibilityRole?: React.ComponentProps<typeof Pressable>['accessibilityRole'];
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(to)}
        onPressOut={() => spring(1)}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
        style={pressableStyle}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function ScreenHero({
  icon,
  overline,
  title,
  subtitle,
  onBack,
  backLabel,
  children,
}: {
  icon: IconName;
  overline?: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  backLabel: string;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: BRAND.teal,
        paddingTop: insets.top + 16,
        paddingHorizontal: 16,
        paddingBottom: 22,
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        overflow: 'hidden',
      }}
    >
      {/* flat decorative shapes, bottom corners only so text stays clear */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -92,
          left: -20,
          width: 118,
          height: 118,
          borderRadius: 59,
          backgroundColor: BRAND.lavender,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -84,
          right: -10,
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: BRAND.lime,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            backgroundColor: BRAND.lime,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={24} color={BRAND.teal} />
        </View>
        <View style={{ flex: 1 }}>
          {overline ? (
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
          ) : null}
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <GlassBackButton onPress={onBack} accessibilityLabel={backLabel} />
      </View>

      {children}
    </View>
  );
}

/** Small pill that sits inside the hero (e.g. "12 Present"). */
export function HeroPill({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: BRAND.tealDark,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Ionicons name={icon} size={14} color={BRAND.lime} />
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

/** Stat box inside the hero. */
export function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 16,
        alignItems: 'center',
        backgroundColor: BRAND.tealDark,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      <Text
        style={{
          color: accent ? BRAND.lime : '#FFFFFF',
          fontSize: 20,
          fontWeight: '800',
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Content pieces
// ---------------------------------------------------------------------------

export function SectionTitle({
  title,
  count,
  tint,
}: {
  title: string;
  count?: number;
  tint?: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const c = tint ?? colors.accent;
  return (
    <View
      accessibilityRole="header"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 24,
        marginBottom: 10,
      }}
    >
      <Text style={[typography.h3, { color: colors.text, fontWeight: '800', flex: 1 }]}>
        {title}
      </Text>
      {count !== undefined ? (
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: withAlpha(c, 0.18),
          }}
        >
          <Text style={{ color: c, fontSize: 12, fontWeight: '800' }}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Flat card used for every grouped block. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: CARD_RADIUS,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Banner({
  tone,
  icon,
  text,
}: {
  tone: 'success' | 'warning' | 'error';
  icon: IconName;
  text: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const c = colors[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        marginBottom: 12,
        borderRadius: CONTROL_RADIUS,
        borderWidth: 1,
        borderColor: withAlpha(c, 0.4),
        backgroundColor: withAlpha(c, 0.12),
      }}
    >
      <Ionicons name={icon} size={18} color={c} />
      <Text style={[typography.bodySmall, { color: c, flex: 1, fontWeight: '700' }]}>
        {text}
      </Text>
    </View>
  );
}

/** "Showing saved data" pill (same wording/colour as the other screens). */
export function SavedPill({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
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
        backgroundColor: withAlpha(colors.warning, 0.14),
        borderWidth: 1,
        borderColor: withAlpha(colors.warning, 0.4),
      }}
    >
      <Ionicons name="cloud-offline" size={13} color={colors.warning} />
      <Text style={[typography.caption, { color: colors.warning, fontWeight: '800' }]}>
        {text}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 28,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={38} color={colors.accent} />
      </View>
      <Text
        style={[
          typography.body,
          { color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

export function Avatar({
  uri,
  name,
  tone,
  ink,
  size = 44,
}: {
  uri?: string | null;
  name: string;
  tone: string;
  /** Initial colour. Defaults to whichever of teal/white reads on `tone`. */
  ink?: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: tone,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ color: ink ?? onColor(tone), fontWeight: '800', fontSize: size * 0.4 }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

export function StatusChip({
  present,
  label,
}: {
  present: boolean;
  label: string;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const tone = present ? colors.success : colors.error;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: withAlpha(tone, 0.16),
      }}
    >
      <Ionicons name={present ? 'checkmark-circle' : 'close-circle'} size={15} color={tone} />
      <Text style={{ color: tone, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

/** Pulsing placeholder rows for first load. */
export function SkeletonRows({ count = 6, height = 64 }: { count?: number; height?: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const p = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p]);

  return (
    <View accessibilityLabel="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            height,
            marginBottom: 10,
            borderRadius: CARD_RADIUS,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: p,
          }}
        />
      ))}
    </View>
  );
}