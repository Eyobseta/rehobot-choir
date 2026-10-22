import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { listCategories, SongCategory, zemaListMySubmissions, zemaSaveDraft, zemaSubmitForReview, MySubmission } from '../../services/songs';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ZemaEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const editingId: string | null = route.params?.id ?? null;

  const [loading, setLoading] = useState(!!editingId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<SongCategory[]>([]);
  const [current, setCurrent] = useState<MySubmission | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);

  const readOnly = current?.status === 'PENDING_REVIEW' || current?.status === 'APPROVED';

  useEffect(() => {
    void (async () => {
      try { setCategories(await listCategories()); } catch {}
      if (editingId) {
        try {
          const subs = await zemaListMySubmissions();
          const found = subs.find((s) => s.id === editingId);
          if (found) {
            setCurrent(found);
            setTitle(found.song.title);
            setLyrics(found.song.lyrics ?? '');
            setYoutubeUrl(found.song.youtubeUrl ?? '');
            setCategoryId(found.song.category?.id ?? null);
          } else setError(t('zema.notFound'));
        } catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
      }
      setLoading(false);
    })();
  }, [editingId, t]);

  const pickAudio = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      setAudioUri(asset.uri);
      setAudioName(asset.name ?? 'audio.m4a');
      setAudioMime(asset.mimeType ?? 'audio/m4a');
    } catch { setError('Failed to pick audio file.'); }
  };

  const onSaveDraft = async () => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));
    setBusy(true);
    try {
      const res = await zemaSaveDraft({ submissionId: editingId ?? undefined, title: title.trim(), lyrics: lyrics.trim(), youtubeUrl: youtubeUrl.trim(), categoryId: categoryId ?? null, audioUri: audioUri ?? null, audioName, audioMime });
      if (!editingId) navigation.replace('ZemaEditor', { id: res.submissionId });
      else navigation.goBack();
    } catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
    finally { setBusy(false); }
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));
    setBusy(true);
    try {
      const res = await zemaSaveDraft({ submissionId: editingId ?? undefined, title: title.trim(), lyrics: lyrics.trim(), youtubeUrl: youtubeUrl.trim(), categoryId: categoryId ?? null, audioUri: audioUri ?? null, audioName, audioMime });
      await zemaSubmitForReview(res.submissionId);
      Alert.alert(t('zema.submitted'), t('zema.submittedBody'), [{ text: t('common.continue'), onPress: () => navigation.goBack() }]);
    } catch (e) { const err = e as ApiError; setError(`${err.message} [${err.code}]`); }
    finally { setBusy(false); }
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={BRAND.violet} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <LinearGradient colors={[BRAND.deep, BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
          <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: withAlpha(BRAND.gold, 0.22) }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: BRAND.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="musical-note" size={22} color={BRAND.deep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('leaderSongs.zemaTeam')}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 2 }} numberOfLines={1}>
                {editingId ? t('zema.editSubmission') : t('zema.newSubmission')}
              </Text>
            </View>
            <GlassBackButton onPress={() => navigation.goBack()} size={44} />
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          {current?.status === 'RETURNED' && current.returnReason && (
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: withAlpha('#F59E0B', 0.12), borderWidth: 1, borderColor: withAlpha('#F59E0B', 0.4), marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="return-down-back" size={16} color="#B45309" />
                <Text style={[typography.caption, { color: '#B45309', fontWeight: '800' }]}>{t('zema.returnReason')}</Text>
              </View>
              <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>{current.returnReason}</Text>
            </View>
          )}

          {readOnly && (
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: withAlpha(BRAND.violet, 0.1), borderWidth: 1, borderColor: withAlpha(BRAND.violet, 0.35), marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="lock-closed" size={16} color={BRAND.violet} />
              <Text style={[typography.bodySmall, { color: colors.text, flex: 1, fontWeight: '700' }]}>
                {current?.status === 'APPROVED' ? t('zema.lockedApproved') : t('zema.lockedPending')}
              </Text>
            </View>
          )}

          <Card>
            <Field label={t('zema.titleField')} value={title} onChange={setTitle} editable={!readOnly} icon="text" />

            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs, fontWeight: '700' }]}>{t('zema.categoryField')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <CategoryPill label={t('zema.noCategory')} active={categoryId === null} onPress={() => setCategoryId(null)} disabled={readOnly} />
              {categories.map((c) => (
                <CategoryPill key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} disabled={readOnly} />
              ))}
            </View>

            <Field label={t('zema.youtubeField')} value={youtubeUrl} onChange={setYoutubeUrl} placeholder="https://www.youtube.com/watch?v=..." editable={!readOnly} autoCapitalize="none" icon="logo-youtube" />
            <Field label={t('zema.lyricsField')} value={lyrics} onChange={setLyrics} multiline editable={!readOnly} icon="document-text" />
          </Card>

          <Card>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '700' }]}>{t('zema.audioField')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: audioUri || current?.song.audioUrl ? 'solid' : 'dashed', borderColor: audioUri || current?.song.audioUrl ? BRAND.violet : colors.border, backgroundColor: audioUri || current?.song.audioUrl ? withAlpha(BRAND.violet, 0.08) : colors.background }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: withAlpha(BRAND.violet, 0.18), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-notes" size={20} color={BRAND.violet} />
              </View>
              <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                {audioName ?? (current?.song.audioUrl ? t('zema.audioCurrent') : t('zema.audioNone'))}
              </Text>
              <Pressable onPress={pickAudio} disabled={readOnly} hitSlop={8}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: withAlpha(BRAND.violet, 0.14), opacity: readOnly ? 0.6 : 1 }}>
                <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>{t('zema.pickAudio')}</Text>
              </Pressable>
            </View>
          </Card>

          {error && (
            <View style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 14, backgroundColor: withAlpha(colors.error, 0.1), borderWidth: 1, borderColor: withAlpha(colors.error, 0.35) }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
            </View>
          )}

          {!readOnly && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              <Pressable onPress={onSaveDraft} disabled={busy} style={{ flex: 1, minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                <Ionicons name="save-outline" size={17} color={colors.text} />
                <Text style={[typography.button, { color: colors.text }]}>{t('zema.saveDraft')}</Text>
              </Pressable>
              <Pressable onPress={onSubmit} disabled={busy} style={{ flex: 1.2, opacity: busy ? 0.7 : 1 }}>
                <LinearGradient colors={[BRAND.violet, BRAND.magenta]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                    <>
                      <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                      <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>{t('zema.submit')}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  return <View style={{ marginTop: spacing.lg, padding: spacing.lg, paddingTop: spacing.md, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{children}</View>;
}

function CategoryPill({ label, active, onPress, disabled }: { label: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: active ? BRAND.violet : colors.border, backgroundColor: active ? BRAND.violet : colors.surface, opacity: disabled ? 0.6 : 1 }}>
      <Text style={[typography.caption, { color: active ? '#FFFFFF' : colors.text, fontWeight: '800' }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder, multiline, editable = true, autoCapitalize, icon }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; editable?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words'; icon?: IconName;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700' }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10, backgroundColor: colors.background, borderColor: focused ? BRAND.violet : colors.border, borderWidth: 1.5, borderRadius: radius.md + 4, paddingHorizontal: spacing.md }}>
        {icon && (
          <Ionicons name={icon} size={18} color={focused ? BRAND.violet : colors.textSecondary} style={{ marginTop: multiline ? 15 : 0 }} />
        )}
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textSecondary} multiline={multiline} editable={editable} autoCapitalize={autoCapitalize ?? 'sentences'}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, paddingVertical: spacing.md, color: editable ? colors.text : colors.textSecondary, minHeight: multiline ? 120 : undefined, textAlignVertical: multiline ? 'top' : 'center', opacity: editable ? 1 : 0.75 }} />
      </View>
    </View>
  );
}