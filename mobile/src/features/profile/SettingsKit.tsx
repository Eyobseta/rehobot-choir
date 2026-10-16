import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { BRAND, withAlpha } from '../auth/Auth_UI';

/**
 * Shared pieces for the Appearance and Language screens.
 * Put this file next to AppearanceScreen.tsx and LanguageScreen.tsx.
 */

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BORDER_GRADIENT = [BRAND.violet, BRAND.magenta, BRAND.gold] as const;
const HERO_GRADIENT = [BRAND.deep, BRAND.violet, BRAND.magenta] as const;

// Animation state is presentation-only and never changes saved settings.
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

/** Slide/fade style for staggered entrance. */
export function fadeUp(enter: Animated.Value, i: number) {
  return {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 12, 0] }) }],
  };
}

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
    <LinearGradient
      colors={HERO_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View pointerEvents="none" style={[styles.blob, { top: -50, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.2) }]} />
      <View pointerEvents="none" style={[styles.blob, { bottom: -70, left: -40, backgroundColor: withAlpha(BRAND.water, 0.2) }]} />
      <View style={styles.heroIcon}>
        <Ionicons name={icon} size={26} color={BRAND.deep} />
      </View>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      </View>
    </LinearGradient>
  );
}

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
        marginBottom: 18,
        borderRadius: 24,
        backgroundColor: colors.surface,
        shadowColor: BRAND.magenta,
        shadowOpacity: active ? 0.35 : 0,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: active ? 8 : 0,
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
        {/* border track: plain border colour, with the brand gradient fading in when selected */}
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
              <View style={[styles.radio, { borderColor: active ? BRAND.gold : colors.border }]}>
                <Animated.View style={[styles.check, { opacity: check, transform: [{ scale: check }] }]}>
                  <Ionicons name="checkmark" size={16} color={BRAND.deep} />
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 22,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 26,
  },
  blob: { position: 'absolute', width: 170, height: 170, borderRadius: 85 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  heroSubtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  label: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, marginTop: 2 },
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});