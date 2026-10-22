import React, { useCallback, useState, useRef } from 'react';
import { View, Text, FlatList, Pressable, Image, ActivityIndicator, Alert, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { leaderListZemaMembers, leaderAddZemaMember, leaderRemoveZemaMember, ZemaMember } from '../../services/songs';
import { listMembers, DirectoryMember } from '../../services/members';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

const PALETTES: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function ZemaTeamScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<ZemaMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try { setItems(await leaderListZemaMembers()); }
    catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
    finally { setLoading(false); }
  }, []);

  const loadDirectory = useCallback(async () => {
    try { setDirectory(await listMembers('')); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); void load(); void loadDirectory(); }, [load, loadDirectory]));

  const onAdd = async (userId: string) => {
    setBusy(true);
    try { await leaderAddZemaMember(userId); setShowPicker(false); await load(); }
    catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
    finally { setBusy(false); }
  };

  const onRemove = (m: ZemaMember) => {
    Alert.alert(t('leaderSongs.removeZema'), m.user.memberProfile?.fullName ?? '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('leaderSongs.remove'), style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await leaderRemoveZemaMember(m.user.id); await load(); }
        catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
        finally { setBusy(false); }
      }},
    ]);
  };

  const zemaIds = new Set(items.map((i) => i.user.id));
  const candidates = directory.filter((d) => !zemaIds.has(d.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people" size={22} color={BRAND.deep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('leaderSongs.title')}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{t('leaderSongs.zemaTeam')}</Text>
          </View>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>

        {/* Add toggle */}
        <Pressable onPress={() => setShowPicker((s) => !s)} accessibilityRole="button"
          style={{ marginTop: 18, borderRadius: 16, overflow: 'hidden', shadowColor: BRAND.gold, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
          <LinearGradient colors={showPicker ? ['#E5E7EB', '#9CA3AF'] : [BRAND.gold, '#FFA94D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 }}>
            <Ionicons name={showPicker ? 'close' : 'person-add'} size={20} color={BRAND.deep} />
            <Text style={{ color: BRAND.deep, fontWeight: '800', fontSize: 14 }}>
              {showPicker ? t('leaderSongs.closePicker') : t('leaderSongs.addZema')}
            </Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>

      {error && (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
        </View>
      )}

      {showPicker && (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, maxHeight: 280, overflow: 'hidden' }}>
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => onAdd(item.id)} disabled={busy}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {item.profilePhotoUrl ? (
                  <Image source={{ uri: item.profilePhotoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{item.fullName.charAt(0).toUpperCase()}</Text>
                  </LinearGradient>
                )}
                <Text style={[typography.body, { color: colors.text, flex: 1, fontWeight: '700' }]} numberOfLines={1}>{item.fullName}</Text>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(BRAND.violet, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add" size={16} color={BRAND.violet} />
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={{ padding: spacing.md }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{t('leaderSongs.noCandidates')}</Text>
              </View>
            }
          />
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('leaderSongs.emptyZema')}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <ZemaCard item={item} index={index} palette={PALETTES[index % PALETTES.length]} onRemove={() => onRemove(item)} removeLabel={t('leaderSongs.remove')} />
          )}
        />
      )}
    </View>
  );
}

function ZemaCard({ item, index, palette, onRemove, removeLabel }: {
  item: ZemaMember; index: number; palette: readonly [string, string]; onRemove: () => void; removeLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 400, delay: Math.min(index, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const initial = (item.user.memberProfile?.fullName ?? '?').charAt(0).toUpperCase();
  return (
    <Animated.View style={{ marginBottom: spacing.sm + 4, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        {item.user.memberProfile?.profilePhotoUrl ? (
          <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, padding: 2 }}>
            <Image source={{ uri: item.user.memberProfile.profilePhotoUrl }} style={{ width: '100%', height: '100%', borderRadius: 20 }} />
          </LinearGradient>
        ) : (
          <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>{initial}</Text>
          </LinearGradient>
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.user.memberProfile?.fullName ?? ''}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>Zema member</Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: withAlpha(colors.error, 0.12), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="remove-circle-outline" size={18} color={colors.error} />
        </Pressable>
      </View>
    </Animated.View>
  );
}