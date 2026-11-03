import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, Image, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, RefreshControl,
  ScrollView, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { PendingSubmission } from '../../services/songs';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  playTrack, pauseTrack, resumeTrack, subscribe,
  getSnapshot, getCurrentKey, SimpleStatus,
} from '../../services/audioPlayer';
import {
  useSongReviewQueueQuery,
  useApproveSongSubmissionMutation,
  useReturnSongSubmissionMutation,
} from './useLeaderSongsAndMemories';

const PALETTES: readonly [string, string][] = [
  [BRAND.violet, BRAND.magenta],
  [BRAND.water, BRAND.violet],
  [BRAND.magenta, '#F59E0B'],
  [BRAND.deep, BRAND.violet],
];

export default function SongReviewScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();

  const q = useSongReviewQueueQuery();
  const approveMut = useApproveSongSubmissionMutation();
  const returnMut = useReturnSongSubmissionMutation();

  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;
  const error =
    (q.error as { message?: string } | null)?.message ??
    (approveMut.error as { message?: string } | null)?.message ??
    (returnMut.error as { message?: string } | null)?.message ??
    null;

  const busy = approveMut.isPending || returnMut.isPending;

  const [detailOpen, setDetailOpen] = useState<PendingSubmission | null>(null);
  const [returnTarget, setReturnTarget] = useState<PendingSubmission | null>(null);
  const [reason, setReason] = useState('');

  // Audio player
  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  const sheetPop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (detailOpen || returnTarget) {
      sheetPop.setValue(0);
      Animated.spring(sheetPop, {
        toValue: 1, friction: 7, tension: 80, useNativeDriver: true,
      }).start();
    }
  }, [detailOpen, returnTarget, sheetPop]);

  const onApprove = async (sub: PendingSubmission) => {
    try {
      await approveMut.mutateAsync(sub.id);
      setDetailOpen(null);
    } catch {
      /* surfaced by error */
    }
  };

  const onReturn = async () => {
    if (!returnTarget) return;
    const clean = reason.trim();
    if (!clean) return;
    try {
      await returnMut.mutateAsync({ submissionId: returnTarget.id, reason: clean });
      setReturnTarget(null);
      setDetailOpen(null);
      setReason('');
    } catch {
      /* surfaced by error */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching && !firstLoad} onRefresh={() => q.refetch()} tintColor={BRAND.violet} colors={[BRAND.violet]} />
        }
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-done" size={22} color={BRAND.deep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('leaderSongs.title')}</Text>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{t('leaderSongs.review')}</Text>
                </View>
                <GlassBackButton onPress={() => navigation.goBack()} size={44} />
              </View>
              {!firstLoad && items.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                  <Ionicons name="time" size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>{items.length} pending</Text>
                </View>
              )}
            </LinearGradient>

            {showingSavedData && (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: withAlpha('#F59E0B', 0.14), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4) }}>
                  <Ionicons name="cloud-offline" size={13} color="#F59E0B" />
                  <Text style={[typography.caption, { color: '#F59E0B', fontWeight: '800' }]}>
                    {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
                  </Text>
                </View>
              </View>
            )}

            {error && q.data === undefined && (
              <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          firstLoad ? (
            <View style={{ paddingVertical: spacing.xl * 2, alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND.violet} /></View>
          ) : (
            <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.md }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-done-outline" size={40} color={colors.textSecondary} />
                </View>
              </LinearGradient>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('leaderSongs.emptyReview')}</Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <SubmissionCard item={item} index={index} palette={PALETTES[index % PALETTES.length]} onPress={() => setDetailOpen(item)} tapLabel={t('leaderSongs.tapToReview')} />
        )}
      />

      {/* Detail modal */}
      <Modal visible={detailOpen !== null} transparent animationType="fade" onRequestClose={() => setDetailOpen(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
            <Animated.View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', opacity: sheetPop, transform: [{ scale: sheetPop.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }}>
              <LinearGradient colors={[BRAND.deep, BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
                <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Review</Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>{detailOpen?.song.title}</Text>
                    {detailOpen?.song.category && (
                      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>{detailOpen.song.category.name}</Text>
                    )}
                  </View>
                  <Pressable onPress={() => setDetailOpen(null)} hitSlop={8} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </LinearGradient>

              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Submitter */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  {detailOpen?.submittedBy.memberProfile?.profilePhotoUrl ? (
                    <Image source={{ uri: detailOpen.submittedBy.memberProfile.profilePhotoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>
                        {(detailOpen?.submittedBy.memberProfile?.fullName ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>Submitted by</Text>
                    <Text style={[typography.body, { color: colors.text, fontWeight: '800', marginTop: 1 }]} numberOfLines={1}>
                      {detailOpen?.submittedBy.memberProfile?.fullName ?? ''}
                    </Text>
                  </View>
                </View>

                {(detailOpen?.song.audioUrl || detailOpen?.song.youtubeUrl) && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: withAlpha(BRAND.violet, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="play-circle" size={14} color={BRAND.violet} />
                      </View>
                      <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]}>Preview</Text>
                    </View>

                    {detailOpen?.song.audioUrl && (() => {
                      const audioKey = `leader-review:${detailOpen.song.id}`;
                      const isPlaying =
                        playerStatus.isLoaded &&
                        getCurrentKey() === audioKey &&
                        playerStatus.isPlaying;

                      const onToggleAudio = async () => {
                        if (getCurrentKey() !== audioKey) {
                          await playTrack({
                            key: audioKey,
                            uri: detailOpen.song.audioUrl as string,
                            title: detailOpen.song.title,
                          });
                          return;
                        }
                        if (isPlaying) await pauseTrack();
                        else await resumeTrack();
                      };

                      return (
                        <Pressable
                          onPress={onToggleAudio}
                          accessibilityRole="button"
                          style={{ borderRadius: 18, overflow: 'hidden', shadowColor: BRAND.violet, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5, marginBottom: 10 }}
                        >
                          <LinearGradient
                            colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18 }}
                          >
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons
                                name={isPlaying ? 'pause' : 'play'}
                                size={22}
                                color={BRAND.violet}
                                style={{ marginLeft: isPlaying ? 0 : 2 }}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Play audio</Text>
                              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                                {detailOpen.song.title}
                              </Text>
                            </View>
                            <Equalizer active={isPlaying} />
                          </LinearGradient>
                        </Pressable>
                      );
                    })()}

                    {detailOpen?.song.youtubeUrl && (
                      <Pressable
                        onPress={() =>
                          navigation.navigate('SongVideo', {
                            youtubeUrl: detailOpen.song.youtubeUrl as string,
                            title: detailOpen.song.title,
                          })
                        }
                        accessibilityRole="button"
                        style={{ borderRadius: 18, overflow: 'hidden', shadowColor: '#FF0000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 }}
                      >
                        <LinearGradient
                          colors={['#FF0000', '#B3001B']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 18 }}
                        >
                          <Ionicons name="logo-youtube" size={22} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{t('songs.watchOnYoutube')}</Text>
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                )}

                {detailOpen?.song.lyrics && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: withAlpha(BRAND.violet, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="document-text" size={14} color={BRAND.violet} />
                      </View>
                      <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]}>{t('songs.lyrics')}</Text>
                    </View>
                    <View style={{ borderRadius: 16, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                      <LinearGradient colors={[BRAND.violet, BRAND.magenta, BRAND.gold]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 }} />
                      <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                        <Text selectable style={[typography.body, { color: colors.text, lineHeight: 24, fontStyle: 'italic', paddingLeft: 10 }]}>{detailOpen.song.lyrics}</Text>
                      </ScrollView>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: 12 }}>
                <Pressable onPress={() => { if (detailOpen) { setReturnTarget(detailOpen); setReason(''); } }} disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }} accessibilityRole="button">
                  <LinearGradient colors={['#C0262D', '#E0405A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Ionicons name="return-down-back" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{t('leaderSongs.returnBtn')}</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => detailOpen && onApprove(detailOpen)} disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }} accessibilityRole="button">
                  <LinearGradient colors={['#16A34A', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {approveMut.isPending ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{t('leaderSongs.approveBtn')}</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!returnTarget} transparent animationType="fade" onRequestClose={() => setReturnTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
            <Animated.View style={{ backgroundColor: colors.surface, borderRadius: 28, padding: 22, opacity: sheetPop, transform: [{ scale: sheetPop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: withAlpha(colors.error, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="return-down-back" size={26} color={colors.error} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: 12, fontWeight: '800' }]}>{t('leaderSongs.returnTitle')}</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>{t('leaderSongs.returnLabel')}</Text>
              <View style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 14 }}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.textSecondary} style={{ marginTop: 15 }} />
                  <TextInput value={reason} onChangeText={setReason} multiline placeholder={t('leaderSongs.returnPlaceholder')} placeholderTextColor={colors.textSecondary} textAlignVertical="top"
                    style={{ flex: 1, minHeight: 100, paddingVertical: 14, color: colors.text }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                <Pressable onPress={() => setReturnTarget(null)} style={{ flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[typography.button, { color: colors.text }]}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable onPress={onReturn} disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
                  <LinearGradient colors={['#C0262D', '#E0405A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {returnMut.isPending ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="return-down-back" size={16} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>{t('leaderSongs.returnBtn')}</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------- Widgets (unchanged) ----------

function Equalizer({ active }: { active: boolean }) {
  const bars = useRef([0.35, 0.6, 0.45, 0.7].map((v) => new Animated.Value(v))).current;
  useEffect(() => {
    if (!active) {
      bars.forEach((b, i) =>
        Animated.timing(b, { toValue: [0.35, 0.6, 0.45, 0.7][i], duration: 200, useNativeDriver: false }).start(),
      );
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 320 + i * 110, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(b, { toValue: 0.2, duration: 320 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 26, gap: 4 }}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={{ width: 4, borderRadius: 2, backgroundColor: '#FFFFFF', height: b.interpolate({ inputRange: [0, 1], outputRange: [4, 26] }) }}
        />
      ))}
    </View>
  );
}

function SubmissionCard({ item, index, palette, onPress, tapLabel }: {
  item: PendingSubmission; index: number; palette: readonly [string, string]; onPress: () => void; tapLabel: string;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const enter = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.timing(enter, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [enter, index]);
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  const initial = (item.submittedBy.memberProfile?.fullName ?? '?').charAt(0).toUpperCase();
  return (
    <Animated.View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }, { scale }] }}>
      <Pressable onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)}
        style={{ borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden', shadowColor: BRAND.violet, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 }} />
        <View style={{ padding: 14, paddingLeft: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>{item.song.title}</Text>
              {item.song.category && (
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>{item.song.category.name}</Text>
              )}
            </View>
            <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="musical-notes" size={18} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
            {item.submittedBy.memberProfile?.profilePhotoUrl ? (
              <Image source={{ uri: item.submittedBy.memberProfile.profilePhotoUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{initial}</Text>
              </LinearGradient>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>By</Text>
              <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                {item.submittedBy.memberProfile?.fullName ?? ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: withAlpha(BRAND.violet, 0.14) }}>
              <Text style={{ color: BRAND.violet, fontSize: 11, fontWeight: '800' }}>{tapLabel}</Text>
              <Ionicons name="chevron-forward" size={13} color={BRAND.violet} />
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}