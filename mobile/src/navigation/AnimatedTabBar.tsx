import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { BRAND, withAlpha } from '../features/auth/Auth_UI';

const PILL_W = 62;
const PILL_H = 34;

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_COLORS: Record<string, string> = {
  Home: BRAND.violet,
  Songs: BRAND.magenta,
  Memories: '#0EA5E9',
  Chat: '#F59E0B',
  Approvals: '#16A34A',
  Profile: '#0D9488',
};

const ICONS: Record<string, { on: IconName; off: IconName }> = {
  Home: { on: 'home', off: 'home-outline' },
  Songs: { on: 'musical-notes', off: 'musical-notes-outline' },
  Memories: { on: 'images', off: 'images-outline' },
  Chat: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  Profile: { on: 'person', off: 'person-outline' },
  Approvals: { on: 'checkmark-done', off: 'checkmark-done-outline' },
};

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();

  const count = state.routes.length;
  const [width, setWidth] = useState(0);
  const itemW = width / count;

  const slide = useRef(new Animated.Value(0)).current; 
  const colorIdx = useRef(new Animated.Value(state.index)).current; 
  const enter = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  // Bar slides up when it first appears.
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 60, useNativeDriver: false }).start(); // FIXED
  }, [enter]);

  // Slide the pill under the active tab.
  useEffect(() => {
    if (!width) return;
    const target = state.index * itemW + (itemW - PILL_W) / 2;
    if (first.current) {
      slide.setValue(target);
      first.current = false;
    } else {
      Animated.spring(slide, { toValue: target, friction: 7, tension: 85, useNativeDriver: false }).start(); // FIXED
    }
  }, [state.index, width, itemW, slide]);

  // Blend the pill colour towards the active tab's colour.
  useEffect(() => {
    Animated.spring(colorIdx, { toValue: state.index, friction: 8, tension: 70, useNativeDriver: false }).start();
  }, [state.index, colorIdx]);

  const focusedOptions = descriptors[state.routes[state.index].key]?.options;
  const flat = StyleSheet.flatten(focusedOptions?.tabBarStyle as any) as { display?: string } | undefined;
  if (flat?.display === 'none') return null;

  const tabColors = state.routes.map((r) => TAB_COLORS[r.name] ?? BRAND.violet);
  const pillColor =
    count > 1
      ? colorIdx.interpolate({
          inputRange: tabColors.map((_, i) => i),
          outputRange: tabColors,
          extrapolate: 'clamp',
        })
      : tabColors[0];

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }],
        backgroundColor: colors.surface,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: -4 },
        elevation: 16,
      }}
    >
      <View style={{ borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }}>
        <LinearGradient
          colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topLine}
        />

        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={[styles.row, { paddingBottom: Math.max(insets.bottom, 8) }]}
        >
          {width > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pillTrack, { transform: [{ translateX: slide }] }]}
            >
              <Animated.View
                style={[
                  styles.pill,
                  {
                    backgroundColor: pillColor,
                    shadowColor: pillColor as any,
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </Animated.View>
          )}

          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };
            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabItem
                key={route.key}
                label={label}
                focused={focused}
                icons={ICONS[route.name] ?? { on: 'ellipse', off: 'ellipse-outline' }}
                badge={options.tabBarBadge as number | string | undefined}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={onPress}
                onLongPress={onLongPress}
                tint={TAB_COLORS[route.name] ?? BRAND.violet}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

function TabItem({
  label,
  focused,
  icons,
  badge,
  accessibilityLabel,
  onPress,
  onLongPress,
  tint,
}: {
  label: string;
  focused: boolean;
  icons: { on: IconName; off: IconName };
  badge?: number | string;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress: () => void;
  tint: string;
}) {
  const { theme } = useTheme();
  const { colors } = theme;

  const focus = useRef(new Animated.Value(focused ? 1 : 0)).current; 
  const bounce = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(focus, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // FIXED
    }).start();
    if (focused) {
      bounce.setValue(0.7);
      Animated.spring(bounce, { toValue: 1, friction: 4, tension: 160, useNativeDriver: false }).start(); // FIXED
    }
  }, [focused, focus, bounce]);

  const pressTo = (v: number) =>
    Animated.spring(press, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: false }).start(); // FIXED

  const hasBadge = badge !== undefined && badge !== null && badge !== '' && badge !== 0;
  const badgeText = typeof badge === 'number' && badge > 99 ? '99+' : String(badge);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => pressTo(0.88)}
      onPressOut={() => pressTo(1)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.item}
    >
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: press }] }}>
        <View style={styles.iconBox}>
          <Animated.View style={[styles.iconLayer, { opacity: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <Ionicons name={icons.off} size={23} color={colors.textSecondary} />
          </Animated.View>
          <Animated.View
            style={[
              styles.iconLayer,
              {
                opacity: focus,
                transform: [
                  { scale: bounce },
                  { translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
                ],
              },
            ]}
          >
            <Ionicons name={icons.on} size={23} color="#FFFFFF" />
          </Animated.View>

          {hasBadge && <Badge key={badgeText} text={badgeText} />}
        </View>

        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            {
              color: focused ? colors.text : colors.textSecondary,
              fontWeight: focused ? '800' : '600',
              opacity: focus.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
              transform: [{ translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }],
            },
          ]}
        >
          {label}
        </Animated.Text>

        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: tint,
              opacity: focus,
              transform: [{ scale: focus }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

function Badge({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 170, useNativeDriver: false }).start(); // FIXED
  }, [pop]);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: colors.error,
          borderColor: colors.surface,
          transform: [{ scale: pop }],
          shadowColor: colors.error,
        },
      ]}
    >
      <Text style={styles.badgeText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topLine: { height: 3, width: '100%', opacity: 0.9 },
  row: { flexDirection: 'row', paddingTop: 8 },
  pillTrack: { position: 'absolute', top: 8, left: 0, width: PILL_W, height: PILL_H },
  pill: {
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    overflow: 'hidden',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 2 },
  iconBox: { width: PILL_W, height: PILL_H, alignItems: 'center', justifyContent: 'center' },
  iconLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, marginTop: 3, maxWidth: 76 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});