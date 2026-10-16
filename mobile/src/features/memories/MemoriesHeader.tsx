import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BRAND, withAlpha } from '../auth/Auth_UI';

/**
 * Custom navigation header for the Memories list.
 * Gradient background + animated title, seamlessly merging with the
 * memories hero card below (same colors, same gradient direction).
 */
export default function MemoriesHeader() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Title entrance animation
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  // Slow drifting blobs (visual only)
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const titleStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  const bubbleStyle = {
    opacity: enter,
    transform: [
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
    ],
  };

  return (
    <LinearGradient
      colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.wrap, { paddingTop: insets.top }]}
    >
      {/* Drifting decorative blobs */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            top: -70,
            right: -50,
            backgroundColor: withAlpha(BRAND.gold, 0.22),
            transform: [
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 14],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            bottom: -80,
            left: -40,
            backgroundColor: withAlpha(BRAND.water, 0.22),
            transform: [
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -12],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
            ],
          },
        ]}
      />

      <View style={styles.row}>
        <Animated.View style={[styles.iconBubble, bubbleStyle]}>
          <Ionicons name="images" size={20} color={BRAND.deep} />
        </Animated.View>

        <Animated.View style={[{ flex: 1, marginLeft: 12 }, titleStyle]}>
          <Text style={styles.kicker} numberOfLines={1}>
            {t('tabs.memories', { defaultValue: 'Memories' })}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {t('memories.title', { defaultValue: 'Memories' })}
          </Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 14,
    // No bottom radius — flows straight into the hero card below.
  },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  kicker: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
});