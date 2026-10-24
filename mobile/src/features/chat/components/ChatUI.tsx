import React, { useCallback, useEffect, useState } from 'react';
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
        colors={kind === 'GENERAL' ? [BRAND.gold, BRAND.magenta] : [BRAND.violet, BRAND.magenta]}
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
          color="#FFFFFF"
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
          backgroundColor: withAlpha(BRAND.violet, 0.2),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: BRAND.violet, fontWeight: '800', fontSize: size * 0.36 }}>
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
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
      }}
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
            backgroundColor: BRAND.gold,
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
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  avatar?: React.ReactNode;
  right?: React.ReactNode;
  onPressTitle?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 14,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {onBack ? <HeaderButton icon="chevron-back" onPress={onBack} /> : null}
        {avatar}
        <Pressable style={{ flex: 1 }} onPress={onPressTitle} disabled={!onPressTitle}>
          <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
      </LinearGradient>
    </>
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
      <Ionicons name={icon} size={54} color={withAlpha(BRAND.violet, 0.5)} />
      <Text
        style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 12 }]}
      >
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 16,
            paddingHorizontal: 22,
            paddingVertical: 11,
            borderRadius: 22,
            backgroundColor: BRAND.violet,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
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
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 18 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 12 }}>
            {title}
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            maxLength={maxLength}
            placeholderTextColor={colors.textSecondary}
            style={{
              color: colors.text,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 16 }}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{tr('cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const v = value.trim();
                if (v) onSubmit(v);
              }}
              hitSlop={8}
            >
              <Text style={{ color: BRAND.violet, fontWeight: '800' }}>{tr('done')}</Text>
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
      renderItem={({ item }) => {
        const selected = selectedIds?.has(item.userId) ?? false;
        const online = presence?.[item.userId] ?? item.online;
        return (
          <Pressable
            onPress={() => onPress(item)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: pressed ? withAlpha(BRAND.violet, 0.08) : 'transparent',
            })}
          >
            <Avatar uri={item.profilePhotoUrl} name={item.fullName} online={online} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                {item.fullName}
              </Text>
              {item.role !== 'MEMBER' ? (
                <Text style={{ color: BRAND.magenta, fontSize: 12, fontWeight: '700', marginTop: 1 }}>
                  {tr('leader')}
                </Text>
              ) : null}
            </View>
            {selectedIds ? (
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={selected ? BRAND.violet : colors.border}
              />
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}
