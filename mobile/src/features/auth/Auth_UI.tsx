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
import { changeLanguage } from '../../i18n';

/**
 * Shared UI kit for the auth screens (Login / Register / Status).
 * Lives next to the screens: src/features/auth/Auth_UI.tsx
 * Requires: npx expo install expo-linear-gradient
 *
 * Design language: deep teal, lime, lavender and mint. Flat geometric shapes,
 * squircle controls, no heavy gradients.
 */

export const BRAND = {
  // Palette sampled from the design reference
  teal: '#1D4550',
  tealDark: '#163740',
  lime: '#C4F44F',
  lavender: '#D3C3F8',
  lavenderSoft: '#EFE9FF',
  mint: '#63D485',
  cream: '#FAF3EB',

  // Legacy keys: HomeScreen, AnimatedTabBar and others still import these.
  // They map to darker shades of the new palette so white text on them stays
  // readable. Remove them once those screens are migrated.
  deep: '#1D4550',
  violet: '#2F7A6B',
  magenta: '#7D63C4',
  gold: '#C4F44F',
  water: '#D3C3F8',
};

/** Shared control geometry */
export const FIELD_RADIUS = 14;
export const BUTTON_RADIUS = 16;

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

/** Picks deep teal or white, whichever reads better on top of `bg`. */
export function onColor(bg: string): string {
  if (typeof bg === 'string' && bg.startsWith('#') && bg.length === 7) {
    const r = parseInt(bg.slice(1, 3), 16);
    const g = parseInt(bg.slice(3, 5), 16);
    const b = parseInt(bg.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? BRAND.teal : '#FFFFFF';
  }
  return '#FFFFFF';
}

// ---------------------------------------------------------------------------
// Keyboard-aware scrolling (shared with AuthField through context)
// ---------------------------------------------------------------------------

type ScrollCtxValue = { ensureVisible: (node: View | null) => void };
const ScrollCtx = createContext<ScrollCtxValue>({ ensureVisible: () => {} });

// ---------------------------------------------------------------------------
// Floating drops (decorative, ignores touches)
// ---------------------------------------------------------------------------

const DROPS = [
  { x: 0.08, size: 16, color: BRAND.lavender, dur: 12000, delay: 0 },
  { x: 0.22, size: 26, color: BRAND.mint, dur: 16000, delay: 2500 },
  { x: 0.36, size: 11, color: BRAND.lime, dur: 11000, delay: 5200 },
  { x: 0.5, size: 22, color: BRAND.lavender, dur: 15000, delay: 1200 },
  { x: 0.63, size: 14, color: BRAND.mint, dur: 13000, delay: 6800 },
  { x: 0.76, size: 28, color: BRAND.lime, dur: 17000, delay: 3800 },
  { x: 0.88, size: 12, color: BRAND.lavender, dur: 12500, delay: 8200 },
  { x: 0.95, size: 20, color: BRAND.mint, dur: 14500, delay: 900 },
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
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderTopRightRadius: 0,
          transform: [{ rotate: '-45deg' }],
          backgroundColor: withAlpha(color, 0.3),
          borderWidth: 1,
          borderColor: withAlpha(color, 0.7),
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
// Brand header: flat shapes + the choir logo (a lavender sun with voices)
// ---------------------------------------------------------------------------

/** Gentle vertical drift for decorative shapes. */
function Float({
  children,
  style,
  amp = 6,
  dur = 3600,
  delay = 0,
}: {
  children?: React.ReactNode;
  style?: any;
  amp?: number;
  dur?: number;
  delay?: number;
}) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, {
          toValue: 1,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(p, {
          toValue: 0,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
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
      style={[
        style,
        {
          transform: [
            { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

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
        borderWidth: 1.5,
        borderColor: color,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
      }}
    />
  );
}

/** Five little "voices" that bounce out of phase. */
function LogoBars({ size }: { size: number }) {
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(b, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0.3,
            duration: 520,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);

  const h = size * 0.46;
  const w = Math.max(3, size * 0.075);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: Math.max(2, size * 0.05),
        height: h,
      }}
    >
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{
            width: w,
            height: h,
            borderRadius: w / 2,
            backgroundColor: i % 2 === 0 ? BRAND.teal : BRAND.mint,
            transform: [{ scaleY: b }],
          }}
        />
      ))}
    </View>
  );
}

function Logo({ size }: { size: number }) {
  const pop = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [pop]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ring size={size} delay={0} color={BRAND.lavender} />
      <Ring size={size} delay={1500} color={BRAND.lime} />
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: BRAND.lavender,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop }],
        }}
      >
        <LogoBars size={size} />
      </Animated.View>
    </View>
  );
}

