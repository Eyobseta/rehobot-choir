import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Palette sampled from the design reference: deep teal, lime, lavender, mint.
const BRAND = {
  teal: '#1D4550',
  tealDark: '#123038',
  lime: '#C4F44F',
  lavender: '#D3C3F8',
  lavenderSoft: '#EFE9FF',
  mint: '#63D485',
};

const WORD = 'REHOBOT'.split('');
const TAG_LINES = ['Sing together,', 'grow together'];
const LETTER_STAGGER = 110;
const LETTER_PERIOD = 2200;
const TRACK_W = 140;
const BAR_W = 56;

// Concept: "Harmony". A choir of voices (equalizer bars) sits inside a lavender
// sun. Sound ripples radiate out, two orbits circle it, and the wordmark
// sings in a wave, with the two O's lit up like open mouths.
export default function AppLoading() {
  const { width, height } = useWindowDimensions();

  // Entrance spring for the hero
  const enter = useRef(new Animated.Value(0)).current;
  // Fade-in for the text and ambient shapes
  const fade = useRef(new Animated.Value(0)).current;
  // Pulse: breathing hero + drifting background
  const pulse = useRef(new Animated.Value(0)).current;
  // Shimmer = lime progress sweep at the bottom
  const shimmer = useRef(new Animated.Value(0)).current;
  // Two orbits
  const spinA = useRef(new Animated.Value(0)).current;
  const spinB = useRef(new Animated.Value(0)).current;
  // Sound ripples
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  // Voices (equalizer bars)
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.25))).current;
  // Wordmark letters
  const letters = useRef(WORD.map(() => new Animated.Value(0))).current;
  // Tagline: staggered entrance + glint sweep
  const tag = useRef(TAG_LINES.map(() => new Animated.Value(0))).current;
  const glint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Entrance
    Animated.spring(enter, {
      toValue: 1,
      friction: 6,
      tension: 50,
      useNativeDriver: true,
    }).start();
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // 2. Pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2400,
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
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(200),
      ]),
    );
    shimmerLoop.start();

    // 4. Orbits
    const spinALoop = Animated.loop(
      Animated.timing(spinA, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const spinBLoop = Animated.loop(
      Animated.timing(spinB, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinALoop.start();
    spinBLoop.start();

    // 5. Sound ripples, staggered
    const ringLoops = rings.map((r, i) =>
      Animated.sequence([
        Animated.delay(i * 1000),
        Animated.loop(
          Animated.sequence([
            Animated.timing(r, {
              toValue: 1,
              duration: 3000,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ),
      ]),
    );
    ringLoops.forEach((l) => l.start());

    // 6. Voices: bars bounce out of phase
    const barLoops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 130),
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

    // 7. Wordmark wave
    const letterLoops = letters.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * LETTER_STAGGER),
          Animated.timing(v, {
            toValue: 1,
            duration: 260,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 420,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(LETTER_PERIOD - (i * LETTER_STAGGER + 680)),
        ]),
      ),
    );
    letterLoops.forEach((l) => l.start());

    // 8. Tagline: lines rise in one after another, then a glint keeps sweeping across
    Animated.sequence([
      Animated.delay(650),
      Animated.stagger(
        220,
        tag.map((t) =>
          Animated.spring(t, {
            toValue: 1,
            friction: 7,
            tension: 55,
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();

    const glintLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(glint, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glint, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    glintLoop.start();

    return () => {
      glintLoop.stop();
      pulseLoop.stop();
      shimmerLoop.stop();
      spinALoop.stop();
      spinBLoop.stop();
      ringLoops.forEach((l) => l.stop());
      barLoops.forEach((l) => l.stop());
      letterLoops.forEach((l) => l.stop());
    };
  }, [enter, fade, pulse, shimmer, spinA, spinB, rings, bars, letters, tag, glint]);

  // Geometry
  const D = Math.min(width * 0.58, 240); // hero circle
  const cx = width / 2;
  const cy = height * 0.36;
  const orbitA = D * 1.55;
  const orbitB = D * 1.25;
  const wordTop = cy + orbitA / 2 + 18;
  const tagW = Math.min(width * 0.84, 320);

  const rotA = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotB = spinB.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel="Loading Rehobot Choir"
    >
      {/* Ambient flat blobs (depth, not glow) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            width: width * 0.9,
            height: width * 0.9,
            borderRadius: width * 0.45,
            top: -width * 0.45,
            left: -width * 0.35,
            backgroundColor: 'rgba(211, 195, 248, 0.12)',
            opacity: fade,
            transform: [
              { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            width: width * 0.8,
            height: width * 0.8,
            borderRadius: width * 0.4,
            bottom: -width * 0.35,
            right: -width * 0.3,
            backgroundColor: 'rgba(99, 212, 133, 0.12)',
            opacity: fade,
            transform: [
              { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
            ],
          },
        ]}
      />

      {/* Sound ripples */}
      {rings.map((r, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.abs,
            styles.ring,
            {
              width: D,
              height: D,
              borderRadius: D / 2,
              left: cx - D / 2,
              top: cy - D / 2,
              opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] }),
              transform: [
                { scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) },
              ],
            },
          ]}
        />
      ))}

      {/* Orbit B (inner, slow, reverse) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            width: orbitB,
            height: orbitB,
            left: cx - orbitB / 2,
            top: cy - orbitB / 2,
            opacity: enter,
            transform: [{ rotate: rotB }],
          },
        ]}
      >
        <View style={[styles.orbitDot, { top: -6, left: orbitB / 2 - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: BRAND.lavenderSoft }]} />
        <View style={[styles.orbitDot, { bottom: -5, left: orbitB / 2 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.lime }]} />
      </Animated.View>

      {/* Orbit A (outer) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          {
            width: orbitA,
            height: orbitA,
            left: cx - orbitA / 2,
            top: cy - orbitA / 2,
            opacity: enter,
            transform: [{ rotate: rotA }],
          },
        ]}
      >
        <View style={[styles.orbitDot, { top: -19, left: orbitA / 2 - 19, width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.mint }]} />
        <View
          style={[
            styles.orbitDot,
            {
              bottom: -11,
              left: orbitA / 2 - 11,
              width: 22,
              height: 22,
              borderRadius: 5,
              backgroundColor: BRAND.lime,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
      </Animated.View>

      {/* Hero: lavender sun with the choir inside */}
      <Animated.View
        style={[
          styles.abs,
          styles.hero,
          {
            width: D,
            height: D,
            borderRadius: D / 2,
            left: cx - D / 2,
            top: cy - D / 2,
            opacity: enter,
            transform: [
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
            ],
          },
        ]}
      >
        <View style={styles.barsRow}>
          {bars.map((b, i) => (
            <Animated.View
              key={i}
              style={[
                styles.voice,
                {
                  backgroundColor: i % 2 === 0 ? BRAND.teal : BRAND.mint,
                  transform: [{ scaleY: b }],
                },
              ]}
            />
          ))}
        </View>
        <Ionicons
          name="musical-notes"
          size={22}
          color={BRAND.teal}
          style={styles.heroNote}
        />
      </Animated.View>

      {/* Wordmark that sings */}
      <Animated.View style={[styles.wordBlock, { top: wordTop, opacity: fade }]}>
        <View style={styles.wordRow}>
          {WORD.map((ch, i) => {
            const isO = ch === 'O';
            return (
              <Animated.Text
                key={i}
                style={[
                  styles.letter,
                  isO && styles.letterO,
                  {
                    opacity: letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
                    transform: [
                      {
                        translateY: letters[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -12],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {ch}
              </Animated.Text>
            );
          })}
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillText}>CHOIR</Text>
        </View>

        {/* Tagline: two lines, glowing, floating, with a glint sweep */}
        <View style={[styles.tagBlock, { width: tagW }]}>
          {TAG_LINES.map((line, i) => (
            <Animated.View
              key={i}
              style={[
                styles.tagLine,
                {
                  opacity: tag[i],
                  transform: [
                    { translateY: tag[i].interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
                    {
                      translateY: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: i === 0 ? [0, -3] : [0, 3],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Pulsing glow layer behind the text */}
              <Animated.Text
                style={[
                  styles.tagText,
                  styles.tagGlow,
                  i === 1 && styles.tagTextAccent,
                  {
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: i === 0 ? [0.25, 0.85] : [0.85, 0.25],
                    }),
                  },
                ]}
              >
                {line}
              </Animated.Text>
              <Text style={[styles.tagText, i === 1 && styles.tagTextAccent]}>{line}</Text>
            </Animated.View>
          ))}

          {/* Glint */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glint,
              {
                transform: [
                  {
                    translateX: glint.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-70, tagW + 10],
                    }),
                  },
                  { skewX: '-20deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Lime progress sweep */}
      <Animated.View style={[styles.track, { opacity: fade }]}>
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
  abs: {
    position: 'absolute',
  },
  ring: {
    borderWidth: 1.5,
    borderColor: BRAND.lavender,
  },
  orbitDot: {
    position: 'absolute',
  },
  hero: {
    backgroundColor: BRAND.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 92,
  },
  voice: {
    width: 13,
    height: 92,
    borderRadius: 7,
  },
  heroNote: {
    position: 'absolute',
    bottom: 22,
  },
  wordBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 14, // room for the letters to jump
  },
  letter: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginHorizontal: 3,
  },
  letterO: {
    color: BRAND.lime,
  },
  pill: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: BRAND.lime,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 6,
    paddingLeft: 6, // offset for letter-spacing
    color: BRAND.teal,
  },
  tagBlock: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24, // keeps the glow from being clipped
    overflow: 'hidden',
    borderRadius: 16,
  },
  tagLine: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    textShadowColor: 'rgba(196, 244, 79, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tagTextAccent: {
    color: BRAND.lime,
  },
  tagGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textShadowColor: 'rgba(196, 244, 79, 0.95)',
    textShadowRadius: 22,
  },
  glint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 56,
  },
  track: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    width: TRACK_W,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  bar: {
    width: BAR_W,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND.lime,
  },
});