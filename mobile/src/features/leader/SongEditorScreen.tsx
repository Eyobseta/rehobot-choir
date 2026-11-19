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
import { useLyricsScan, askChoice, scanErrorMessage } from '../songs/useLyricsScan'; // adjust the folder name if yours differs
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

  // ---- Lyrics scan (photo -> text). Result is only a draft the leader must review. ----
  const { scan, scanning } = useLyricsScan('leader');
  const [scanReview, setScanReview] = useState(false);
  const [scanPoor, setScanPoor] = useState(false);
  const unclearCount = (lyrics.match(/\[\?\]/g) ?? []).length;
  const AMBER_TINT = '#E8A65D';

  const scanErrorText = (code: string) => scanErrorMessage(t, code);

  const onScanLyrics = async () => {
    setError(null);
    try {
      const out = await scan();
      if (!out) return;
      if (!out.ok) return setError(scanErrorText(out.code));

      const apply = (next: string) => {
        setLyrics(next);
        setScanReview(true);
        setScanPoor(out.quality === 'poor');
      };
      if (!lyrics.trim()) return apply(out.text);

      const mode = await askChoice<'replace' | 'append'>(
        t('zema.scanKeepTitle', { defaultValue: 'You already have lyrics' }),
        undefined,
        [
          { text: t('zema.scanReplace', { defaultValue: 'Replace' }), value: 'replace', style: 'destructive' },
          { text: t('zema.scanAppend', { defaultValue: 'Add to the end' }), value: 'append' },
          { text: t('register.cancel'), value: null as any, style: 'cancel' },
        ],
      );
      if (mode === 'replace') apply(out.text);
      else if (mode === 'append') apply(`${lyrics.trimEnd()}\n\n${out.text}`);
    } catch (e) {
      setError(scanErrorText((e as { code?: string })?.code ?? 'OCR_FAILED'));
    }
  };

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
    if (unclearCount > 0) {
      const go = await askChoice<boolean>(
        t('zema.unclearTitle', { defaultValue: 'Unclear words remain' }),
        t('zema.unclearBody', {
          defaultValue: 'Some words are still marked [?]. Fix them first, or save anyway.',
        }),
        [
          { text: t('zema.unclearFix', { defaultValue: 'Go back and fix' }), value: false, style: 'cancel' },
          { text: t('zema.unclearSubmit', { defaultValue: 'Save anyway' }), value: true },
        ],
      );
      if (!go) return;
    }
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
      <ActivityIndicator size="large" color={colors.primary} />
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
          colors={[BRAND.teal, BRAND.teal]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}
        >
          <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.lime, 0.14) }} />
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
            <Pressable
              onPress={() => void onScanLyrics()}
              disabled={scanning}
              accessibilityRole="button"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                marginTop: spacing.md,
                paddingVertical: 13,
                borderRadius: 16,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: withAlpha(colors.accent, 0.6),
                backgroundColor: withAlpha(colors.accent, 0.08),
                opacity: scanning ? 0.8 : 1,
              }}
            >
              {scanning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="scan" size={20} color={colors.accent} />
              )}
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 14 }}>
                {scanning
                  ? t('zema.scanning', { defaultValue: 'Reading your photo… this can take up to a minute' })
                  : t('zema.scanButton', { defaultValue: 'Scan lyrics from paper' })}
              </Text>
            </Pressable>

            <Field label={t('leaderSongs.lyricsField')} value={lyrics} onChange={setLyrics} multiline icon="document-text" />

            {scanReview && (
              <View
                style={{
                  marginTop: spacing.md,
                  padding: spacing.md,
                  borderRadius: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: AMBER_TINT,
                  backgroundColor: withAlpha(AMBER_TINT, 0.1),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="eye" size={18} color={AMBER_TINT} />
                  <Text style={[typography.bodySmall, { color: colors.text, fontWeight: '800', flex: 1 }]}>
                    {t('zema.scanReviewTitle', { defaultValue: 'Please check the scanned text' })}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6, lineHeight: 18 }]}>
                  {t('zema.scanReviewBody', {
                    defaultValue:
                      'The scan may contain mistakes. Compare it with your paper and fix any errors before saving.',
                  })}
                  {scanPoor
                    ? ` ${t('zema.scanReviewPoor', {
                        defaultValue: 'Parts of this were hard to read, so please check every line carefully.',
                      })}`
                    : ''}
                  {unclearCount > 0
                    ? ` ${t('zema.scanUnclear', {
                        count: unclearCount,
                        defaultValue: '{{count}} unclear word(s) are marked [?].',
                      })}`
                    : ''}
                </Text>
                <Pressable
                  onPress={() => setScanReview(false)}
                  accessibilityRole="button"
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: '800', fontSize: 12.5 }}>
                    {t('zema.scanChecked', { defaultValue: "I've checked it" })}
                  </Text>
                </Pressable>
              </View>
            )}
          </Card>

          <Card>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '700' }]}>
              {t('leaderSongs.audioField')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: audioUri || current?.audioUrl ? 'solid' : 'dashed', borderColor: audioUri || current?.audioUrl ? colors.accent : colors.border, backgroundColor: audioUri || current?.audioUrl ? withAlpha(colors.accent, 0.08) : colors.background }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(colors.accent, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-notes" size={20} color={colors.accent} />
              </View>
              <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {audioName || (current?.audioUrl ? t('leaderSongs.audioCurrent') : t('leaderSongs.audioNone'))}
              </Text>
              <Pressable onPress={pickAudio} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: withAlpha(colors.accent, 0.14) }}>
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 11 }}>{t('leaderSongs.pickAudio')}</Text>
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
                <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: withAlpha(colors.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play-circle" size={14} color={colors.accent} />
                </View>
                <Text style={[typography.h3, { color: colors.text, fontWeight: '800' }]}>
                  {t('leaderSongs.previewSection', { defaultValue: 'Preview' })}
                </Text>
              </View>

              {previewAudioUri && (
                <Pressable
                  onPress={onToggleAudioPreview}
                  accessibilityRole="button"
                  style={{ borderRadius: 18, overflow: 'hidden', shadowColor: BRAND.deep, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5, marginBottom: 10 }}
                >
                  <LinearGradient
                    colors={[BRAND.teal, BRAND.teal]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 18 }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND.lime, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons
                        name={isAudioPlaying ? 'pause' : 'play'}
                        size={22}
                        color={BRAND.teal}
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
              <LinearGradient colors={[BRAND.teal, '#2B6B7A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
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
            <Pressable onPress={onUnpublish} disabled={busy} style={{ marginTop: spacing.md, minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#E8A65D', backgroundColor: withAlpha('#E8A65D', 0.08), alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Ionicons name="cloud-offline" size={17} color="#E8A65D" />
              <Text style={[typography.button, { color: '#E8A65D' }]}>{t('leaderSongs.unpublish')}</Text>
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
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accent : colors.surface }}>
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
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10, backgroundColor: colors.background, borderColor: focused ? colors.accent : colors.border, borderWidth: 1.5, borderRadius: radius.md + 4, paddingHorizontal: spacing.md }}>
        {icon && <Ionicons name={icon} size={18} color={focused ? colors.accent : colors.textSecondary} style={{ marginTop: multiline ? 15 : 0 }} />}
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textSecondary} multiline={multiline} autoCapitalize={autoCapitalize ?? 'sentences'}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, paddingVertical: spacing.md, color: colors.text, minHeight: multiline ? 120 : undefined, textAlignVertical: multiline ? 'top' : 'center' }} />
      </View>
    </View>
  );
}