import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { describeLastSeen, type DirectoryMember } from '../../services/members';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import type { HomeStackParamList } from '../../navigation/HomeStack';
import { useDirectoryQuery } from './useDirectory';
import { warmMemberProfileCache } from './warmMemberProfileCache';

type Props = NativeStackScreenProps<HomeStackParamList, 'Directory'>;

const AVATAR_PALETTE: readonly [string, string][] = [
  ['#D3C3F8', '#7B5FC7'],
  ['#BDEBCB', '#2E9E5B'],
  ['#F7E1C8', '#C9822F'],
  ['#DDF59B', '#7FA800'],
];

export default function DirectoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focused, setFocused] = useState(false);
  const { width: screenW } = useWindowDimensions();
  const tileW = (screenW - spacing.lg * 2 - 12) / 2;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const q = useDirectoryQuery(debounced);
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  // After the directory list is cached, warm every member's profile in the
  // background so tapping any member opens instantly online AND offline.
  // Fire-and-forget: never blocks, never throws, bounded (~3 concurrent).
  useEffect(() => {
    if (!q.data || q.data.length === 0) return;
    void warmMemberProfileCache(q.data.map((m) => m.id));
  }, [q.data]);

  const onlineMembers = items.filter((m) => describeLastSeen(m.lastActiveAt).online);
  const onlineStrip =
    !debounced && onlineMembers.length > 0 ? (
      <View style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm + 2 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success }} />
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
            ]}
          >
            {t('directory.online')}
          </Text>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: BRAND.lime,
            }}
          >
            <Text style={{ color: BRAND.teal, fontSize: 11, fontWeight: '800' }}>
              {onlineMembers.length}
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingRight: spacing.lg }}
        >
          {onlineMembers.map((m, i) => {
            const p = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
            return (
              <Pressable
                key={m.id}
                onPress={() => navigation.navigate('MemberProfile', { id: m.id })}
                accessibilityRole="button"
                accessibilityLabel={m.fullName}
                style={{ width: 66, alignItems: 'center' }}
              >
                <View style={{ width: 60, height: 60 }}>
                  <View
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 21,
                      padding: 2.5,
                      backgroundColor: p[0],
                      borderWidth: 2,
                      borderColor: BRAND.lime,
                    }}
                  >
                    {m.profilePhotoUrl ? (
                      <Image
                        source={{ uri: m.profilePhotoUrl }}
                        style={{ width: '100%', height: '100%', borderRadius: 16 }}
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: p[1], fontSize: 20, fontWeight: '800' }}>
                          {m.fullName.trim().charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 15,
                      height: 15,
                      borderRadius: 8,
                      backgroundColor: colors.success,
                      borderWidth: 2.5,
                      borderColor: colors.background,
                    }}
                  />
                </View>
                <Text
                  style={[typography.caption, { color: colors.text, fontWeight: '700', marginTop: 6 }]}
                  numberOfLines={1}
                >
                  {m.fullName.trim().split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Full-bleed hero ---------- */}
      <View style={{ backgroundColor: BRAND.teal, 
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: insets.top - 22,
            right: -52,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: withAlpha(BRAND.lime, 0.14),
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: BRAND.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {t('tabs.home', { defaultValue: 'Home' })}
            </Text>
            <Text
              style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
              numberOfLines={1}
            >
              {t('directory.title')}
            </Text>
          </View>

          <GlassBackButton
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
            size={44}
          />
        </View>

        {/* Glass search bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: focused ? BRAND.gold : 'rgba(255,255,255,0.18)',
            backgroundColor: BRAND.tealDark,
            marginTop: 18,
          }}
        >
          <Ionicons
            name="search"
            size={18}
            color={focused ? BRAND.gold : 'rgba(255,255,255,0.85)'}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('directory.searchPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.65)"
            autoCapitalize="words"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={BRAND.gold}
            style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>
      </View>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <View
            accessibilityRole="text"
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: withAlpha('#E8A65D', 0.14),
              borderWidth: 1,
              borderColor: withAlpha('#E8A65D', 0.4),
            }}
          >
            <Ionicons name="cloud-offline" size={13} color="#E8A65D" />
            <Text
              style={[
                typography.caption,
                { color: '#E8A65D', fontWeight: '800' },
              ]}
            >
              {t('home.showingSavedData', {
                defaultValue: 'Showing saved data',
              })}
            </Text>
          </View>
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner
            message={
              (q.error as { message?: string })?.message ??
              t('common.error', { defaultValue: 'Something went wrong.' })
            }
          />
        </View>
      )}

      {firstLoad ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          ListHeaderComponent={onlineStrip}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={q.isRefetching && !firstLoad}
              onRefresh={() => q.refetch()}
              tintColor={colors.primary}
              colors={[BRAND.teal]}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={[BRAND.lime, BRAND.mint, BRAND.lavender]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
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
                  <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text
                style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
              >
                {t('directory.empty')}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <MemberTile
              item={item}
              index={index}
              width={tileW}
              onPress={() => navigation.navigate('MemberProfile', { id: item.id })}
              onlineLabel={t('directory.online')}
            />
          )}
        />
      )}
    </View>
  );
}

// ---------- Member tile ----------

function MemberTile({
  item,
  index,
  width,
  onPress,
  onlineLabel,
}: {
  item: DirectoryMember;
  index: number;
  width: number;
  onPress: () => void;
  onlineLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const seen = describeLastSeen(item.lastActiveAt);
  const initial = item.fullName.trim().charAt(0).toUpperCase();

  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={{
        width,
        marginBottom: 12,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.fullName}
        style={{
          alignItems: 'center',
          paddingTop: 20,
          paddingBottom: 14,
          paddingHorizontal: 10,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >

        <View style={{ width: 78, height: 78 }}>
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: 27,
              padding: 3,
              backgroundColor: palette[0],
            }}
          >
            {item.profilePhotoUrl ? (
              <Image
                source={{ uri: item.profilePhotoUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 24 }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: palette[1], fontSize: 28, fontWeight: '800' }}>
                  {initial}
                </Text>
              </View>
            )}
          </View>
          {seen.online && (
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: colors.success,
                borderWidth: 3,
                borderColor: colors.surface,
              }}
            />
          )}
        </View>

        <Text
          style={[typography.body, { color: colors.text, fontWeight: '800', marginTop: 12, textAlign: 'center' }]}
          numberOfLines={1}
        >
          {item.fullName}
        </Text>

        {seen.online || seen.label ? (
        <View
          style={{
            marginTop: 8,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: seen.online ? withAlpha(colors.success, 0.16) : withAlpha(colors.textSecondary, 0.12),
          }}
        >
          <Text
            style={[
              typography.caption,
              {
                color: seen.online ? colors.success : colors.textSecondary,
                fontWeight: seen.online ? '800' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {seen.online ? onlineLabel : seen.label}
          </Text>
        </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}