import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  tint?: string;
  size?: number;
  /** 'glass' = translucent, for dark/teal headers. 'solid' = deep teal, for light surfaces. */
  variant?: 'glass' | 'solid';
};

// Palette sampled from the design reference
const TEAL = '#1D4550';
const LIME = '#C4F44F';

export default function GlassBackButton({
  onPress,
  accessibilityLabel = 'Back',
  tint = '#FFFFFF',
  size = 48,
  variant = 'glass',
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  // 0 = resting, 1 = pressed (lime fill + teal icon)
  const active = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.92,
        speed: 50,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.timing(active, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 30,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.timing(active, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const radius = Math.round(size * 0.36); // squircle, not a circle
  const iconSize = Math.round(size * 0.46);
  const solid = variant === 'solid';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: solid ? TEAL : 'rgba(14, 38, 44, 0.55)',
            borderColor: solid ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
            transform: [{ scale }],
          },
        ]}
      >
        {/* Lime fill, fades in on press */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: LIME, opacity: active },
          ]}
        />

        {/* Resting icon */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.iconLayer,
            {
              opacity: active.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [
                { translateX: active.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
              ],
            },
          ]}
        >
          <Ionicons name="chevron-back" size={iconSize} color={tint} />
        </Animated.View>

        {/* Pressed icon */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.iconLayer,
            {
              opacity: active,
              transform: [
                { translateX: active.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
              ],
            },
          ]}
        >
          <Ionicons name="arrow-back" size={iconSize} color={TEAL} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});