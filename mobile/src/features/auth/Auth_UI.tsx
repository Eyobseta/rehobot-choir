import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  AccessibilityInfo,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Shared UI kit for the auth screens (Login / Register / Status).
 * Lives next to the screens: src/features/auth/AuthUI.tsx
 * Requires: npx expo install expo-linear-gradient
 */

export const BRAND = {
  deep: '#24135C',
  violet: '#6C3FE0',
  magenta: '#E0409A',
  gold: '#FFC247',
  water: '#38BDF8',
};

const BORDER_COLORS = [
  BRAND.violet,
  BRAND.magenta,
  BRAND.gold,
  BRAND.violet,
  BRAND.magenta,
  BRAND.gold,
  BRAND.violet,
] as const;

const BUTTON_COLORS = [BRAND.violet, BRAND.magenta] as const;

/** "#RRGGBB" + alpha (0..1) -> "#RRGGBBAA". Falls back to the colour itself. */
export function withAlpha(color: string, alpha: number): string {
  if (typeof color === 'string' && color.startsWith('#') && color.length === 7) {
    const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
      .toString(16)
      .padStart(2, '0');
    return `${color}${a}`;
  }
  return color;
}

// ---------------------------------------------------------------------------
// Keyboard-aware scrolling (shared with AuthField through context)
// ---------------------------------------------------------------------------

type ScrollCtxValue = { ensureVisible: (node: View | null) => void };
const ScrollCtx = createContext<ScrollCtxValue>({ ensureVisible: () => {} });

// ---------------------------------------------------------------------------
// Floating water drops (decorative, ignores touches)
// ---------------------------------------------------------------------------

const DROPS = [
  { x: 0.08, size: 16, color: BRAND.water, dur: 12000, delay: 0 },
  { x: 0.22, size: 26, color: BRAND.magenta, dur: 16000, delay: 2500 },
  { x: 0.36, size: 11, color: BRAND.gold, dur: 11000, delay: 5200 },
  { x: 0.5, size: 22, color: BRAND.violet, dur: 15000, delay: 1200 },
  { x: 0.63, size: 14, color: BRAND.water, dur: 13000, delay: 6800 },
  { x: 0.76, size: 28, color: BRAND.magenta, dur: 17000, delay: 3800 },
  { x: 0.88, size: 12, color: BRAND.gold, dur: 12500, delay: 8200 },
  { x: 0.95, size: 20, color: BRAND.violet, dur: 14500, delay: 900 },
];

function Drop({
  x,
  size,
  color,
  dur,
  delay,
  height,
  width,
}: (typeof DROPS)[number] & { height: number; width: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: dur,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [p, dur, delay]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * width - size / 2,
        top: 0,
        opacity: p.interpolate({
          inputRange: [0, 0.08, 0.9, 1],
          outputRange: [0, 0.75, 0.75, 0],
        }),
        transform: [
          {
            translateY: p.interpolate({
              inputRange: [0, 1],
              outputRange: [height + 40, -60],
            }),
          },
          {
            translateX: p.interpolate({
              inputRange: [0, 0.25, 0.5, 0.75, 1],
              outputRange: [0, 14, 0, -14, 0],
            }),
          },
        ],
      }}
    >
      {/* teardrop = rounded square with one sharp corner, rotated */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderTopRightRadius: 0,
          transform: [{ rotate: '-45deg' }],
          backgroundColor: withAlpha(color, 0.22),
          borderWidth: 1,
          borderColor: withAlpha(color, 0.6),
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: size * 0.2,
            bottom: size * 0.22,
            width: size * 0.22,
            height: size * 0.22,
            borderRadius: size * 0.11,
            backgroundColor: 'rgba(255,255,255,0.85)',
          }}
        />
      </View>
    </Animated.View>
  );
}

