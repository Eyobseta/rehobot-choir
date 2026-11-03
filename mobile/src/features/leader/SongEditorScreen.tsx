import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import {
  listCategories, SongCategory,
  leaderGetSong, leaderCreateSong, leaderUpdateSong, leaderDeleteSong,
  LeaderSongDetail,
} from '../../services/songs';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  playTrack, pauseTrack, resumeTrack, subscribe,
  getSnapshot, getCurrentKey, SimpleStatus,
} from '../../services/audioPlayer';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function SongEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const editingId: string | null = route.params?.id ?? null;

  const [loading, setLoading] = useState(!!editingId); // Keep this as true ONLY for initial edit load
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<SongCategory[]>([]);
  const [current, setCurrent] = useState<LeaderSongDetail | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);

  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  useEffect(() => {
    void (async () => {
      try { setCategories(await listCategories()); } catch {}
      if (editingId) {
        try {
          const detail = await leaderGetSong(editingId);
          setCurrent(detail);
          setTitle(detail.title);
          setLyrics(detail.lyrics ?? '');
          setYoutubeUrl(detail.youtubeUrl ?? '');
          setCategoryId(detail.category?.id ?? null);
        } catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
      }
      setLoading(false);
    })();
  }, [editingId]);

  const pickAudio = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      setAudioUri(asset.uri);
      setAudioName(asset.name ?? 'audio.m4a');
      setAudioMime(asset.mimeType ?? 'audio/m4a');
    } catch { setError(t('leaderSongs.pickAudioFailed', { defaultValue: 'Failed to pick audio file.' })); }
  };

  const onSave = async (publish: boolean) => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));
    setBusy(true);
    try {
      if (editingId) {
        await leaderUpdateSong(editingId, { title: title.trim(), lyrics: lyrics.trim(), youtubeUrl: youtubeUrl.trim(), categoryId: categoryId ?? null, publish, audioUri: audioUri ?? null, audioName, audioMime });
      } else {
        await leaderCreateSong({ title: title.trim(), lyrics: lyrics.trim(), youtubeUrl: youtubeUrl.trim(), categoryId: categoryId ?? null, publish, audioUri: audioUri ?? null, audioName, audioMime });
      }
      navigation.goBack();
    } catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
    finally { setBusy(false); }
  };

  const onUnpublish = async () => {
    if (!editingId) return;
    setBusy(true);
    try { await leaderUpdateSong(editingId, { unpublish: true }); navigation.goBack(); }
    catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
    finally { setBusy(false); }
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert(t('leaderSongs.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('leaderSongs.delete'), style: 'destructive', onPress: async () => {
        setBusy(true);
        try { await leaderDeleteSong(editingId); navigation.goBack(); }
        catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
        finally { setBusy(false); }
      }},
    ]);
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={BRAND.violet} />
    </View>
  );

  // Compute what to preview
  const previewAudioUri = audioUri ?? current?.audioUrl ?? null;
  const previewYoutubeUrl = youtubeUrl.trim() || current?.youtubeUrl || null;
  const audioKey = `leader-editor:${editingId ?? 'new'}`;
  const isAudioPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === audioKey &&
    playerStatus.isPlaying;

  const onToggleAudioPreview = async () => {
    if (!previewAudioUri) return;
    if (getCurrentKey() !== audioKey) {
      await playTrack({
        key: audioKey,
        uri: previewAudioUri,
        title: title || t('leaderSongs.audioPreviewDefault', { defaultValue: 'Preview' }),
      });
      return;
    }
    if (isAudioPlaying) await pauseTrack();
    else await resumeTrack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <LinearGradient
          colors={[BRAND.deep, BRAND.violet, BRAND.magenta]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
        >
          <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={editingId ? 'create' : 'add-circle'} size={22} color={BRAND.deep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                {t('leaderSongs.title')}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
                {editingId ? t('leaderSongs.editSong') : t('leaderSongs.newSong')}
              </Text>
            </View>
            <GlassBackButton onPress={() => navigation.goBack()} size={44} />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          <Card>
            <Field label={t('leaderSongs.titleField')} value={title} onChange={setTitle} icon="text" />
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '700' }]}>
              {t('leaderSongs.categoryField')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <CategoryPill label={t('leaderSongs.noCategory')} active={categoryId === null} onPress={() => setCategoryId(null)} />
              {categories.map((c) => (
                <CategoryPill key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} />
              ))}
            </View>
            <Field label={t('leaderSongs.youtubeField')} value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://www.youtube.com/watch?v=..." autoCapitalize="none" icon="logo-youtube" />
            <Field label={t('leaderSongs.lyricsField')} value={lyrics} onChange={setLyrics} multiline icon="document-text" />
          </Card>

          <Card>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '700' }]}>
              {t('leaderSongs.audioField')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: audioUri || current?.audioUrl ? 'solid' : 'dashed', borderColor: audioUri || current?.audioUrl ? BRAND.violet : colors.border, backgroundColor: audioUri || current?.audioUrl ? withAlpha(BRAND.violet, 0.08) : colors.background }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(BRAND.violet, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-notes" size={20} color={BRAND.violet} />
              </View>
              <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {audioName || (current?.audioUrl ? t('leaderSongs.audioCurrent') : t('leaderSongs.audioNone'))}
              </Text>
              <Pressable onPress={pickAudio} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: withAlpha(BRAND.violet, 0.14) }}>
                <Text style={{ color: BRAND.violet, fontWeight: '800', fontSize: 11 }}>{t('leaderSongs.pickAudio')}</Text>
              </Pressable>
              {(audioUri || current?.audioUrl) && (
                <Pressable onPress={() => { setAudioUri(null); setAudioName(null); setAudioMime(null); }} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: withAlpha(colors.error, 0.14) }}>
                  <Text style={{ color: colors.error, fontWeight: '800', fontSize: 11 }}>{t('leaderSongs.removeAudio')}</Text>
                </Pressable>
              )}
            </View>
          </Card>

          {(previewAudioUri || previewYoutubeUrl) && (
            <View style={{ marginTop: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: withAlpha(BRAND.violet, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play-circle" size={14} color={BRAND.violet} />
                </View>
                <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]}>
                  {t('leaderSongs.previewSection', { defaultValue: 'Preview' })}
                </Text>
              </View>

              {previewAudioUri && (
                <Pressable
                  onPress={onToggleAudioPreview}
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
                        name={isAudioPlaying ? 'pause' : 'play'}
                        size={22}
                        color={BRAND.violet}
                        style={{ marginLeft: isAudioPlaying ? 0 : 2 }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                        {audioUri
                          ? t('leaderSongs.previewPickedAudio', { defaultValue: 'Preview picked audio' })
                          : t('leaderSongs.previewAttachedAudio', { defaultValue: 'Preview attached audio' })}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                        {title || t('songs.nowPlaying')}
                      </Text>
                    </View>
                    <Equalizer active={isAudioPlaying} />
                  </LinearGradient>
                </Pressable>
              )}

              {previewYoutubeUrl && (
                <Pressable
                  onPress={() =>
                    navigation.navigate('SongVideo', {
                      youtubeUrl: previewYoutubeUrl,
                      title: title || t('songs.watchOnYoutube'),
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

          {error && (
            <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            {editingId && (
              <Pressable onPress={onDelete} disabled={busy} style={{ flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.error, backgroundColor: withAlpha(colors.error, 0.08), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash" size={17} color={colors.error} />
              </Pressable>
            )}
            <Pressable onPress={() => onSave(false)} disabled={busy} style={{ flex: 1.4, minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Ionicons name="document-text-outline" size={17} color={colors.text} />
              <Text style={[typography.button, { color: colors.text }]} numberOfLines={1}>{t('leaderSongs.saveDraft')}</Text>
            </Pressable>
            <Pressable onPress={() => onSave(true)} disabled={busy} style={{ flex: 1.4, opacity: busy ? 0.7 : 1 }}>
              <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <Ionicons name="rocket" size={17} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>{t('leaderSongs.publishNow')}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {editingId && current?.status === 'PUBLISHED' && (
            <Pressable onPress={onUnpublish} disabled={busy} style={{ marginTop: spacing.md, minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#F59E0B', backgroundColor: withAlpha('#F59E0B', 0.08), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Ionicons name="cloud-offline" size={17} color="#F59E0B" />
              <Text style={[typography.button, { color: '#F59E0B' }]}>{t('leaderSongs.unpublish')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- Small helpers ----------

function Equalizer({ active }: { active: boolean }) {
  const bars = React.useRef([0.35, 0.6, 0.45, 0.7].map((v) => new Animated.Value(v))).current;
  React.useEffect(() => {
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

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  return <View style={{ marginTop: spacing.lg, padding: spacing.lg, paddingTop: spacing.md, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{children}</View>;
}

function CategoryPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: active ? BRAND.violet : colors.border, backgroundColor: active ? BRAND.violet : colors.surface }}>
      <Text style={[typography.caption, { color: active ? '#FFFFFF' : colors.text, fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder, multiline, autoCapitalize, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words'; icon?: IconName;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10, backgroundColor: colors.background, borderColor: focused ? BRAND.violet : colors.border, borderWidth: 1.5, borderRadius: radius.md + 4, paddingHorizontal: spacing.md }}>
        {icon && <Ionicons name={icon} size={18} color={focused ? BRAND.violet : colors.textSecondary} style={{ marginTop: multiline ? 15 : 0 }} />}
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textSecondary} multiline={multiline} autoCapitalize={autoCapitalize ?? 'sentences'}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, paddingVertical: spacing.md, color: colors.text, minHeight: multiline ? 120 : undefined, textAlignVertical: multiline ? 'top' : 'center' }} />
      </View>
    </View>
  );
}