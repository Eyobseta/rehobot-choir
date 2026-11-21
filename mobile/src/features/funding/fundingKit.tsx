import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform,
  AccessibilityInfo, Animated, Easing, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { brand } from '../../theme/colors';
import { withAlpha, AuthField, PrimaryButton, ErrorBanner } from '../auth/Auth_UI';
import { HeroShell, IconTile } from '../profile/SettingsKit';
import GlassBackButton from '../../components/GlassBackButton';
import { ethTodayFromInstant, formatEthDate } from '../../utils/ethiopianCalendar';
import type { DateDto, FundingStatus, Declaration, PaymentInstruction } from '../../services/funding';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tone = 'lavender' | 'peach' | 'mint' | 'lime' | 'danger';

// Fixed tones used on top of the teal hero surfaces (they do not change with the theme).
const ON_DARK = {
  paid: brand.mint,
  pending: '#F2C94C',
  rejected: '#FF7A7A',
  neutral: 'rgba(255,255,255,0.75)',
  track: 'rgba(255,255,255,0.16)',
  chipBg: 'rgba(255,255,255,0.14)',
  soft: 'rgba(255,255,255,0.10)',
  textMuted: 'rgba(255,255,255,0.72)',
};
export const ONDARK = ON_DARK;

// ---------------------------------------------------------------------------
// Hooks (unchanged behaviour)
// ---------------------------------------------------------------------------

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

export function useDateLabel() {
  const { i18n } = useTranslation();
  const am = (i18n.language || 'en').startsWith('am');
  return (d: DateDto) => (am ? d.labelAm : d.labelEn);
}

export function useInstantLabel() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en').startsWith('am') ? 'am' : 'en';
  return (iso: string | null | undefined) => (iso ? formatEthDate(ethTodayFromInstant(new Date(iso)), lang) : '');
}

export function useStatusMeta() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  return (s: FundingStatus): { label: string; color: string; icon: IconName } => {
    switch (s) {
      case 'PAID': return { label: t('funding.statusPaid'), color: colors.success, icon: 'checkmark-circle' };
      case 'PENDING_VERIFICATION': return { label: t('funding.statusPending'), color: colors.warning, icon: 'time' };
      case 'REJECTED': return { label: t('funding.statusRejected'), color: colors.error, icon: 'close-circle' };
      default: return { label: t('funding.statusUnpaid'), color: colors.textSecondary, icon: 'ellipse-outline' };
    }
  };
}

export function statusTone(s: FundingStatus): Tone {
  return s === 'PAID' ? 'mint' : s === 'PENDING_VERIFICATION' ? 'peach' : s === 'REJECTED' ? 'danger' : 'lavender';
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/** Staggered entrance, same feel as the profile screens. Respects reduce-motion. */
export function FadeUp({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: object }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, {
      toValue: 1, duration: 520, delay: Math.min(index, 8) * 70,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [reduce, index, v]);
  return (
    <Animated.View
      style={[style, {
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22 + Math.min(index, 8) * 6, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

export function StatusChip({ status, onDark }: { status: FundingStatus; onDark?: boolean }) {
  const meta = useStatusMeta()(status);
  const fg = onDark
    ? (status === 'PAID' ? ON_DARK.paid : status === 'PENDING_VERIFICATION' ? ON_DARK.pending : status === 'REJECTED' ? ON_DARK.rejected : ON_DARK.neutral)
    : meta.color;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={meta.label}
      style={[styles.chip, { backgroundColor: onDark ? ON_DARK.chipBg : withAlpha(meta.color, 0.16) }]}
    >
      <Ionicons name={meta.icon} size={13} color={fg} />
      <Text style={[styles.chipText, { color: onDark ? '#FFFFFF' : meta.color }]} numberOfLines={1}>{meta.label}</Text>
    </View>
  );
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: withAlpha(color, 0.16) }]}>
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

export function SavedDataPill() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={{
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      backgroundColor: withAlpha(colors.warning, 0.14), borderWidth: 1, borderColor: withAlpha(colors.warning, 0.4),
    }}>
      <Ionicons name="cloud-offline" size={13} color={colors.warning} />
      <Text style={[typography.caption, { color: colors.warning, fontWeight: '800' }]}>
        {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { theme } = useTheme();
  const { colors, mode } = theme;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: brand.teal,
          shadowOpacity: mode === 'dark' ? 0 : 0.07,
          elevation: mode === 'dark' ? 0 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Featured teal surface (brand colours, identical in light and dark). */
export function HeroCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.heroCard, style]}>
      <View pointerEvents="none" style={styles.heroBlobA} />
      <View pointerEvents="none" style={styles.heroBlobB} />
      {children}
    </View>
  );
}

