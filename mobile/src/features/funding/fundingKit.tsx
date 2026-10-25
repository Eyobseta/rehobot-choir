import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform,
  AccessibilityInfo, Animated, Easing, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { withAlpha, BRAND, AuthField, PrimaryButton, ErrorBanner } from '../auth/Auth_UI';
import { ethTodayFromInstant, formatEthDate } from '../../utils/ethiopianCalendar';
import type { DateDto, FundingStatus, Declaration } from '../../services/funding';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const AMBER = '#F59E0B';

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
      case 'PENDING_VERIFICATION': return { label: t('funding.statusPending'), color: AMBER, icon: 'time' };
      case 'REJECTED': return { label: t('funding.statusRejected'), color: colors.error, icon: 'close-circle' };
      default: return { label: t('funding.statusUnpaid'), color: colors.textSecondary, icon: 'ellipse-outline' };
    }
  };
}

export function StatusChip({ status }: { status: FundingStatus }) {
  const meta = useStatusMeta()(status);
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={meta.label}
      style={[styles.chip, { backgroundColor: withAlpha(meta.color, 0.16) }]}
    >
      <Ionicons name={meta.icon} size={13} color={meta.color} />
      <Text style={[styles.chipText, { color: meta.color }]} numberOfLines={1}>{meta.label}</Text>
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

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ text, color }: { text: string; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Text style={[styles.sectionText, { color: theme.colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function DetailHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingHorizontal: 24, paddingBottom: 20, paddingTop: insets.top + 12, backgroundColor: BRAND.deep }}>
      <Pressable
        onPress={onBack}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{ marginBottom: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }}
      >
        <Ionicons name="arrow-back" size={24} color="#FFF" />
      </Pressable>
      <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '800' }} accessibilityRole="header">{title}</Text>
      {!!subtitle && <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{subtitle}</Text>}
    </View>
  );
}

/** Animated progress bar with accessibility semantics. Renders nothing if percent is null. */
export function ProgressBar({ percent, color = BRAND.violet }: { percent: number | null; color?: string }) {
  const { theme } = useTheme();
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
      style={{ height: 10, backgroundColor: theme.colors.border, borderRadius: 5, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          height: '100%', width, backgroundColor: color, borderRadius: 5,
          shadowColor: color, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
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

export function Notice({ tone, text, icon }: { tone: 'warn' | 'error' | 'info' | 'success'; text: string; icon?: IconName }) {
  const { theme } = useTheme();
  const color = tone === 'error' ? theme.colors.error
    : tone === 'warn' ? AMBER
    : tone === 'success' ? theme.colors.success
    : BRAND.violet;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: withAlpha(color, 0.12), marginTop: 12 }}
    >
      <Ionicons name={icon ?? (tone === 'info' ? 'information-circle' : tone === 'success' ? 'checkmark-circle' : 'warning')} size={18} color={color} />
      <Text style={{ flex: 1, color: theme.colors.text, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.textSecondary} />
      <Text style={{ color: theme.colors.text, textAlign: 'center', marginTop: 12 }}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: BRAND.violet, minHeight: 44 }}
      >
        <Text style={{ color: '#FFF', fontWeight: '800' }}>{t('funding.retry', { defaultValue: 'Try again' })}</Text>
      </Pressable>
    </View>
  );
}

export function DeclarationHistory({ items }: { items: Declaration[] }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors } = theme;
  const instantLabel = useInstantLabel();
  if (items.length === 0) {
    return <Text style={{ color: colors.textSecondary }}>{t('funding.noHistory', { defaultValue: 'No payments declared yet.' })}</Text>;
  }
  const meta = (s: Declaration['status']) =>
    s === 'APPROVED' ? { c: colors.success, l: t('funding.statusPaid') }
    : s === 'REJECTED' ? { c: colors.error, l: t('funding.statusRejected') }
    : s === 'VOID' ? { c: colors.textSecondary, l: t('funding.voided', { defaultValue: 'Voided' }) }
    : { c: AMBER, l: t('funding.statusPending') };
  return (
    <View style={{ gap: 10 }}>
      {items.map((d) => {
        const m = meta(d.status);
        return (
          <Card key={d.id} style={{ padding: 14, borderRadius: 16 }}>
            <View style={styles.rowBetween}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{d.amount.label}</Text>
              <Pill text={m.l} color={m.c} />
            </View>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
              {instantLabel(d.declaredAt)}
              {d.paymentMethod ? ` · ${d.paymentMethod === 'BANK' ? t('funding.bank', { defaultValue: 'Bank' }) : 'Telebirr'}` : ''}
            </Text>
            {!!d.reference && <Text style={{ color: colors.textSecondary, marginTop: 2 }}>Ref: {d.reference}</Text>}
            {d.status === 'REJECTED' && !!d.rejectionReason && (
              <Text style={{ color: colors.error, marginTop: 6, fontWeight: '600' }}>{d.rejectionReason}</Text>
            )}
          </Card>
        );
      })}
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <Text accessibilityRole="header" style={{ color: theme.colors.text, fontWeight: '800', fontSize: 18 }}>{props.title}</Text>
          {!!props.message && <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>{props.message}</Text>}
          <View style={{ marginTop: 16 }}>
            <AuthField
              label={t('funding.reasonLabel', { defaultValue: 'Reason' })}
              iconNode={<Ionicons name="chatbox-ellipses-outline" size={18} color={BRAND.violet} />}
              value={reason} onChangeText={setReason} multiline
            />
          </View>
          {error && <View style={{ marginTop: 8 }}><ErrorBanner message={error} /></View>}
          <View style={{ marginTop: 16, gap: 8 }}>
            <PrimaryButton label={props.confirmLabel} onPress={submit} busy={busy} />
            <Pressable onPress={() => !busy && props.onClose()} style={{ paddingVertical: 12, alignItems: 'center', minHeight: 44 }}>
              <Text style={{ color: theme.colors.textSecondary, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
  card: { borderWidth: 1, borderRadius: 24, padding: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10 },
  sectionBar: { width: 4, height: 14, borderRadius: 2 },
  sectionText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
});