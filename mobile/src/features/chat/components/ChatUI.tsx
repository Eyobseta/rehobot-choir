import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  StatusBar,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../theme/ThemeContext';
import { BRAND, withAlpha } from '../../auth/Auth_UI';
import { initialsOf, thumbUrl } from '../chatUtils';
import { useTr } from '../chatStrings';
import type { MemberInfo, ConversationType } from '../chatTypes';

const GREEN = '#22C55E';

// ---------------------------------------------------------------------------
// Tab bar: hide the bottom tab bar while a conversation is open
// ---------------------------------------------------------------------------

export function useHideTabBar(): void {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions({ tabBarStyle: undefined });
    }, [navigation]),
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({
  uri,
  name,
  size = 44,
  online,
  kind,
}: {
  uri?: string | null;
  name: string;
  size?: number;
  online?: boolean | null;
  kind?: ConversationType;
}) {
  const { theme } = useTheme();
  const { colors } = theme;

  let inner: React.ReactNode;
  if (uri) {
    inner = (
      <Image
        source={{ uri: thumbUrl(uri, size * 3) }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  } else if (kind === 'GENERAL' || kind === 'GROUP') {
    inner = (
      <LinearGradient
        colors={kind === 'GENERAL' ? [BRAND.lime, BRAND.mint] : [BRAND.lavender, '#9B84E0']}
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
        <Ionicons
          name={kind === 'GENERAL' ? 'chatbubbles' : 'people'}
          size={size * 0.48}
          color={BRAND.teal}
        />
      </LinearGradient>
    );
  } else {
    inner = (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(colors.accent, 0.2),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: size * 0.36 }}>
          {initialsOf(name)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      {inner}
      {online ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: GREEN,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function HeaderButton({
  icon,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? withAlpha(BRAND.lime, 0.22) : BRAND.tealDark,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Ionicons name={icon} size={21} color="#FFFFFF" />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: BRAND.lime,
          }}
        />
      ) : null}
    </Pressable>
  );
}

export function ChatHeader({
  title,
  subtitle,
  onBack,
  avatar,
  right,
  onPressTitle,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  avatar?: React.ReactNode;
  right?: React.ReactNode;
  onPressTitle?: () => void;
  /** Optional content under the title row (e.g. a search field), inside the teal hero. */
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View
        style={{
          backgroundColor: BRAND.teal,
          paddingTop: insets.top + 10,
          paddingBottom: 14,
          paddingHorizontal: 12,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top - 40,
            right: -50,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: withAlpha(BRAND.lime, 0.1),
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {onBack ? <HeaderButton icon="chevron-back" onPress={onBack} /> : null}
          {avatar}
          <Pressable
            style={{ flex: 1 }}
            onPress={onPressTitle}
            disabled={!onPressTitle}
            accessibilityRole={onPressTitle ? 'button' : 'header'}
          >
            <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '800' }}>
              {title}
            </Text>
            {subtitle ? (
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 1 }}>
                {subtitle}
              </Text>
            ) : null}
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
        </View>
        {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Search field (onDark = inside the teal hero)
// ---------------------------------------------------------------------------

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onDark,
  autoFocus,
  loading,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onDark?: boolean;
  autoFocus?: boolean;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const fg = onDark ? '#FFFFFF' : colors.text;
  const sub = onDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        height: 46,
        borderRadius: 18,
        backgroundColor: onDark ? BRAND.tealDark : colors.surface,
        borderWidth: 1,
        borderColor: onDark ? 'rgba(255,255,255,0.18)' : colors.border,
      }}
    >
      <Ionicons name="search" size={18} color={sub} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={onDark ? 'rgba(255,255,255,0.55)' : colors.textSecondary}
        autoFocus={autoFocus}
        selectionColor={onDark ? BRAND.lime : colors.primary}
        style={{ flex: 1, color: fg, fontSize: 16, paddingVertical: 0 }}
      />
      {loading ? <ActivityIndicator size="small" color={onDark ? BRAND.lime : colors.primary} /> : null}
      {value.length > 0 && !loading ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close-circle" size={18} color={sub} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Role badge (manager / leader)
// ---------------------------------------------------------------------------

export function RoleBadge({ label, tone }: { label: string; tone: 'manager' | 'leader' }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const color = tone === 'manager' ? colors.primary : colors.accent;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: withAlpha(tone === 'manager' ? BRAND.lime : colors.accent, tone === 'manager' ? 0.25 : 0.16),
        marginTop: 2,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '800' }}>
        {tone === 'manager' ? '★ ' : ''}
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty / error state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon = 'chatbubbles-outline',
  text,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <LinearGradient
        colors={[BRAND.lime, BRAND.mint, BRAND.lavender]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={40} color={colors.textSecondary} />
        </View>
      </LinearGradient>
      <Text
        style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 18 }]}
      >
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: 18,
            paddingHorizontal: 24,
            minHeight: 46,
            borderRadius: 999,
            backgroundColor: BRAND.teal,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Text style={{ color: BRAND.lime, fontWeight: '800' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows for the first load of the chat list
// ---------------------------------------------------------------------------

function PulseBlock({ style }: { style: object }) {
  const { theme } = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: theme.colors.surfaceAlt, opacity: v }, style]} />;
}