export function SectionLabel({ text, color, icon }: { text: string; color?: string; icon?: IconName }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const c = color ?? colors.accent;
  return (
    <View style={styles.sectionRow}>
      {icon ? (
        <View style={[styles.sectionIcon, { backgroundColor: withAlpha(c, 0.16) }]}>
          <Ionicons name={icon} size={13} color={c} />
        </View>
      ) : (
        <View style={[styles.sectionBar, { backgroundColor: c }]} />
      )}
      <Text style={[styles.sectionText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function FieldLabel({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginBottom: 8 }}>{text}</Text>;
}

/** A titled group of form fields. */
export function FormSection({ title, icon, tone = 'lavender', children, style }: {
  title: string; icon: IconName; tone?: Tone; children: React.ReactNode; style?: object;
}) {
  const { theme } = useTheme();
  return (
    <Card style={[{ padding: 16, marginBottom: 14 }, style as object]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <IconTile name={icon} tone={tone} size={34} iconSize={17} radius={11} />
        <Text accessibilityRole="header" style={{ color: theme.colors.text, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

export function Lockable({ locked, children, style }: { locked: boolean; children: React.ReactNode; style?: object }) {
  return <View pointerEvents={locked ? 'none' : 'auto'} style={[{ opacity: locked ? 0.55 : 1 }, style]}>{children}</View>;
}

export function DetailHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <HeroShell paddingBottom={26} radiusBottom={32} paddingHorizontal={theme.spacing.xl}>
      <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 14 }}>
        <GlassBackButton onPress={onBack} accessibilityLabel={t('common.back', { defaultValue: 'Back' })} size={44} />
        <View style={{ flex: 1 }} />
      </View>
      {!!title && (
        <Text style={{ alignSelf: 'stretch', color: '#FFFFFF', fontSize: 26, fontWeight: '800' }} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
      )}
      {!!subtitle && (
        <Text style={{ alignSelf: 'stretch', color: ON_DARK.textMuted, marginTop: 6, fontSize: 14 }} numberOfLines={2}>{subtitle}</Text>
      )}
    </HeroShell>
  );
}

// ---------------------------------------------------------------------------
// Progress / numbers
// ---------------------------------------------------------------------------

/** Animated progress bar with accessibility semantics. Renders nothing if percent is null. */
export function ProgressBar({ percent, color, trackColor, height = 12 }: {
  percent: number | null; color?: string; trackColor?: string; height?: number;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const fill = color ?? colors.primary;
  const reduce = useReduceMotion();
  const p = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { anim.setValue(p); return; }
    Animated.timing(anim, { toValue: p, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [p, reduce, anim]);
  if (percent === null) return null;
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: p }}
      accessibilityLabel={`${p} percent`}
      style={{ height, backgroundColor: trackColor ?? withAlpha(colors.textSecondary, 0.2), borderRadius: height / 2, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height: '100%', width, backgroundColor: fill, borderRadius: height / 2,
          shadowColor: fill, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

/** A money number that ticks up/down smoothly when it changes. Falls back instantly when reduceMotion. */
export function NumberTick({ value, style }: { value: string; style?: any }) {
  const reduce = useReduceMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value || reduce) { prev.current = value; return; }
    prev.current = value;
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [value, reduce, fade]);
  return <Animated.Text style={[style, { opacity: fade }]}>{value}</Animated.Text>;
}

/** Small label/value cell used for totals. */
export function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, padding: 14 }}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: color ?? theme.colors.text, fontWeight: '800', fontSize: 16, marginTop: 3 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

/** Amber "awaiting verification" strip. Use onDark inside HeroCard. */
export function PendingStrip({ text, sub, onDark, style }: { text: string; sub?: string; onDark?: boolean; style?: object }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const c = onDark ? ON_DARK.pending : colors.warning;
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
      backgroundColor: onDark ? ON_DARK.soft : withAlpha(colors.warning, 0.12),
    }, style]}>
      <Ionicons name="time" size={16} color={c} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: onDark ? '#FFFFFF' : colors.text, fontWeight: '700' }}>{text}</Text>
        {!!sub && <Text style={{ color: onDark ? ON_DARK.textMuted : colors.textSecondary, marginTop: 2, fontSize: 12 }}>{sub}</Text>}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons / inputs
