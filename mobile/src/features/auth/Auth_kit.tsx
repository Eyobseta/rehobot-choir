import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, FIELD_RADIUS, onColor, withAlpha } from './Auth_UI';

/**
 * Extra building blocks for the Login / Register / Status screens.
 * Lives next to Auth_UI.tsx. Nothing here touches app logic, pure UI.
 */

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function FieldIcon({ name, color }: { name: IconName; color?: string }) {
  const { theme } = useTheme();
  return <Ionicons name={name} size={18} color={color ?? theme.colors.textSecondary} />;
}

/** Ionicon sized + tinted for use as AuthField `iconNode`. */
export function fieldIcon(name: IconName, color?: string) {
  return <FieldIcon name={name} color={color} />;
}

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------

/** Fades + slides children up. Use `index` to stagger. */
export function FadeInUp({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: any;
}) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 420,
      delay: index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [p, index]);

  return (
    <Animated.View
      style={[
        {
          opacity: p,
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Horizontal shake for error feedback. Spread `shakeStyle` on an Animated.View. */
export function useShake() {
  const x = useRef(new Animated.Value(0)).current;
  const shake = useCallback(() => {
    Animated.sequence(
      [10, -10, 8, -8, 4, 0].map((v) =>
        Animated.timing(x, { toValue: v, duration: 55, useNativeDriver: true }),
      ),
    ).start();
  }, [x]);
  return { shakeStyle: { transform: [{ translateX: x }] }, shake };
}

// ---------------------------------------------------------------------------
// Action tile (Login: "Register" / "Check status")
// Pastel card with a white icon box, like the specialty cards in the design.
// `tint` is the card's pastel colour.
// ---------------------------------------------------------------------------

export function ActionTile({
  icon,
  label,
  onPress,
  tint = BRAND.lavender,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  const { theme } = useTheme();
  const { spacing, radius, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          minHeight: 118,
          padding: spacing.md,
          borderRadius: radius.lg + 4,
          backgroundColor: tint,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
            }}
          >
            <Ionicons name={icon} size={22} color={BRAND.teal} />
          </View>
          <Ionicons name="arrow-forward" size={18} color={withAlpha(BRAND.teal, 0.6)} />
        </View>
        <Text style={[typography.bodySmall, { color: BRAND.teal, fontWeight: '800' }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Line, text, line */
export function LabeledDivider({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>{text}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Form pieces
// ---------------------------------------------------------------------------

/** Tappable date row (matches AuthField height/radius). Optional clear button. */
export function DateField({
  label,
  text,
  placeholder,
  icon,
  onPress,
  onClear,
  invalid,
}: {
  label: string;
  text: string;
  placeholder: string;
  icon: IconName;
  onPress: () => void;
  onClear?: () => void;
  invalid?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const filled = !!text;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          {
            color: invalid ? colors.error : colors.textSecondary,
            fontWeight: '600',
            marginBottom: spacing.xs,
          },
        ]}
      >
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          borderRadius: FIELD_RADIUS,
          borderWidth: 1.5,
          borderColor: invalid ? colors.error : filled ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          gap: spacing.sm,
        }}
      >
        <Ionicons name={icon} size={18} color={filled ? colors.primary : colors.textSecondary} />
        <Text
          style={[
            typography.body,
            { flex: 1, color: filled ? colors.text : colors.textSecondary },
          ]}
        >
          {filled ? text : placeholder}
        </Text>
        {filled && onClear ? (
          <Pressable onPress={onClear} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear">
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        )}
      </Pressable>
    </View>
  );
}

export type Choice<T extends string> = { value: T; label: string; icon: IconName };

/** Segmented choice cards (used for gender). The active card fills with the primary colour. */
export function ChoiceCards<T extends string>({
  label,
  options,
  value,
  onChange,
  invalid,
}: {
  label: string;
  options: Choice<T>[];
  value: T | '';
  onChange: (v: T) => void;
  invalid?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          {
            color: invalid ? colors.error : colors.textSecondary,
            fontWeight: '600',
            marginBottom: spacing.xs,
          },
        ]}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                minHeight: 58,
                borderRadius: FIELD_RADIUS,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : invalid ? colors.error : colors.border,
                backgroundColor: active ? colors.primary : colors.surface,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons
                  name={o.icon}
                  size={20}
                  color={active ? colors.primaryText : colors.textSecondary}
                />
                <Text
                  style={[
                    typography.body,
                    {
                      color: active ? colors.primaryText : colors.text,
                      fontWeight: active ? '800' : '500',
                    },
                  ]}
                >
                  {o.label}
                </Text>
                {active ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primaryText} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 4-bar strength meter + "8+ characters" hint. Purely visual feedback. */
export function PasswordMeter({ password }: { password: string }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  if (!password) return null;

  const long = password.length >= 8;
  let score =
    (long ? 1 : 0) +
    (password.length >= 12 ? 1 : 0) +
    (/[a-z]/.test(password) && /[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) || /[^A-Za-z0-9]/.test(password) ? 1 : 0);
  if (!long) score = Math.min(score, 1);
  score = Math.max(score, 1);

  const palette = [colors.error, colors.warning, colors.primary, colors.success];
  const labels = [
    t('register.strengthWeak', { defaultValue: 'Weak' }),
    t('register.strengthFair', { defaultValue: 'Fair' }),
    t('register.strengthGood', { defaultValue: 'Good' }),
    t('register.strengthStrong', { defaultValue: 'Strong' }),
  ];
  const color = palette[score - 1];

  return (
    <View style={{ marginTop: -spacing.xs, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                backgroundColor: i <= score ? color : colors.border,
              }}
            />
          ))}
        </View>
        <Text style={[typography.caption, { color, fontWeight: '700', minWidth: 48, textAlign: 'right' }]}>
          {labels[score - 1]}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <Ionicons
          name={long ? 'checkmark-circle' : 'ellipse-outline'}
          size={14}
          color={long ? colors.success : colors.textSecondary}
        />
        <Text style={[typography.caption, { color: long ? colors.success : colors.textSecondary }]}>
          {t('register.passwordHint', { defaultValue: 'At least 8 characters' })}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Review card pieces (Register step 3)
// ---------------------------------------------------------------------------

export function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg + 4,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={[typography.bodySmall, { flex: 1, color: colors.primary, fontWeight: '800', letterSpacing: 0.8 }]}>
          {title.toUpperCase()}
        </Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={10}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: withAlpha(colors.accent, 0.16),
            }}
          >
            <Ionicons name="create-outline" size={14} color={colors.accent} />
            <Text style={[typography.caption, { color: colors.accent, fontWeight: '800' }]}>
              {t('register.edit', { defaultValue: 'Edit' })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function ReviewRow({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: withAlpha(colors.border, 0.7),
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(colors.accent, 0.16),
        }}
      >
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Status screen pieces
// ---------------------------------------------------------------------------

function PulseRing({ size, color, delay }: { size: number; color: string; delay: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [p, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
      }}
    />
  );
}

export function StatusBadge({
  kind,
  color,
}: {
  kind: 'PENDING' | 'APPROVED' | 'REJECTED';
  color: string;
}) {
  const pop = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    pop.setValue(0.5);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
  }, [kind, pop]);

  const icon: IconName =
    kind === 'APPROVED' ? 'checkmark' : kind === 'REJECTED' ? 'close' : 'hourglass-outline';
  const size = 84;

  return (
    <View style={{ width: size * 1.9, height: size * 1.9, alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'PENDING' ? (
        <>
          <PulseRing size={size} color={color} delay={0} />
          <PulseRing size={size} color={color} delay={1200} />
        </>
      ) : null}
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color,
          transform: [{ scale: pop }],
          shadowColor: color,
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <Ionicons name={icon} size={42} color={onColor(color)} />
      </Animated.View>
    </View>
  );
}

/** Submitted, In review, Decision */
export function StatusTimeline({
  status,
  decisionColor,
  pendingColor,
}: {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionColor: string;
  pendingColor: string;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, typography } = theme;

  const steps: {
    label: string;
    state: 'done' | 'current' | 'todo';
    color: string;
    icon: IconName;
  }[] = [
    {
      label: t('status.stepSubmitted', { defaultValue: 'Submitted' }),
      state: 'done',
      color: colors.success,
      icon: 'checkmark',
    },
    {
      label: t('status.stepReview', { defaultValue: 'In review' }),
      state: status === 'PENDING' ? 'current' : 'done',
      color: status === 'PENDING' ? pendingColor : colors.success,
      icon: 'checkmark',
    },
    {
      label: t('status.stepDecision', { defaultValue: 'Decision' }),
      state: status === 'PENDING' ? 'todo' : 'done',
      color: decisionColor,
      icon: status === 'REJECTED' ? 'close' : 'checkmark',
    },
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <View style={{ width: 78, alignItems: 'center' }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: s.state === 'done' ? s.color : 'transparent',
                borderWidth: s.state === 'done' ? 0 : 2,
                borderColor: s.state === 'current' ? s.color : colors.border,
              }}
            >
              {s.state === 'done' ? (
                <Ionicons name={s.icon} size={15} color={onColor(s.color)} />
              ) : s.state === 'current' ? (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
              ) : null}
            </View>
            <Text
              style={[
                typography.caption,
                {
                  marginTop: 6,
                  textAlign: 'center',
                  fontWeight: s.state === 'todo' ? '500' : '700',
                  color: s.state === 'todo' ? colors.textSecondary : colors.text,
                },
              ]}
            >
              {s.label}
            </Text>
          </View>
          {i < steps.length - 1 ? (
            <View
              style={{
                flex: 1,
                height: 3,
                marginTop: 11.5,
                marginHorizontal: -6,
                borderRadius: 2,
                backgroundColor: steps[i + 1].state === 'todo' ? colors.border : steps[i].color,
              }}
            />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}