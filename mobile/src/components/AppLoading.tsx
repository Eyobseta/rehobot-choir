import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Modern "sage & rose" palette
const BRAND = {
  night: '#161B17',
  deep: '#26352C',
  sage: '#8DB89C',
  rose: '#D9959D',
  honey: '#EBC48A',
  cream: '#F6EFE4',
};

const BAR_COUNT = 5;

export default function AppLoading() {
  // Fade-in for the whole screen
  const fade = useRef(new Animated.Value(0)).current;
  // Pulse drives the logo, the sound rings and the aurora glows
  const pulse = useRef(new Animated.Value(0)).current;
  // Shimmer sweep across the title
  const shimmer = useRef(new Animated.Value(0)).current;
  // Equalizer bars (replace the old dots)
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.25)),
  ).current;

  const [titleWidth, setTitleWidth] = useState(240);

  useEffect(() => {
    // 1. Fade in
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 2. Pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
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
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ]),
    );
    shimmerLoop.start();

    // 4. Equalizer bars, staggered like voices
    const barLoops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(b, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0.25,
            duration: 520,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    barLoops.forEach((l) => l.start());

    return () => {
      pulseLoop.stop();
      shimmerLoop.stop();
      barLoops.forEach((l) => l.stop());
    };
  }, [fade, pulse, shimmer, bars]);

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={[BRAND.night, BRAND.deep, BRAND.night]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Aurora glows */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            top: -120,
            left: -100,
            backgroundColor: 'rgba(141, 184, 156, 0.25)',
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] }) },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            bottom: -130,
            right: -110,
            backgroundColor: 'rgba(217, 149, 157, 0.2)',
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] }) },
            ],
          },
        ]}
      />

      <Animated.View style={[styles.center, { opacity: fade }]}>
        {/* Logo with sound-wave rings */}
        <View style={styles.logoWrap}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35 - i * 0.1, 0.05],
                  }),
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1 + i * 0.28, 1.25 + i * 0.32],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}

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
              colors={[BRAND.honey, BRAND.sage, BRAND.rose]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Ionicons name="musical-notes" size={38} color={BRAND.night} />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Wordmark */}
        <View style={styles.titleBlock}>
          <View
            style={styles.titleClip}
            onLayout={(e) => setTitleWidth(e.nativeEvent.layout.width)}
          >
            <Text style={styles.titleBase}>REHOBOT</Text>
            {/* Shimmer overlay */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmerBand,
                {
                  transform: [
                    {
                      translateX: shimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-90, titleWidth + 90],
                      }),
                    },
                    { skewX: '-20deg' },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.45)', 'transparent']}
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
              opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.65] }),
            },
          ]}
        >
          Sing together, grow together
        </Animated.Text>

        {/* Equalizer loader */}
        <View style={styles.barsRow}>
          {bars.map((b, i) => (
            <Animated.View
              key={i}
              style={[
                styles.bar,
                {
                  opacity: b.interpolate({ inputRange: [0.25, 1], outputRange: [0.45, 1] }),
                  transform: [{ scaleY: b }],
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
    backgroundColor: BRAND.night,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  center: {
    alignItems: 'center',
  },
  logoWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderColor: BRAND.honey,
  },
  logoMark: {
    width: 88,
    height: 88,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: BRAND.sage,
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginTop: 44,
    alignItems: 'center',
  },
  titleClip: {
    overflow: 'hidden',
    paddingLeft: 8, // offset for letter-spacing
  },
  titleBase: {
    fontSize: 34,
    fontWeight: '800',
    color: BRAND.cream,
    letterSpacing: 8,
  },
  shimmerBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 70,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.honey,
    letterSpacing: 16,
    marginTop: 6,
    paddingLeft: 16, // offset for letter-spacing
  },
  tagline: {
    marginTop: 22,
    fontSize: 13,
    color: BRAND.cream,
    letterSpacing: 0.6,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    marginTop: 36,
  },
  bar: {
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: BRAND.rose,
  },
});