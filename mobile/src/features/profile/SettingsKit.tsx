import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, BUTTON_RADIUS, PrimaryButton, SecondaryButton, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

/**
 * Shared building blocks for Profile + Settings screens.
 * Same visual language as Songs_Kit: teal hero, lime/lavender/mint accents,
 * pastel icon tiles with a teal glyph. Pure JS / Animated, safe for OTA.
 */

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

const DANGER_BG = '#3B0D17';
const DANGER_RED = '#C0262D';
const BORDER_GRADIENT = [BRAND.lime, BRAND.mint, BRAND.lavender] as const;

// ---------------------------------------------------------------------------
// Tones: pastel tile + teal glyph (same recipe as PALETTES in Songs_Kit)
// ---------------------------------------------------------------------------

export type Tone = 'lavender' | 'mint' | 'peach' | 'lime' | 'danger';

const TONE_FILL: Record<Exclude<Tone, 'danger'>, string> = {
  lavender: '#D3C3F8',
  mint: '#BDEBCB',
  peach: '#F7E1C8',
  lime: '#DDF59B',
};

export function useTone(tone: Tone): { bg: string; fg: string } {
  const { theme } = useTheme();
  if (tone === 'danger') {
    return { bg: withAlpha(theme.colors.error, 0.14), fg: theme.colors.error };
  }
  return { bg: TONE_FILL[tone], fg: BRAND.teal };
}

export function IconTile({
  name,
  tone,
  size = 40,
  iconSize = 20,
  radius = 12,
}: {
  name: IconName;
  tone: Tone;
  size?: number;
  iconSize?: number;
  radius?: number;
}) {
  const { bg, fg } = useTone(tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={name} size={iconSize} color={fg} />
    </View>
  );
}

/** Small tile used as the leading icon inside AuthField. */
export function FieldIcon({ name, tone }: { name: IconName; tone: Tone }) {
  return <IconTile name={name} tone={tone} size={30} iconSize={16} radius={9} />;
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export function useMotion() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    const update = (reduced: boolean) => {
      if (mounted) setReduceMotion(reduced);
    };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => update(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  return { reduceMotion, enter };
}

export function fadeUp(enter: Animated.Value, i: number) {
  return {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 12, 0] }) }],
  };
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

/** Teal hero surface: lime glow + faint notes, matching Songs ScreenHero. */
export function HeroShell({
  children,
  paddingBottom = 22,
  radiusBottom = 30,
  paddingHorizontal = 16,
  variant = 'brand',
}: {
  children?: React.ReactNode;
  paddingBottom?: number;
  radiusBottom?: number;
  paddingHorizontal?: number;
  variant?: 'brand' | 'danger';
}) {
  const insets = useSafeAreaInsets();
  const danger = variant === 'danger';
  return (
    <View
      style={{
        backgroundColor: danger ? DANGER_BG : BRAND.teal,
        paddingHorizontal,
        paddingTop: insets.top + 16,
        paddingBottom,
        borderBottomLeftRadius: radiusBottom,
        borderBottomRightRadius: radiusBottom,
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
          backgroundColor: danger ? withAlpha('#FF7A7A', 0.14) : withAlpha(BRAND.lime, 0.14),
        }}
      />
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
      {children}
    </View>
  );
}

/**
 * Five faint staff lines that run edge to edge behind an avatar.
 * Place inside a wrapper that is `alignSelf: 'stretch'` and set `top` so the
 * lines are centred on the avatar (top = avatarSize / 2 - 20).
 */
export function StaffLines({ top }: { top: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -32, right: -32, top }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            height: 1,
            marginBottom: i === 4 ? 0 : 9,
            backgroundColor: 'rgba(255,255,255,0.11)',
          }}
        />
      ))}
    </View>
  );
}

