import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const BRAND = {
  deep: '#24135C',
  violet: '#6C3FE0',
  magenta: '#E0409A',
  gold: '#FFC247',
};

export default function AppLoading() {
  // Fade-in for the whole screen
  const fade = useRef(new Animated.Value(0)).current;
  // Scale pulse for the logo mark
  const pulse = useRef(new Animated.Value(0)).current;
  // Shimmer sweep across the title
  const shimmer = useRef(new Animated.Value(0)).current;
  // Subtle dot loader pulse
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    // 1. Fade in
    Animated.timing(fade, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 2. Logo pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    // 3. Shimmer sweep
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ]),
    );
    shimmerLoop.start();

    // 4. Dots pulse
    const dotLoops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(d, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(d, {
            toValue: 0.3,
            duration: 500,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    dotLoops.forEach((l) => l.start());

    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
      dotLoops.forEach((l) => l.stop());
    };
  }, [fade, pulse, shimmer, dots]);

  return (
    <View style={styles.container}>
      {/* Background gradient */}
      <LinearGradient
        colors={[BRAND.deep, '#1A0F45', BRAND.deep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft glow blobs */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            top: -80,
            left: -60,
            backgroundColor: 'rgba(108, 63, 224, 0.35)',
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            bottom: -80,
            right: -60,
            backgroundColor: 'rgba(224, 64, 154, 0.3)',
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }],
          },
        ]}
      />

      <Animated.View style={[styles.center, { opacity: fade }]}>
        {/* Logo mark with pulsing glow */}
        <Animated.View
          style={[
            styles.logoMark,
            {
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[BRAND.gold, BRAND.magenta, BRAND.violet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="musical-notes" size={40} color={BRAND.deep} />
          </LinearGradient>
        </Animated.View>

        {/* Animated wordmark */}
        <View style={{ marginTop: 28, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row' }}>
            {/* Base text (always visible) */}
            <Text style={styles.titleBase}>REHOBOT</Text>
            {/* Shimmer overlay */}
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    {
                      translateX: shimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-width, width],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255, 194, 71, 0.9)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <Text style={styles.subtitle}>CHOIR</Text>
        </View>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
            },
          ]}
        >
          Sing together, grow together
        </Animated.Text>

        {/* Three pulsing dots instead of a spinner */}
        <View style={styles.dotsRow}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: d,
                  transform: [
                    {
                      scale: d.interpolate({ inputRange: [0.3, 1], outputRange: [1, 1.4] }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.deep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  center: {
    alignItems: 'center',
  },
  logoMark: {
    width: 92,
    height: 92,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: BRAND.gold,
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBase: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '800',
    color: BRAND.gold,
    letterSpacing: 14,
    marginTop: 4,
    paddingLeft: 10, // offset for letter-spacing
  },
  tagline: {
    marginTop: 24,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 36,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND.gold,
  },
});