// ---------------------------------------------------------------------------

/** A pressable that provides press feedback, respects a11y roles, and enforces min 44x44 hit area. */
export function AccessiblePress({
  onPress, children, style, accessibilityLabel, accessibilityHint, disabled, role = 'button',
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  role?: 'button' | 'link' | 'tab' | 'radio';
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        disabled={disabled}
        accessibilityRole={role}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled }}
        hitSlop={8}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

type BtnVariant = 'primary' | 'success' | 'danger' | 'dangerSoft' | 'outline' | 'ghost';

/** Themed secondary/inline button with spring press feedback. */
export function ActionBtn({ label, onPress, icon, variant = 'outline', disabled, busy, style, compact }: {
  label: string; onPress: () => void; icon?: IconName; variant?: BtnVariant;
  disabled?: boolean; busy?: boolean; style?: object; compact?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  const v = (() => {
    switch (variant) {
      case 'primary': return { bg: colors.primary, fg: colors.primaryText, border: 'transparent' };
      case 'success': return { bg: colors.success, fg: colors.textInverse, border: 'transparent' };
      case 'danger': return { bg: colors.error, fg: colors.textInverse, border: 'transparent' };
      case 'dangerSoft': return { bg: withAlpha(colors.error, 0.1), fg: colors.error, border: colors.error };
      case 'ghost': return { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' };
      default: return { bg: colors.surface, fg: colors.primary, border: colors.primary };
    }
  })();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
        style={{
          minHeight: compact ? 44 : 50, borderRadius: 16, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: v.bg, borderWidth: v.border === 'transparent' ? 0 : 1.5, borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {busy ? <ActivityIndicator color={v.fg} /> : (
          <>
            {!!icon && <Ionicons name={icon} size={17} color={v.fg} />}
            <Text style={{ color: v.fg, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{label}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Pill-shaped segmented control (tabs / radio). */
export function SegmentedControl<T extends string>({ options, value, onChange, disabled, role = 'tab', style }: {
  options: { key: T; label: string; icon?: IconName }[];
  value: T; onChange: (k: T) => void; disabled?: boolean; role?: 'tab' | 'radio'; style?: object;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={[{
      flexDirection: 'row', padding: 4, borderRadius: 20,
      backgroundColor: withAlpha(colors.textSecondary, 0.12), opacity: disabled ? 0.55 : 1,
    }, style]}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            disabled={disabled}
            onPress={() => onChange(o.key)}
            accessibilityRole={role}
            accessibilityState={{ selected: on, disabled: !!disabled }}
            style={{
              flex: 1, minHeight: 44, borderRadius: 16, flexDirection: 'row', gap: 6,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: on ? colors.primary : 'transparent',
            }}
          >
            {!!o.icon && <Ionicons name={o.icon} size={15} color={on ? colors.primaryText : colors.textSecondary} />}
            <Text style={{ color: on ? colors.primaryText : colors.textSecondary, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Selectable option cards (payment method, donation type...). */
export function ChoiceCards<T extends string>({ options, value, onChange, disabled, style }: {
  options: { key: T; label: string; icon: IconName }[];
  value: T | null; onChange: (k: T) => void; disabled?: boolean; style?: object;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={[{ flexDirection: 'row', gap: 10 }, style]}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            disabled={disabled}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!disabled }}
            style={{
              flex: 1, minHeight: 72, borderRadius: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6,
              borderWidth: 1.5, borderColor: on ? colors.primary : colors.border,
              backgroundColor: on ? withAlpha(colors.primary, 0.1) : colors.surface,
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <Ionicons name={o.icon} size={20} color={on ? colors.primary : colors.textSecondary} />
            <Text style={{ fontWeight: '800', color: on ? colors.primary : colors.text }} numberOfLines={1}>{o.label}</Text>
            {on && (
              <View style={{ position: 'absolute', top: 8, right: 8 }}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tap-to-open field used for date pickers. */
export function PickerField({ label, value, onPress, disabled, icon = 'calendar-outline' }: {
  label: string; value: string; onPress: () => void; disabled?: boolean; icon?: IconName;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View>
      <FieldLabel text={label} />
      <Pressable
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={{
          minHeight: 56, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: disabled ? 0.55 : 1,
        }}
      >
        <IconTile name={icon} tone="lavender" size={34} iconSize={17} radius={11} />
        <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' }}>{value}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onValueChange, disabled, positive }: {
  title: string; subtitle?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean; positive?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const tint = positive && value ? colors.success : colors.textSecondary;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18,
      backgroundColor: withAlpha(tint, 0.1), borderWidth: 1, borderColor: withAlpha(tint, 0.25),
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{title}</Text>
        {!!subtitle && <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 12 }}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.disabled }}
        thumbColor={value ? colors.primaryText : '#FFFFFF'}
        accessibilityLabel={title}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function Notice({ tone, text, icon }: { tone: 'warn' | 'error' | 'info' | 'success'; text: string; icon?: IconName }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const color = tone === 'error' ? colors.error
    : tone === 'warn' ? colors.warning
    : tone === 'success' ? colors.success
    : colors.accent;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, marginTop: 12,
        backgroundColor: withAlpha(color, 0.12), borderWidth: 1, borderColor: withAlpha(color, 0.28),
      }}
    >
      <Ionicons name={icon ?? (tone === 'info' ? 'information-circle' : tone === 'success' ? 'checkmark-circle' : 'warning')} size={20} color={color} />
      <Text style={{ flex: 1, color: colors.text, fontWeight: '600', lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export function LoadingState() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

export function LoadingInline({ style }: { style?: object }) {
  const { theme } = useTheme();
  return <ActivityIndicator style={[{ marginTop: 40 }, style]} color={theme.colors.primary} />;
}

export function EmptyState({ icon, text, style }: { icon: IconName; text: string; style?: object }) {
  const { theme } = useTheme();
  return (
    <Card style={[{ alignItems: 'center', paddingVertical: 28, gap: 12 }, style]}>
      <IconTile name={icon} tone="lavender" size={52} iconSize={26} radius={18} />
      <Text style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>{text}</Text>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
      <IconTile name="cloud-offline-outline" tone="danger" size={60} iconSize={28} radius={20} />
      <Text style={{ color: theme.colors.text, textAlign: 'center' }}>{message}</Text>
      <ActionBtn variant="primary" label={t('funding.retry', { defaultValue: 'Try again' })} onPress={onRetry} icon="refresh" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

/** Bottom-sheet surface with a grab handle. Wrap in your own Modal + KeyboardAvoidingView. */
export function SheetSurface({ children, style }: { children: React.ReactNode; style?: object }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[{
        backgroundColor: theme.colors.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingHorizontal: 24, paddingTop: 10, paddingBottom: insets.bottom + 24,
        borderTopWidth: 1, borderColor: theme.colors.border,
      }, style]}
    >
      <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, marginBottom: 16 }} />
      {children}
    </View>
  );
}

export function SheetTitle({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: IconName }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      {!!icon && <IconTile name={icon} tone="lavender" size={44} iconSize={22} radius={15} />}
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ color: theme.colors.text, fontWeight: '800', fontSize: 19 }}>{title}</Text>
        {!!subtitle && <Text style={{ color: theme.colors.textSecondary, marginTop: 3 }}>{subtitle}</Text>}
      </View>
    </View>
  );
}

export function ReasonModal(props: {
  visible: boolean; title: string; message?: string; confirmLabel: string; minLength?: number;
  onClose: () => void; onSubmit: (reason: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const min = props.minLength ?? 3;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => { if (props.visible) { setReason(''); setError(null); } }, [props.visible]);

  const submit = async () => {
    if (busyRef.current) return;
    const r = reason.trim();
    if (r.length < min) return setError(t('funding.reasonShort', { defaultValue: 'Please give a reason (at least {{n}} characters).', n: min }));
    busyRef.current = true; setBusy(true); setError(null);
    try { await props.onSubmit(r); props.onClose(); }
    catch (e) { setError(errorText(e)); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={() => !busy && props.onClose()}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        <SheetSurface>
          <SheetTitle icon="chatbox-ellipses-outline" title={props.title} subtitle={props.message} />
          <AuthField
            label={t('funding.reasonLabel', { defaultValue: 'Reason' })}
            iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={theme.colors.accent} />}
            value={reason} onChangeText={setReason} multiline
          />
          {error && <View style={{ marginTop: 8 }}><ErrorBanner message={error} /></View>}
          <View style={{ marginTop: 16, gap: 8 }}>
            <PrimaryButton label={props.confirmLabel} onPress={submit} busy={busy} />
            <ActionBtn variant="ghost" label={t('common.cancel')} onPress={() => !busy && props.onClose()} />
          </View>
        </SheetSurface>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Payment instruction card (shared by PayFlow + PaymentInstructions)
// ---------------------------------------------------------------------------

export function InstructionCard({ ins, copied, onCopy, style }: {
  ins: PaymentInstruction; copied?: boolean; onCopy: () => void; style?: object;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  const bank = ins.method === 'BANK';
  return (
    <Card style={[{ padding: 16 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconTile name={bank ? 'business-outline' : 'phone-portrait-outline'} tone={bank ? 'lavender' : 'mint'} size={48} iconSize={23} radius={16} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', color: colors.text, fontSize: 17 }}>{ins.providerName}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{bank ? t('funding.bank') : 'Telebirr'}</Text>
        </View>
      </View>

      <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, marginTop: 16 }}>{t('funding.holder')}</Text>
      <Text selectable style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 2 }}>{ins.accountHolderName}</Text>

      <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12, marginTop: 14 }}>{t('funding.account')}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, padding: 12, borderRadius: 16,
        backgroundColor: colors.surfaceAlt,
      }}>
        <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1, letterSpacing: 0.4 }}>{ins.accountIdentifier}</Text>
        <Pressable
          onPress={onCopy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('funding.copy')}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 12, minHeight: 44,
            backgroundColor: copied ? colors.success : colors.primary,
          }}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? colors.textInverse : colors.primaryText} />
          <Text style={{ color: copied ? colors.textInverse : colors.primaryText, fontWeight: '800' }}>{copied ? t('funding.copied') : t('funding.copy')}</Text>
        </Pressable>
      </View>
      {!!ins.note && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text style={{ color: colors.textSecondary, fontStyle: 'italic', flex: 1 }}>{ins.note}</Text>
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function DeclarationHistory({ items }: { items: Declaration[] }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  const instantLabel = useInstantLabel();
  if (items.length === 0) {
    return <EmptyState icon="receipt-outline" text={t('funding.noHistory', { defaultValue: 'No payments declared yet.' })} />;
  }
  const meta = (s: Declaration['status']) =>
    s === 'APPROVED' ? { c: colors.success, l: t('funding.statusPaid'), tone: 'mint' as Tone, icon: 'checkmark-circle-outline' as IconName }
    : s === 'REJECTED' ? { c: colors.error, l: t('funding.statusRejected'), tone: 'danger' as Tone, icon: 'close-circle-outline' as IconName }
    : s === 'VOID' ? { c: colors.textSecondary, l: t('funding.voided', { defaultValue: 'Voided' }), tone: 'lavender' as Tone, icon: 'remove-circle-outline' as IconName }
    : { c: colors.warning, l: t('funding.statusPending'), tone: 'peach' as Tone, icon: 'time-outline' as IconName };
  return (
    <View style={{ gap: 10 }}>
      {items.map((d) => {
        const m = meta(d.status);
        return (
          <Card key={d.id} style={{ padding: 14, borderRadius: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile name={m.icon} tone={m.tone} size={42} iconSize={21} radius={14} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{d.amount.label}</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 13 }}>
                  {instantLabel(d.declaredAt)}
                  {d.paymentMethod ? ` · ${d.paymentMethod === 'BANK' ? t('funding.bank', { defaultValue: 'Bank' }) : 'Telebirr'}` : ''}
                </Text>
              </View>
              <Pill text={m.l} color={m.c} />
            </View>
            {!!d.reference && <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>Ref: {d.reference}</Text>}
            {d.status === 'REJECTED' && !!d.rejectionReason && (
              <Text style={{ color: colors.error, marginTop: 6, fontWeight: '600' }}>{d.rejectionReason}</Text>
            )}
          </Card>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers (unchanged)
// ---------------------------------------------------------------------------

export function errorText(e: unknown): string {
  const err = e as { message?: string };
  return err?.message || 'Something went wrong';
}

export function minorToInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const frac = minor % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '800' },
  card: {
    borderWidth: 1, borderRadius: 24, padding: 16,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 14,
  },
  heroCard: { backgroundColor: brand.teal, borderRadius: 28, padding: 20, overflow: 'hidden' },
  heroBlobA: { position: 'absolute', top: -50, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(196,244,79,0.10)' },
  heroBlobB: { position: 'absolute', bottom: -60, left: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(211,195,248,0.10)' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 12 },
  sectionBar: { width: 4, height: 14, borderRadius: 2 },
  sectionIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
});