export function WaterDrops() {
  const { width, height } = useWindowDimensions();
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);

  if (reduce) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {DROPS.map((d, i) => (
        <Drop key={i} {...d} width={width} height={height} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Brand header: pulsing "sound ripples" around the choir logo
// ---------------------------------------------------------------------------

function Ring({ size, delay, color }: { size: number; delay: number; color: string }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(p, {
        toValue: 1,
        duration: 3000,
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
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
      }}
    />
  );
}

function Logo({ size }: { size: number }) {
  const pop = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [pop]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ring size={size} delay={0} color={BRAND.gold} />
      <Ring size={size} delay={1000} color={BRAND.magenta} />
      <Ring size={size} delay={2000} color="#FFFFFF" />
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: BRAND.gold,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop }],
          shadowColor: BRAND.gold,
          shadowOpacity: 0.6,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: size * 0.5, color: BRAND.deep, fontWeight: '800' }}>♪</Text>
      </Animated.View>
    </View>
  );
}

export function BrandHeader({
  subtitle,
  compact,
}: {
  subtitle?: string;
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (compact ? 14 : 30);

  return (
    // The oversized negative margin / padding keeps the colour visible when iOS over-scrolls.
    <View style={{ backgroundColor: BRAND.deep, marginTop: -1000, paddingTop: 1000 }}>
      <View
        style={{
          paddingTop: topPad,
          paddingBottom: compact ? 50 : 66,
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            left: -70,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: withAlpha(BRAND.violet, 0.55),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -70,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: withAlpha(BRAND.magenta, 0.4),
          }}
        />

        {compact ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Logo size={46} />
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 4 }}>
                REHOBOT
              </Text>
              <Text style={{ color: BRAND.gold, fontSize: 13, fontWeight: '700', letterSpacing: 9 }}>
                CHOIR
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Logo size={88} />
            <Text
              style={{
                marginTop: 18,
                color: '#FFFFFF',
                fontSize: 30,
                fontWeight: '800',
                letterSpacing: 6,
              }}
            >
              REHOBOT
            </Text>
            <Text
              style={{
                color: BRAND.gold,
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 12,
                marginTop: 2,
                paddingLeft: 12,
              }}
            >
              CHOIR
            </Text>
            {subtitle ? (
              <Text
                style={{
                  marginTop: 10,
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 13,
                  textAlign: 'center',
                  paddingHorizontal: 32,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen shell: header + rounded sheet + keyboard handling + water drops
// ---------------------------------------------------------------------------

/**
 * ScrollView + keyboard handling + water drops. Use it for any screen with inputs:
 * the focused field is scrolled just above the keyboard.
 */
export function KeyboardAwareScroll({
  children,
  contentContainerStyle,
  drops = true,
}: {
  children: React.ReactNode;
  contentContainerStyle?: any;
  drops?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const kbTop = useRef<number | null>(null);
  const pending = useRef<View | null>(null);
  const [kbOpen, setKbOpen] = useState(false);

  // Scroll just enough so the focused field sits above the keyboard.
  const reveal = useCallback((node: View | null) => {
    if (!node) return;
    node.measureInWindow((_x, y, _w, h) => {
      const top = kbTop.current;
      if (top == null) return;
      const bottom = y + h + 28;
      if (bottom > top) {
        scrollRef.current?.scrollTo({
          y: scrollY.current + (bottom - top),
          animated: true,
        });
      }
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kbTop.current = e.endCoordinates.screenY;
      setKbOpen(true);
      setTimeout(() => reveal(pending.current), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      kbTop.current = null;
      pending.current = null;
      setKbOpen(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [reveal]);

  const ensureVisible = useCallback(
    (node: View | null) => {
      pending.current = node;
      if (kbTop.current != null) setTimeout(() => reveal(node), 80);
    },
    [reveal],
  );

  return (
    <ScrollCtx.Provider value={{ ensureVisible }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
        >
          {children}
          {kbOpen ? <View style={{ height: 160 }} /> : null}
        </ScrollView>
        {drops ? <WaterDrops /> : null}
      </KeyboardAvoidingView>
    </ScrollCtx.Provider>
  );
}

export function AuthScreen({
  children,
  subtitle,
  compact,
}: {
  children: React.ReactNode;
  subtitle?: string;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAwareScroll>
        <BrandHeader subtitle={subtitle} compact={compact} />
        <View
          style={{
            flexGrow: 1,
            marginTop: -28,
            backgroundColor: colors.background,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xl + 8,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
        >
          {children}
        </View>
      </KeyboardAwareScroll>
    </>
  );
}

// ---------------------------------------------------------------------------
// Avatar with a slowly rotating gradient ring
// ---------------------------------------------------------------------------

export function AvatarRing({
  size = 104,
  uri,
  fallback,
  gapColor,
  children,
}: {
  size?: number;
  uri?: string | null;
  fallback?: React.ReactNode;
  gapColor: string;
  children?: React.ReactNode; // badges, positioned absolutely by the caller
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const ring = 5;
  const inner = size - ring * 2;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <LinearGradient
          colors={[BRAND.gold, BRAND.magenta, BRAND.violet, BRAND.water, BRAND.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          top: ring,
          left: ring,
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: gapColor,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: inner - 6, height: inner - 6, borderRadius: (inner - 6) / 2 }}
          />
        ) : (
          fallback
        )}
      </View>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Input with animated gradient border
// ---------------------------------------------------------------------------

export function AuthField({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  placeholder,
  icon,
  iconNode,
  showCheck,
  multiline,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
  placeholder?: string;
  icon?: string;
  iconNode?: React.ReactNode;
  showCheck?: boolean;
  multiline?: boolean;
  returnKeyType?: 'done' | 'next' | 'go';
  onSubmitEditing?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { ensureVisible } = useContext(ScrollCtx);

  const wrapRef = useRef<View>(null);
  const focus = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const [focused, setFocused] = useState(false);
  const [w, setW] = useState(0);

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focus, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (w > 0) {
      slide.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(slide, {
          toValue: -w,
          duration: 2600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
    }
    ensureVisible(wrapRef.current);
  };

  const onBlur = () => {
    setFocused(false);
    Animated.timing(focus, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      loopRef.current?.stop();
    });
  };

  useEffect(() => () => loopRef.current?.stop(), []);

  const r = radius.md;

  return (
    <View ref={wrapRef} collapsable={false} style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text
          style={[
            typography.bodySmall,
            {
              color: focused ? BRAND.violet : colors.textSecondary,
              marginBottom: spacing.xs,
              fontWeight: '600',
            },
          ]}
        >
          {label}
        </Text>
      ) : null}

      {/* border track: plain border colour, with a flowing gradient fading in on focus */}
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ borderRadius: r, overflow: 'hidden', backgroundColor: colors.border }}
      >
        {w > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: w * 2,
              opacity: focus,
              transform: [{ translateX: slide }],
            }}
          >
            <LinearGradient
              colors={BORDER_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        )}

        <View
          style={{
            margin: 2,
            minHeight: multiline ? 120 : 50,
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            paddingHorizontal: spacing.md,
            borderRadius: r - 2,
            backgroundColor: colors.surface,
          }}
        >
          {iconNode ? (
            <View style={{ marginRight: spacing.sm, marginTop: multiline ? 10 : 0 }}>{iconNode}</View>
          ) : icon ? (
            <Text style={{ fontSize: 16, marginRight: spacing.sm, marginTop: multiline ? 14 : 0 }}>{icon}</Text>
          ) : null}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType ?? 'default'}
            autoCapitalize={autoCapitalize ?? 'sentences'}
            secureTextEntry={secureTextEntry ? hidden : false}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={onFocus}
            onBlur={onBlur}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              color: colors.text,
              fontSize: typography.body.fontSize,
            }}
          />
          {showCheck && value.length > 0 ? (
            <Ionicons name="checkmark-circle" size={18} color={BRAND.gold} />
          ) : null}
          {secureTextEntry ? (
            <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
              <Text style={[typography.bodySmall, { color: BRAND.violet, fontWeight: '700' }]}>
                {hidden
                  ? t('auth.show', { defaultValue: 'Show' })
                  : t('auth.hide', { defaultValue: 'Hide' })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/** Gradient button with a periodic light sweep and a press-down spring. */
export function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
  flex,
  icon,
  iconNode,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  flex?: number;
  icon?: string;
  iconNode?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { spacing, radius, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const off = !!busy || !!disabled;

  useEffect(() => {
    if (!w || off) return;
    sheen.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [w, off, sheen]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        {
          borderRadius: radius.md,
          backgroundColor: BRAND.violet,
          opacity: off ? 0.65 : 1,
          transform: [{ scale }],
          shadowColor: BRAND.magenta,
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
          colors={BUTTON_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={{
            minHeight: 54,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          {w > 0 && !off ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -20,
                left: 0,
                width: 46,
                height: 120,
                backgroundColor: 'rgba(255,255,255,0.28)',
                transform: [
                  {
                    translateX: sheen.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-80, w + 40],
                    }),
                  },
                  { rotate: '20deg' },
                ],
              }}
            />
          ) : null}
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              {iconNode ?? (icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : null)}
              <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '700' }]}>
                {label}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export function SecondaryButton({
  label,
  onPress,
  flex,
}: {
  label: string;
  onPress: () => void;
  flex?: number;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, flex !== undefined ? { flex } : null]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        style={{
          minHeight: 54,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typography.button, { color: colors.text }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: radius.md,
        borderLeftWidth: 4,
        borderLeftColor: colors.error,
        backgroundColor: withAlpha(colors.error, 0.12),
      }}
    >
      <Text style={{ marginRight: spacing.sm }}>⚠️</Text>
      <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{message}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stepper: icon dots joined by animated progress lines
// ---------------------------------------------------------------------------

function StepDot({
  icon,
  state,
}: {
  icon: string;
  state: 'done' | 'current' | 'todo';
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const s = useRef(new Animated.Value(state === 'current' ? 1.12 : 1)).current;

  useEffect(() => {
    Animated.spring(s, {
      toValue: state === 'current' ? 1.12 : 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [state, s]);

  const bg =
    state === 'done' ? BRAND.gold : state === 'current' ? BRAND.magenta : colors.surface;

  return (
    <Animated.View
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: state === 'todo' ? 1.5 : 0,
        borderColor: colors.border,
        transform: [{ scale: s }],
        shadowColor: BRAND.magenta,
        shadowOpacity: state === 'current' ? 0.5 : 0,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: state === 'current' ? 6 : 0,
      }}
    >
      <Text
        style={{
          fontSize: state === 'done' ? 18 : 16,
          fontWeight: '800',
          color: state === 'done' ? BRAND.deep : '#FFFFFF',
          opacity: state === 'todo' ? 0.55 : 1,
        }}
      >
        {state === 'done' ? '✓' : icon}
      </Text>
    </Animated.View>
  );
}

export function Stepper({
  step,
  icons,
}: {
  step: number;
  icons: string[];
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const progress = useRef(new Animated.Value(step - 1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step - 1,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, progress]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {icons.map((icon, i) => (
        <React.Fragment key={i}>
          <StepDot
            icon={icon}
            state={i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo'}
          />
          {i < icons.length - 1 && (
            <View
              style={{
                flex: 1,
                height: 4,
                marginHorizontal: 6,
                borderRadius: 2,
                backgroundColor: colors.border,
                overflow: 'hidden',
              }}
            >
              <Animated.View
                style={{
                  height: 4,
                  backgroundColor: BRAND.gold,
                  width: progress.interpolate({
                    inputRange: [i, i + 1],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                }}
              />
            </View>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}