import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND } from '../auth/Auth_UI';
import { useHelpContext } from './HelpContext';

/**
 * The help button only exists on the Profile home screen.
 * This is the React Navigation route name of that screen
 * (the same one helpDeepLinks uses: navigate('Profile', { screen: 'ProfileHome' })).
 */
export const HELP_VISIBLE_ROUTE = 'ProfileHome';

// Tweak these two numbers if the button collides with something in the
// Profile header. TOP_OFFSET is measured from the bottom of the status bar.
const TOP_OFFSET = 8;
const RIGHT_OFFSET = 14;
const SIZE = 40;

export default function HelpFab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const { currentRoute } = useHelpContext();
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 8,
      useNativeDriver: true,
    }).start();

  if (currentRoute !== HELP_VISIBLE_ROUTE) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { top: insets.top + TOP_OFFSET, right: RIGHT_OFFSET, transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.9)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel="Open help"
        hitSlop={10}
      >
        <LinearGradient
          colors={[BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Ionicons name="help" size={22} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 999, elevation: 999 },
  gradient: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND.violet,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});