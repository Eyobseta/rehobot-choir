import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Palette sampled from the design reference: deep teal, lime, lavender, mint.
const BRAND = {
  teal: '#1D4550',
  tealDark: '#163740',
  lime: '#C4F44F',
  lavender: '#D3C3F8',
  lavenderSoft: '#EFE9FF',
  mint: '#63D485',
  cream: '#FAF3EB',
};

const TRACK_W = 132;
const BAR_W = 52;

export default function AppLoading() {
  const { width, height } = useWindowDimensions();

  // Fade-in for the whole screen
  const fade = useRef(new Animated.Value(0)).current;
  // Pulse drives the big shapes, the badge and the diamonds
  const pulse = useRef(new Animated.Value(0)).current;
  // Shimmer = the lime progress sweep under the headline
  const shimmer = useRef(new Animated.Value(0)).current;
  // Three loader dots
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    // 1. Fade in
    Animated.timing(fade, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 2. Pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    // 3. Progress sweep
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(250),
      ]),
    );
    shimmerLoop.start();

    // 4. Dots, staggered
    const dotLoops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(d, {
            toValue: 0.3,
            duration: 450,
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

  // Geometry
  const bigD = width * 1.08;
  const bigTop = height * 0.17;
  const limeD = width * 1.0;
  const mintD = width * 0.25;

  const shapeIn = {
    opacity: fade,
    transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
  };

  return (
    <View style={styles.container}>
      {/* Lime arc, cropped by the top edge */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shape,
          {
            width: limeD,
            height: limeD,
            borderRadius: limeD / 2,
            top: -limeD * 0.62,
            left: width * 0.02,
            backgroundColor: BRAND.lime,
          },
          shapeIn,
        ]}
      />

      {/* Small lavender circle, top-left corner */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shape,
          {
            width: 46,
            height: 46,
            borderRadius: 23,
            top: -10,
            left: 22,
            backgroundColor: BRAND.lavender,
          },
          shapeIn,
        ]}
      />

      {/* Mint circle, floats */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shape,
          {
            width: mintD,
            height: mintD,
            borderRadius: mintD / 2,
            top: height * 0.07,
            right: width * 0.05,
            backgroundColor: BRAND.mint,
            opacity: fade,
            transform: [
              { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [-7, 7] }) },
            ],
          },
        ]}
      />

      {/* Soft diamond */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shape,
          {
            width: 26,
            height: 26,
            borderRadius: 5,
            top: height * 0.075,
            right: width * 0.3,
            backgroundColor: BRAND.lavenderSoft,
            opacity: fade,
            transform: [
              { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '135deg'] }) },
            ],
          },
        ]}
      />

      {/* Big lavender circle with the logo badge */}
      <Animated.View
        style={[
          styles.shape,
          {
            width: bigD,
            height: bigD,
            borderRadius: bigD / 2,
            top: bigTop,
            left: -width * 0.1,
            backgroundColor: BRAND.lavender,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: fade,
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.badge,
            {
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
              ],
            },
          ]}
        >
          <Ionicons name="musical-notes" size={46} color={BRAND.lime} />
        </Animated.View>
      </Animated.View>

      {/* Lime diamond on the big circle */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shape,
          {
            width: 24,
            height: 24,
            borderRadius: 5,
            top: bigTop + bigD * 0.78,
            left: width * 0.2,
            backgroundColor: BRAND.lime,
            opacity: fade,
            transform: [
              { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '-45deg'] }) },
            ],
          },
        ]}
      />

      {/* Copy block, bottom-left */}
      <Animated.View style={[styles.copy, { opacity: fade }]}>
        <Text style={styles.eyebrow}>REHOBOT CHOIR</Text>
        <Text style={styles.headline}>Sing together,{'\n'}grow together</Text>

        {/* Lime progress sweep */}
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.bar,
              {
                transform: [
                  {
                    translateX: shimmer.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-BAR_W, TRACK_W],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: [BRAND.lime, BRAND.mint, BRAND.lavender][i],
                  opacity: d,
                  transform: [
                    { scale: d.interpolate({ inputRange: [0.3, 1], outputRange: [1, 1.5] }) },
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
    backgroundColor: BRAND.teal,
    overflow: 'hidden',
  },
  shape: {
    position: 'absolute',
  },
  badge: {
    width: 92,
    height: 92,
    borderRadius: 28,
    backgroundColor: BRAND.teal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.tealDark,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  copy: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 56,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    color: BRAND.lime,
    marginBottom: 10,
  },
  headline: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  track: {
    width: TRACK_W,
    height: 3,
    borderRadius: 2,
    marginTop: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  bar: {
    width: BAR_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND.lime,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});