export function ChatListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <View style={{ paddingTop: 6 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 }}>
          <PulseBlock style={{ width: 54, height: 54, borderRadius: 27 }} />
          <View style={{ flex: 1, gap: 9 }}>
            <PulseBlock style={{ height: 13, borderRadius: 6, width: '55%' }} />
            <PulseBlock style={{ height: 11, borderRadius: 5, width: '80%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Text prompt modal (Alert.prompt does not exist on Android)
// ---------------------------------------------------------------------------

export function PromptModal({
  visible,
  title,
  initialValue,
  onSubmit,
  onClose,
  maxLength = 60,
}: {
  visible: boolean;
  title: string;
  initialValue: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
  maxLength?: number;
}) {
  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(5,16,19,0.65)', justifyContent: 'center', padding: 24 }}
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 20 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 14 }}>
            {title}
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={maxLength}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            style={{
              color: colors.text,
              backgroundColor: colors.background,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 16,
              paddingHorizontal: 14,
              minHeight: 50,
              fontSize: 16,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{tr('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const v = value.trim();
                if (v) onSubmit(v);
              }}
              accessibilityRole="button"
              style={{
                minHeight: 44,
                paddingHorizontal: 22,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: BRAND.teal,
              }}
            >
              <Text style={{ color: BRAND.lime, fontWeight: '800' }}>{tr('done')}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Member list (DM picker, group builder, "add members")
// ---------------------------------------------------------------------------

export function MemberList({
  members,
  selectedIds,
  onPress,
  presence,
  header,
}: {
  members: MemberInfo[];
  selectedIds?: Set<string>;
  onPress: (m: MemberInfo) => void;
  presence?: Record<string, boolean>;
  header?: React.ReactElement | null;
}) {
  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.userId}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header ?? null}
      ListEmptyComponent={
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Ionicons name="people-outline" size={36} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>{tr('noResults')}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const selected = selectedIds?.has(item.userId) ?? false;
        const online = presence?.[item.userId] ?? item.online;
        return (
          <Pressable
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityState={selectedIds ? { selected } : undefined}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginHorizontal: 10,
              paddingHorizontal: 8,
              paddingVertical: 9,
              borderRadius: 18,
              backgroundColor: selected
                ? withAlpha(colors.primary, 0.12)
                : pressed
                ? withAlpha(colors.primary, 0.07)
                : 'transparent',
            })}
          >
            <Avatar uri={item.profilePhotoUrl} name={item.fullName} online={online} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {item.fullName}
              </Text>
              {item.role !== 'MEMBER' ? <RoleBadge label={tr('leader')} tone="leader" /> : null}
            </View>
            {selectedIds ? (
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: selected ? BRAND.lime : 'transparent',
                  borderWidth: selected ? 0 : 2,
                  borderColor: colors.border,
                }}
              >
                {selected ? <Ionicons name="checkmark" size={17} color={BRAND.deep} /> : null}
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}