/** Translucent chip for hero (phone, role). `solid` = lime emphasis chip. */
export function HeroChip({
  icon,
  text,
  solid,
}: {
  icon: IconName;
  text: string;
  solid?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: solid ? BRAND.lime : BRAND.tealDark,
        borderWidth: 1,
        borderColor: solid ? BRAND.lime : 'rgba(255,255,255,0.18)',
      }}
    >
      <Ionicons name={icon} size={13} color={solid ? BRAND.teal : BRAND.lime} />
      <Text style={{ color: solid ? BRAND.teal : '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

/**
 * Header for sub-screens. Same look as Songs ScreenHero, with an optional
 * subtitle instead of children.
 */
export function ScreenHero({
  icon,
  overline,
  title,
  subtitle,
  onBack,
  variant = 'brand',
}: {
  icon: IconName;
  overline?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  variant?: 'brand' | 'danger';
}) {
  const { t } = useTranslation();
  return (
    <HeroShell variant={variant}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 17,
            backgroundColor: variant === 'danger' ? '#FF7A7A' : BRAND.gold,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: variant === 'danger' ? '#FF7A7A' : BRAND.gold,
            shadowOpacity: 0.5,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 5,
          }}
        >
          <Ionicons name={icon} size={23} color={BRAND.deep} />
        </View>
        <View style={{ flex: 1 }}>
          {overline ? (
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
          ) : null}
          <Text
            accessibilityRole="header"
            style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: overline ? 2 : 0 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)' }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onBack ? (
          <GlassBackButton
            onPress={onBack}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            size={44}
          />
        ) : null}
      </View>
    </HeroShell>
  );
}

/** Legacy inline hero, kept so existing imports keep compiling. */
export function SettingsHero({
  icon,
  title,
  subtitle,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 20,
        borderRadius: 28,
        overflow: 'hidden',
        marginBottom: 24,
        backgroundColor: BRAND.teal,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 17,
          backgroundColor: BRAND.gold,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={24} color={BRAND.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sections, groups and rows
// ---------------------------------------------------------------------------

export function SectionLabel({ title, icon }: { title: string; icon?: IconName }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionBar, { backgroundColor: colors.accent }]} />
      {icon ? <Ionicons name={icon} size={15} color={colors.accent} /> : null}
      <Text
        accessibilityRole="header"
        style={[typography.bodySmall, { color: colors.text, fontWeight: '800' }]}
      >
        {title}
      </Text>
    </View>
  );
}

