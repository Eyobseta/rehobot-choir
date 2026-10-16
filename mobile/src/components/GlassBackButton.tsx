import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  View,
  AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  tint?: string;   // arrow color, default white
  size?: number;   // outer diameter, default 48
};

const ABS_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

// Brand colours (violet / magenta / gold / water)
const RIM = ['#FFC247', '#E0409A', '#6C3FE0', '#38BDF8'] as const;
const SPHERE = ['#A78BFA', '#6C3FE0', '#E0409A', '#7A1B4F'] as const;
const BASE = '#2A0F57'; // dark "side" of the 3D key

/**
 * Modern, colorful, 3D interactive back button.
 *
 * - Sits on a dark base, so it looks like a real key.
 * - On press the face sinks into the base, squashes slightly, flashes,
 *   the arrow nudges back and a ring ripples outwards.
 * - On release it springs back up with a little bounce.
 * - A soft light sweep glides across the glass every few seconds
 *   (skipped when the phone has "reduce motion" turned on).
 *
 * Layout footprint is exactly size x size, same as before.
 */
export default function GlassBackButton({
  onPress,
  accessibilityLabel = 'Back',
  tint = '#FFFFFF',
  size = 48,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0)).current; // 0 = up, 1 = pressed
  const ripple = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    ripple.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.94,
        speed: 40,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.timing(shine, {
        toValue: 1,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(ripple, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 28,
        bounciness: 14,
        useNativeDriver: true,
      }),
      Animated.spring(shine, {
        toValue: 0,
        speed: 24,
        bounciness: 14,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Idle light sweep across the glass.
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled || reduced) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(sweep, {
              toValue: 1,
              duration: 900,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.delay(3600),
          ]),
        );
        loop.start();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [sweep]);

  const ringThickness = Math.max(3, Math.round(size * 0.08));
  const inner = size - ringThickness * 2;
  const depth = Math.max(4, Math.round(size * 0.11)); // how far the face sinks

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale }],
        },
      ]}
    >
      {/* ---------- Ripple ring (fires on press) ---------- */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: '#FFC247',
          opacity: ripple.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 0.7, 0],
          }),
          transform: [
            {
              scale: ripple.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.9],
              }),
            },
          ],
        }}
      />

      {/* ---------- Base / side of the 3D key (peeks out underneath) ---------- */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: depth,
          left: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: BASE,
          shadowColor: '#E0409A',
          shadowOpacity: 0.55,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 9,
        }}
      />

      {/* ---------- Face: sinks into the base while pressed ---------- */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [
            {
              translateY: shine.interpolate({
                inputRange: [0, 1],
                outputRange: [0, depth * 0.85],
              }),
            },
          ],
        }}
      >
        {/* Vibrant outer rim */}
        <LinearGradient
          colors={RIM}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Dark translucent bevel for contrast */}
          <View
            style={{
              width: inner + 2,
              height: inner + 2,
              borderRadius: (inner + 2) / 2,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Glass sphere */}
            <LinearGradient
              colors={SPHERE}
              locations={[0, 0.35, 0.75, 1]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={{
                width: inner,
                height: inner,
                borderRadius: inner / 2,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Top specular highlight */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: inner * 0.04,
                  left: inner * 0.15,
                  right: inner * 0.15,
                  height: inner * 0.4,
                  borderRadius: inner * 0.4,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  transform: [{ scaleY: 0.5 }],
                }}
              />

              {/* Bottom bounce light */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: inner * 0.05,
                  left: inner * 0.2,
                  right: inner * 0.2,
                  height: inner * 0.2,
                  borderRadius: inner * 0.2,
                  backgroundColor: 'rgba(56, 189, 248, 0.45)',
                  transform: [{ scaleY: 0.4 }],
                }}
              />

              {/* Diagonal sheen */}
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[ABS_FILL, { borderRadius: inner / 2 }]}
              />

              {/* Moving light sweep (idle animation) */}
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -inner * 0.3,
                  width: inner * 0.26,
                  height: inner * 1.6,
                  backgroundColor: 'rgba(255,255,255,0.35)',
                  transform: [
                    {
                      translateX: sweep.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-inner * 0.9, inner * 0.9],
                      }),
                    },
                    { rotate: '25deg' },
                  ],
                }}
              />

              {/* Press flash */}
              <Animated.View
                pointerEvents="none"
                style={[
                  ABS_FILL,
                  {
                    borderRadius: inner / 2,
                    backgroundColor: '#FFFFFF',
                    opacity: shine.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.4],
                    }),
                  },
                ]}
              />

              {/* Arrow: nudges back while pressed */}
              <Animated.View
                pointerEvents="none"
                style={{
                  transform: [
                    {
                      translateX: shine.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -Math.max(2, Math.round(inner * 0.1))],
                      }),
                    },
                  ],
                }}
              >
                <Ionicons
                  name="arrow-back"
                  size={Math.round(inner * 0.55)}
                  color={tint}
                  style={{
                    marginLeft: -Math.round(inner * 0.04),
                    textShadowColor: 'rgba(0, 0, 0, 0.4)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 3,
                  }}
                />
              </Animated.View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ---------- Tappable layer (covers the whole button) ---------- */}
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[ABS_FILL, { borderRadius: size / 2 }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});