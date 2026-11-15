import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  onPress: () => void;
  accessibilityLabel?: string;
  tint?: string;
  size?: number;
};

// Frosted glass fill + a soft saffron glow behind it
const GLASS_COLORS = ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)'] as const;
const GLOW_COLORS = ['#FFB400', '#3D5AFE', '#12B5A6'] as const;

export default function GlassBackButton({
  onPress,
  accessibilityLabel = 'Back',
  tint = '#FFFFFF',
  size = 48,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.9,
        speed: 50,
        bounciness: 4,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
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
      Animated.timing(glow, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const r = size / 2;

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
            borderRadius: r,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Saffron glow, fades in on press */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
          <LinearGradient
            colors={GLOW_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Glass layer */}
        <LinearGradient
          colors={GLASS_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderRadius: r }]}
        >
          <Ionicons
            name="chevron-back"
            size={Math.round(size * 0.5)}
            color={tint}
            style={styles.icon}
          />
        </LinearGradient>

        {/* Hairline border + top highlight for the glass edge */}
        <View
          pointerEvents="none"
          style={[styles.border, { borderRadius: r }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(11, 18, 54, 0.55)',
    shadowColor: '#3D5AFE',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 2, // optical centering for the chevron
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
});