/** REHOBOT with the two O's lit in lime. */
function Wordmark({ size, spacing }: { size: number; spacing: number }) {
  const o = { color: BRAND.lime };
  return (
    <Text
      style={{
        color: '#FFFFFF',
        fontSize: size,
        fontWeight: '800',
        letterSpacing: spacing,
      }}
    >
      REH<Text style={o}>O</Text>B<Text style={o}>O</Text>T
    </Text>
  );
}

/**
 * Small EN | አማ pill shown in the top-right corner of the brand header.
 * Persists the choice through changeLanguage() (AsyncStorage).
 */
export function LanguageToggle({ top }: { top: number }) {
  const { t, i18n } = useTranslation();
  const isAm = (i18n.language || 'en').startsWith('am');

  const seg = (code: 'en' | 'am', label: string, active: boolean) => (
    <Pressable
      key={code}
      onPress={() => {
        if (!active) void changeLanguage(code);
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 11,
        backgroundColor: active ? BRAND.lime : 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '800',
          color: active ? BRAND.teal : 'rgba(255,255,255,0.8)',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      accessibilityLabel={t('language.title', { defaultValue: 'Language' })}
      style={{
        position: 'absolute',
        top,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 3,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        backgroundColor: BRAND.tealDark,
        zIndex: 10,
      }}
    >
      {seg('en', 'EN', !isAm)}
      {seg('am', 'አማ', isAm)}
    </View>
  );
}

/** Sun/moon button, top-left of the brand header. Uses ThemeContext. */
export function ThemeToggle({ top }: { top: number }) {
  const { mode, toggleTheme } = useTheme();
  return (
    <Pressable
      onPress={toggleTheme}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Toggle theme"
      style={{
        position: 'absolute',
        top,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        backgroundColor: BRAND.tealDark,
        zIndex: 10,
      }}
    >
      <Ionicons name={mode === 'dark' ? 'sunny' : 'moon'} size={17} color={BRAND.lime} />
    </Pressable>
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
  const k = compact ? 0.7 : 1; // shape scale

  return (
    <View style={{ backgroundColor: BRAND.teal, marginTop: -1000, paddingTop: 1000 }}>
      <View
        style={{
          paddingTop: topPad,
          paddingBottom: compact ? 50 : 66,
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Flat geometric shapes (echo the loading screen) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -175 * k,
            left: -55 * k,
            width: 250 * k,
            height: 250 * k,
            borderRadius: 125 * k,
            backgroundColor: BRAND.lime,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 30 * k,
            right: -28 * k,
            width: 86 * k,
            height: 86 * k,
            borderRadius: 43 * k,
            backgroundColor: BRAND.lavender,
          }}
        />
        <Float
          amp={7}
          style={{
            position: 'absolute',
            bottom: -36 * k,
            right: -22 * k,
            width: 124 * k,
            height: 124 * k,
            borderRadius: 62 * k,
            backgroundColor: BRAND.mint,
          }}
        />
        <Float
          amp={5}
          dur={3000}
          delay={600}
          style={{
            position: 'absolute',
            bottom: 28 * k,
            left: 30 * k,
            width: 20 * k,
            height: 20 * k,
            borderRadius: 5,
            backgroundColor: BRAND.lavenderSoft,
            transform: [{ rotate: '45deg' }],
          }}
        />

        {compact ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Logo size={46} />
            <View>
              <Wordmark size={22} spacing={4} />
              <Text
                style={{
                  color: BRAND.lime,
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 9,
                  marginTop: 2,
                }}
              >
                CHOIR
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Logo size={88} />
            <View style={{ marginTop: 20 }}>
              <Wordmark size={30} spacing={6} />
            </View>
            <View
              style={{
                marginTop: 10,
                paddingHorizontal: 16,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: BRAND.lime,
              }}
            >
              <Text
                style={{
                  color: BRAND.teal,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 6,
                  paddingLeft: 6,
                }}
              >
                CHOIR
              </Text>
            </View>
            {subtitle ? (
              <Text
                style={{
                  marginTop: 12,
                  color: 'rgba(255,255,255,0.74)',
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

        <LanguageToggle top={insets.top + 8} />
        <ThemeToggle top={insets.top + 8} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen shell: header + rounded sheet + keyboard handling + drops
// ---------------------------------------------------------------------------

/**
 * ScrollView + keyboard handling. Use it for any screen with inputs:
 * the focused field is scrolled just above the keyboard.
 * Drops are opt-in via `drops` (default: off).
 */
export function KeyboardAwareScroll({
  children,
  contentContainerStyle,
  drops = false,
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
// Avatar with a slowly rotating colour ring
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
  children?: React.ReactNode;
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
          colors={[BRAND.lime, BRAND.mint, BRAND.lavender, BRAND.lime]}
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
// Input: flat squircle with an animated focus ring
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
  inputRef,
  error,
  helper,
  maxLength,
  autoComplete,
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
  /** Pass a ref to focus this field from the previous one. */
  inputRef?: React.Ref<TextInput>;
  /** Red state (invalid). */
  error?: boolean;
  /** Small hint text under the field. */
  helper?: string;
  maxLength?: number;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { ensureVisible } = useContext(ScrollCtx);

  const wrapRef = useRef<View>(null);
  const focus = useRef(new Animated.Value(0)).current;
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const [focused, setFocused] = useState(false);

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focus, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    ensureVisible(wrapRef.current);
  };

  const onBlur = () => {
    setFocused(false);
    Animated.timing(focus, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const r = FIELD_RADIUS;

  return (
    <View ref={wrapRef} collapsable={false} style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text
          style={[
            typography.bodySmall,
            {
              color: error ? colors.error : focused ? colors.primary : colors.textSecondary,
              marginBottom: spacing.xs,
              fontWeight: '600',
            },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={{
          minHeight: multiline ? 120 : 52,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          paddingHorizontal: spacing.md,
          borderRadius: r,
          borderWidth: 1.5,
          borderColor: error ? colors.error : colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {/* Focus ring fades in over the base border */}
        {!error ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -1.5,
              left: -1.5,
              right: -1.5,
              bottom: -1.5,
              borderRadius: r,
              borderWidth: 2,
              borderColor: colors.primary,
              opacity: focus,
            }}
          />
        ) : null}

        {iconNode ? (
          <View style={{ marginRight: spacing.sm, marginTop: multiline ? 10 : 0 }}>{iconNode}</View>
        ) : icon ? (
          <Text style={{ fontSize: 16, marginRight: spacing.sm, marginTop: multiline ? 14 : 0 }}>{icon}</Text>
        ) : null}
        <TextInput
          ref={inputRef}
          maxLength={maxLength}
          autoComplete={autoComplete}
          blurOnSubmit={returnKeyType !== 'next'}
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
          <Ionicons name="checkmark-circle" size={18} color={BRAND.mint} />
        ) : null}
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Text style={[typography.bodySmall, { color: colors.primary, fontWeight: '700' }]}>
              {hidden
                ? t('auth.show', { defaultValue: 'Show' })
                : t('auth.hide', { defaultValue: 'Hide' })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {helper ? (
        <Text
          style={[
            typography.caption,
            { color: error ? colors.error : colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

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
  const { colors, spacing, typography } = theme;
  const scale = useRef(new Animated.Value(1)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  const off = !!busy || !!disabled;
  const dark = theme.mode === 'dark';

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
        Animated.delay(2600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [w, off, sheen]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  // Screens pass white icons; recolor them so they read on lime / teal.
  const iconEl = React.isValidElement(iconNode)
    ? React.cloneElement(iconNode as React.ReactElement<any>, { color: colors.primaryText })
    : iconNode;

  return (
    <Animated.View
      style={[
        {
          borderRadius: BUTTON_RADIUS,
          backgroundColor: colors.primary,
          opacity: off ? 0.6 : 1,
          transform: [{ scale }],
          shadowColor: colors.primary,
          shadowOpacity: dark ? 0.3 : 0.24,
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
        <View
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={{
            minHeight: 54,
            paddingVertical: spacing.md,
            borderRadius: BUTTON_RADIUS,
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
                width: 40,
                height: 120,
                backgroundColor: dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.22)',
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
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <>
              {iconEl ?? (icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : null)}
              <Text style={[typography.button, { color: colors.primaryText, fontWeight: '800' }]}>
                {label}
              </Text>
            </>
          )}
        </View>
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
  const { colors, spacing, typography } = theme;
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
          borderRadius: BUTTON_RADIUS,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[typography.button, { color: colors.text, fontWeight: '700' }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: FIELD_RADIUS,
        borderWidth: 1,
        borderColor: withAlpha(colors.error, 0.4),
        backgroundColor: withAlpha(colors.error, 0.12),
        gap: spacing.sm,
      }}
    >
      <Ionicons name="alert-circle" size={20} color={colors.error} />
      <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{message}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stepper
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
  const s = useRef(new Animated.Value(state === 'current' ? 1.1 : 1)).current;

  useEffect(() => {
    Animated.spring(s, {
      toValue: state === 'current' ? 1.1 : 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, [state, s]);

  const bg =
    state === 'done' ? BRAND.mint : state === 'current' ? colors.primary : colors.surface;
  const fg = state === 'done' ? BRAND.teal : colors.primaryText;

  return (
    <Animated.View
      style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: state === 'todo' ? 1.5 : 0,
        borderColor: colors.border,
        transform: [{ scale: s }],
        shadowColor: colors.primary,
        shadowOpacity: state === 'current' ? 0.4 : 0,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: state === 'current' ? 6 : 0,
      }}
    >
      <Text
        style={{
          fontSize: state === 'done' ? 18 : 16,
          fontWeight: '800',
          color: state === 'todo' ? colors.textSecondary : fg,
          opacity: state === 'todo' ? 0.7 : 1,
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
                  backgroundColor: BRAND.mint,
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