export function Group({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 22,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

/** Read-only row: tile, small label, value. */
export function InfoRow({
  icon,
  tone,
  label,
  value,
  last,
  numberOfLines = 1,
  selectable,
}: {
  icon: IconName;
  tone: Tone;
  label: string;
  value: string | null | undefined;
  last?: boolean;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View
      style={[
        styles.infoRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <IconTile name={icon} tone={tone} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
        <Text
          style={[typography.body, { color: colors.text, fontWeight: '600', marginTop: 1 }]}
          numberOfLines={numberOfLines}
          selectable={selectable}
        >
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

/** Tappable row with chevron. Optional second line (`value`). */
export function NavRow({
  label,
  value,
  onPress,
  icon,
  tone,
  danger,
  last,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  icon: IconName;
  tone: Tone;
  danger?: boolean;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      onPressIn={() => to(0.98)}
      onPressOut={() => to(1)}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.navRow,
            { backgroundColor: pressed ? colors.surfaceAlt : colors.surface, transform: [{ scale: s }] },
          ]}
        >
          <IconTile name={icon} tone={danger ? 'danger' : tone} />
          <View
            style={[
              styles.navBody,
              {
                borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.bodySmall, { color: danger ? colors.error : colors.text, fontWeight: '700' }]}
              >
                {label}
              </Text>
              {value ? (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>{value}</Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textSecondary} />
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Buttons and banners
// ---------------------------------------------------------------------------

/**
 * Primary and secondary use the app-wide buttons from Auth_UI so they match
 * login/register exactly. Danger variants are local (Auth_UI has none).
 */
export function ActionButton({
  label,
  onPress,
  busy,
  disabled,
  icon,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerOutline';
}) {
  if (variant === 'primary') {
    return (
      <PrimaryButton
        label={label}
        onPress={onPress}
        busy={busy}
        disabled={disabled}
        iconNode={icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : undefined}
      />
    );
  }
  if (variant === 'secondary') {
    return <SecondaryButton label={label} onPress={onPress} />;
  }
  return (
    <DangerButton
      label={label}
      onPress={onPress}
      busy={busy}
      disabled={disabled}
      icon={icon}
      outline={variant === 'dangerOutline'}
    />
  );
}

function DangerButton({
  label,
  onPress,
  busy,
  disabled,
  icon,
  outline,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  outline?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  const off = !!(busy || disabled);

  const bg = outline ? colors.surface : DANGER_RED;
  const fg = outline ? colors.error : '#FFFFFF';
  const border = outline ? withAlpha(colors.error, 0.45) : DANGER_RED;

  return (
    <Animated.View
      style={{
        borderRadius: BUTTON_RADIUS,
        opacity: off ? 0.6 : 1,
        transform: [{ scale }],
        shadowColor: DANGER_RED,
        shadowOpacity: outline ? 0 : 0.3,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: outline ? 0 : 6,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: off, busy: !!busy }}
        style={{
          minHeight: 54,
          borderRadius: BUTTON_RADIUS,
          borderWidth: 1.5,
          borderColor: border,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 20,
        }}
      >
        {busy ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={19} color={fg} /> : null}
            <Text style={[typography.button, { color: fg, fontWeight: '800' }]}>{label}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Green confirmation box. Pass the pop-in animation via `animatedStyle`. */
export function SuccessBanner({ text, animatedStyle }: { text: string; animatedStyle?: any }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <Animated.View
      accessibilityRole="alert"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 16,
          padding: 12,
          borderRadius: 14,
          borderLeftWidth: 4,
          borderLeftColor: colors.success,
          backgroundColor: withAlpha(colors.success, 0.14),
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <Text style={[typography.bodySmall, { color: colors.success, flex: 1, fontWeight: '700' }]}>{text}</Text>
    </Animated.View>
  );
}

/** "Showing saved data" pill (same look as SavedPill in Songs_Kit). */
export function SavedNotice({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
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
        backgroundColor: withAlpha(colors.warning, 0.14),
        borderWidth: 1,
        borderColor: withAlpha(colors.warning, 0.4),
      }}
    >
      <Ionicons name="cloud-offline" size={13} color={colors.warning} />
      <Text style={[typography.caption, { color: colors.warning, fontWeight: '800' }]}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Selection card (Appearance, Language)
// ---------------------------------------------------------------------------

export function SelectionCard({
  active,
  label,
  hint,
  reduceMotion,
  onPress,
  children,
}: {
  active: boolean;
  label: string;
  hint?: string;
  reduceMotion: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const check = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      check.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.spring(check, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 100,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, check, reduceMotion]);

  useEffect(() => () => scale.stopAnimation(), [scale]);

  const press = (value: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: value, friction: 7, tension: 160, useNativeDriver: true }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        marginBottom: 16,
        borderRadius: 24,
        backgroundColor: colors.surface,
        shadowColor: colors.accent,
        shadowOpacity: active ? 0.3 : 0,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: active ? 6 : 0,
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: active }}
        onPress={onPress}
        onPressIn={() => press(0.975)}
        onPressOut={() => press(1)}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: colors.border }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: check }]}>
            <LinearGradient
              colors={BORDER_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </Animated.View>

          <View style={{ margin: 2.5, borderRadius: 21.5, backgroundColor: colors.surface, padding: 16 }}>
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {children}
            </View>
            <View style={styles.footer}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
              </View>
              <View style={[styles.radio, { borderColor: active ? colors.primary : colors.border }]}>
                <Animated.View
                  style={[
                    styles.check,
                    { backgroundColor: colors.primary, opacity: check, transform: [{ scale: check }] },
                  ]}
                >
                  <Ionicons name="checkmark" size={16} color={colors.primaryText} />
                </Animated.View>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 11 },
  sectionBar: { width: 4, height: 16, borderRadius: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 64, gap: 13 },
  navBody: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    gap: 10,
    paddingVertical: 12,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  label: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, marginTop: 2 },
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});