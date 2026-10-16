import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { listMembers, DirectoryMember } from '../../services/members';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';


const AVATAR_PALETTE: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function LeaderAttendanceMembersScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      setItems(await listMembers(q));
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load(search);
    }, [search, load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ---------- Gradient hero ---------- */}
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            { top: -60, right: -40, backgroundColor: withAlpha(BRAND.gold, 0.22) },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.blob,
            { bottom: -70, left: -50, backgroundColor: withAlpha(BRAND.water, 0.22) },
          ]}
        />

        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>
              {t('attendance.title', { defaultValue: 'Attendance' })}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {t('attendance.memberPicker', { defaultValue: 'Pick a member' })}
            </Text>
          </View>

          {/* Back — right side, gap from title */}
          <GlassBackButton
  onPress={() => navigation.goBack()}
  accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
/>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('attendance.searchMember')}
            placeholderTextColor="rgba(255,255,255,0.65)"
            autoCapitalize="words"
            style={styles.searchInput}
            selectionColor={BRAND.gold}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {error && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Text style={[typography.bodySmall, { color: colors.error }]}>{error}</Text>
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
            padding: spacing.lg,
            paddingBottom: spacing.xl * 2,
          }}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Ionicons name="person-outline" size={40} color={colors.textSecondary} />
              <Text
                style={[
                  typography.body,
                  { color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
                ]}
              >
                {t('directory.empty', { defaultValue: 'No members found.' })}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <MemberCard
              item={item}
              index={index}
              onPress={() =>
                navigation.navigate('MemberAttendanceGrid', {
                  memberId: item.id,
                  memberName: item.fullName,
                })
              }
              chevronLabel={t('attendance.viewMembersGrid', {
                defaultValue: 'Member history',
              })}
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
  chevronLabel,
}: {
  item: DirectoryMember;
  index: number;
  onPress: () => void;
  chevronLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const palette = AVATAR_PALETTE[index % AVATAR_PALETTE.length];

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

  const initial = item.fullName.trim().charAt(0).toUpperCase();

  return (
    <Animated.View
      style={{
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
        onPressIn={() => to(0.98)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={item.fullName}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <LinearGradient
          colors={palette}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cardBar}
        />

        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={palette}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            {item.profilePhotoUrl ? (
              <Image source={{ uri: item.profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.surface }]}>
                <Text style={[styles.avatarInitial, { color: palette[0] }]}>{initial}</Text>
              </View>
            )}
          </LinearGradient>
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[typography.body, { color: colors.text, fontWeight: '800' }]}
            numberOfLines={1}
          >
            {item.fullName}
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}
            numberOfLines={1}
          >
            {chevronLabel}
          </Text>
        </View>

        <View style={[styles.go, { backgroundColor: withAlpha(palette[1], 0.16) }]}>
          <Ionicons name="chevron-forward" size={18} color={palette[1]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 18,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  avatarWrap: { width: 48, height: 48 },
  avatarRing: { width: 48, height: 48, borderRadius: 24, padding: 2 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 22 },
  avatarFallback: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '800' },
  go: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});