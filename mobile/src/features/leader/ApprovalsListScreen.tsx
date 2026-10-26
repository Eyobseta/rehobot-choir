import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
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
  listPendingApplications,
  PendingApplication,
} from '../../services/leaders';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import type { LeaderStackParamList } from '../../navigation/LeaderStack';

type Props = NativeStackScreenProps<LeaderStackParamList, 'ApprovalsList'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const AVATAR_PALETTE: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

// Quick-launch tiles — same destinations as before, but as a grid.
const TOOLS: {
  key: string;
  icon: IconName;
  labelKey: string;
  route: keyof LeaderStackParamList;
  gradient: readonly [string, string];
}[] = [
  { key: 'events',        icon: 'calendar',         labelKey: 'events.title',          route: 'LeaderEvents',        gradient: ['#6C3FE0', '#E0409A'] },
  { key: 'announcements', icon: 'megaphone',        labelKey: 'announcements.title',   route: 'LeaderAnnouncements', gradient: ['#F59E0B', '#E0409A'] },
  { key: 'attendance',    icon: 'checkbox',         labelKey: 'attendance.record',     route: 'LeaderAttendance',    gradient: ['#22C55E', '#0E7490'] },
  { key: 'member',        icon: 'person-circle',    labelKey: 'leaderTools.manageMember', route: 'ManageMember',     gradient: ['#6EDBD5', '#6C3FE0'] },
  { key: 'songs',         icon: 'musical-notes',    labelKey: 'leaderSongs.title',     route: 'LeaderSongs',         gradient: ['#EE9BBD', '#6C3FE0'] },
  { key: 'memories',      icon: 'images',           labelKey: 'memories.title',        route: 'LeaderMemories',      gradient: ['#B6A0FF', '#E0409A'] },
];

export default function ApprovalsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listPendingApplications();
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
      setLoading(true);
      void load();
    }, [load]),
  );

  if (loading && items.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={BRAND.violet} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={BRAND.violet}
            colors={[BRAND.violet]}
          />
        }
        ListHeaderComponent={
          <View>
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
                  <Ionicons name="shield-checkmark" size={22} color={BRAND.deep} />
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
                    {t('leaderTools.profileEntries', { defaultValue: 'Leader' })}
                  </Text>
                  <Text
                    style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }}
                    numberOfLines={1}
                  >
                    {t('leader.approvalsTab')}
                  </Text>
                </View>

                {items.length > 0 && (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Ionicons name="time" size={12} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
                      {items.length}
                    </Text>
                  </View>
                )}

                <GlassBackButton
                  onPress={() => navigation.goBack()}
                  accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
                  size={44}
                />
              </View>

              {/* Quick-launch tools grid */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  marginTop: 18,
                  rowGap: 10,
                }}
              >
                {TOOLS.map((tool) => (
                  <ToolTile
                    key={tool.key}
                    label={t(tool.labelKey)}
                    icon={tool.icon}
                    gradient={tool.gradient}
                    onPress={() => navigation.navigate(tool.route as any)}
                  />
                ))}
              </View>
            </LinearGradient>

            {/* ---------- Section label ---------- */}
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View
                style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: BRAND.violet }}
              />
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.textSecondary,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    fontWeight: '800',
                    flex: 1,
                  },
                ]}
              >
                {t('leader.approvalsTitle')}
              </Text>
              {items.length > 0 && (
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: withAlpha(BRAND.violet, 0.18),
                  }}
                >
                  <Text style={{ color: BRAND.violet, fontSize: 12, fontWeight: '800' }}>
                    {items.length}
                  </Text>
                </View>
              )}
            </View>

            {error && (
              <View
                style={{
                  marginHorizontal: spacing.lg,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderRadius: 14,
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
          </View>
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
                <Ionicons name="checkmark-done-outline" size={40} color={colors.textSecondary} />
              </View>
            </LinearGradient>
            <Text
              style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}
            >
              {t('leader.approvalsEmpty')}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <ApplicationCard
            item={item}
            index={index}
            onPress={() => navigation.navigate('ApplicantDetail', { id: item.id })}
          />
        )}
      />
    </View>
  );
}

// ---------- Tool tile ----------

function ToolTile({
  label,
  icon,
  gradient,
  onPress,
}: {
  label: string;
  icon: IconName;
  gradient: readonly [string, string];
  onPress: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        width: '48.5%',
        transform: [{ scale }],
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 12,
          paddingHorizontal: 12,
        }}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color="#FFFFFF" />
        </LinearGradient>
        <Text
          style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5, flex: 1 }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------- Application card ----------

function ApplicationCard({
  item,
  index,
  onPress,
}: {
  item: PendingApplication;
  index: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const initial = item.fullName.trim().charAt(0).toUpperCase();

  const enter = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const a = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // <--- CHANGED TO FALSE
    });
    a.start();
    return () => a.stop();
  }, [enter, index]);

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        paddingHorizontal: spacing.lg,
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
        <LinearGradient
          colors={palette}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }}
        />

        <LinearGradient
          colors={palette}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 56, height: 56, borderRadius: 28, padding: 2 }}
        >
          {item.profilePhotoUrl ? (
            <Image
              source={{ uri: item.profilePhotoUrl }}
              style={{ width: '100%', height: '100%', borderRadius: 26 }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                borderRadius: 26,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: palette[0], fontSize: 20, fontWeight: '800' }}>
                {initial}
              </Text>
            </View>
          )}
        </LinearGradient>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {item.fullName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
            <Text
              style={[typography.caption, { color: colors.textSecondary, flex: 1 }]}
              numberOfLines={1}
            >
              {item.phone}
            </Text>
          </View>
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