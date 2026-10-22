import React, { useCallback, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import {
  listMembers,
  DirectoryMember,
  describeLastSeen,
} from '../../services/members';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import type { HomeStackParamList } from '../../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'Directory'>;

const AVATAR_PALETTE: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function DirectoryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const list = await listMembers(q);
      setItems(list);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Full-bleed hero ---------- */}
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: withAlpha(BRAND.gold, 0.22),
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: -80,
            left: -50,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: withAlpha(BRAND.water, 0.22),
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
            borderColor: focused ? BRAND.gold : 'rgba(255,255,255,0.28)',
            backgroundColor: 'rgba(255,255,255,0.16)',
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
      </LinearGradient>

      {error && (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.md + 2,
            backgroundColor: withAlpha(colors.error, 0.1),
            borderWidth: 1,
            borderColor: withAlpha(colors.error, 0.35),
          }}
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
            {error}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={BRAND.violet} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(search);
              }}
              tintColor={BRAND.violet}
              colors={[BRAND.violet]}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient
                colors={[BRAND.violet, BRAND.magenta, BRAND.gold]}
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
            <MemberCard
              item={item}
              index={index}
              onPress={() => navigation.navigate('MemberProfile', { id: item.id })}
              onlineLabel={t('directory.online')}
            />
          )}
        />
      )}
    </View>
  );
}

// ---------- Member card ----------

function MemberCard({
  item,
  index,
  onPress,
  onlineLabel,
}: {
  item: DirectoryMember;
  index: number;
  onPress: () => void;
  onlineLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const seen = describeLastSeen(item.lastActiveAt);
  const initial = item.fullName.trim().charAt(0).toUpperCase();

  const enter = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
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
        marginBottom: spacing.sm + 4,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
          { scale },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.fullName}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          paddingLeft: 16,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        {/* accent bar */}
        <LinearGradient
          colors={palette}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }}
        />

        {/* Avatar with gradient ring + online dot */}
        <View style={{ width: 52, height: 52 }}>
          <LinearGradient
            colors={palette}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 52, height: 52, borderRadius: 26, padding: 2 }}
          >
            {item.profilePhotoUrl ? (
              <Image
                source={{ uri: item.profilePhotoUrl }}
                style={{ width: '100%', height: '100%', borderRadius: 24 }}
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  borderRadius: 24,
                  backgroundColor: colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: palette[0], fontSize: 18, fontWeight: '800' }}>
                  {initial}
                </Text>
              </View>
            )}
          </LinearGradient>

          {seen.online && (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: colors.success,
                borderWidth: 2.5,
                borderColor: colors.surface,
              }}
            />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {item.fullName}
          </Text>
          <Text
            style={[
              typography.caption,
              {
                color: seen.online ? colors.success : colors.textSecondary,
                marginTop: 2,
                fontWeight: seen.online ? '800' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {seen.online ? onlineLabel : seen.label}
          </Text>
        </View>

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: withAlpha(palette[1], 0.16),
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={palette[1]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}