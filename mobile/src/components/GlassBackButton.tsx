import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, View } from 'react-native';
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

/**
 * Modern, colorful, 3D interactive back button — retains exact layout/press logic.
 */
export default function GlassBackButton({
  onPress,
  accessibilityLabel = 'Back',
  tint = '#FFFFFF',
  size = 48,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.9,
        speed: 40,
        bounciness: 8,
        useNativeDriver: true,
      }),
      Animated.timing(shine, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 28,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.timing(shine, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const ringThickness = Math.max(3, Math.round(size * 0.08));
  const inner = size - ringThickness * 2;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale }],
          // Colorful deep shadow casting a vibrant aura
          shadowColor: '#EC4899',
          shadowOpacity: 0.5,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        },
      ]}
    >
      {/* ---------- Vibrant Colorful Outer Ring (Cyan to Fuchsia Glow Rim) ---------- */}
      <LinearGradient
        colors={['#38BDF8', '#818CF8', '#C084FC', '#F43F5E']}
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
        {/* Deep translucent rim for maximum 3D contrast */}
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
          {/* ---------- Ultra-Vibrant Multi-Color 3D Sphere Core ---------- */}
          <LinearGradient
            colors={[
              '#38BDF8',    // Bright Electric Cyan top highlight
              '#6366F1',    // Rich Indigo mid-tone
              '#D946EF',    // Vivid Neon Fuchsia
              '#881337',    // Deep Crimson base for heavy 3D shadow
            ]}
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
            {/* Top curved glossy specular highlight (Glass bubble effect) */}
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

            {/* Bottom inner bounce reflection */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: inner * 0.05,
                left: inner * 0.2,
                right: inner * 0.2,
                height: inner * 0.2,
                borderRadius: inner * 0.2,
                backgroundColor: 'rgba(56, 189, 248, 0.4)',
                transform: [{ scaleY: 0.4 }],
              }}
            />

            {/* Diagonal sheen overlay */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[ABS_FILL, { borderRadius: inner / 2 }]}
            />

            {/* Press interactive flash effect */}
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

            {/* Tappable layer */}
            <Pressable
              onPress={onPress}
              onPressIn={pressIn}
              onPressOut={pressOut}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              style={[
                ABS_FILL,
                { alignItems: 'center', justifyContent: 'center' },
              ]}
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
            </Pressable>
          </LinearGradient>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});