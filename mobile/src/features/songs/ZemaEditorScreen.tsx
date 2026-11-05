import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import {
  listCategories,
  SongCategory,
  zemaListMySubmissions,
  zemaSaveDraft,
  zemaSubmitForReview,
  MySubmission,
} from '../../services/songs';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import { AMBER, IconName, ScreenHero } from './Songs_Kit';

export default function ZemaEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const editingId: string | null = route.params?.id ?? null;

  const [loading, setLoading] = useState(!!editingId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);

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
      try {
        setCategories(await listCategories());
      } catch {}
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
        } catch (e) {
          const err = e as ApiError;
          setError(`${err.message} [${err.code}]`);
        }
      }
      setLoading(false);
    })();
  }, [editingId, t]);

  const pickAudio = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      setAudioUri(asset.uri);
      setAudioName(asset.name ?? 'audio.m4a');
      setAudioMime(asset.mimeType ?? 'audio/m4a');
    } catch {
      setError('Failed to pick audio file.');
    }
  };

  const onSaveDraft = async () => {
    setError(null);
    if (!title.trim()) {
      setTitleError(true);
      return setError(t('register.fieldRequired'));
    }
    setBusy(true);
    try {
      const res = await zemaSaveDraft({
        submissionId: editingId ?? undefined,
        title: title.trim(),
        lyrics: lyrics.trim(),
        youtubeUrl: youtubeUrl.trim(),
        categoryId: categoryId ?? null,
        audioUri: audioUri ?? null,
        audioName,
        audioMime,
      });
      if (!editingId) navigation.replace('ZemaEditor', { id: res.submissionId });
      else navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setTitleError(true);
      return setError(t('register.fieldRequired'));
    }
    setBusy(true);
    try {
      const res = await zemaSaveDraft({
        submissionId: editingId ?? undefined,
        title: title.trim(),
        lyrics: lyrics.trim(),
        youtubeUrl: youtubeUrl.trim(),
        categoryId: categoryId ?? null,
        audioUri: audioUri ?? null,
        audioName,
        audioMime,
      });
      await zemaSubmitForReview(res.submissionId);
      Alert.alert(t('zema.submitted'), t('zema.submittedBody'), [
        { text: t('common.continue'), onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={BRAND.violet} />
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );

  // ---------- Derived (UI only) ----------
  const hasAudio = !!(audioUri || current?.song.audioUrl);
  const filled = [
    title.trim(),
    categoryId,
    youtubeUrl.trim(),
    lyrics.trim(),
    hasAudio ? 'a' : '',
  ].filter(Boolean).length;
  const progress = filled / 5;
  const lineCount = lyrics.trim() ? lyrics.trim().split(/\n/).length : 0;

  const statusInfo = current
    ? current.status === 'APPROVED'
      ? { label: t('zema.statusApproved'), icon: 'checkmark-circle' as IconName, tint: BRAND.gold }
      : current.status === 'PENDING_REVIEW'
        ? { label: t('zema.statusPending'), icon: 'time' as IconName, tint: BRAND.gold }
        : current.status === 'RETURNED'
          ? { label: t('zema.statusReturned'), icon: 'return-down-back' as IconName, tint: AMBER }
          : { label: t('zema.statusDraft'), icon: 'document-text' as IconName, tint: '#FFFFFF' }
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <ScreenHero
          icon="musical-note"
          overline={t('leaderSongs.zemaTeam')}
          title={editingId ? t('zema.editSubmission') : t('zema.newSubmission')}
          onBack={() => navigation.goBack()}
        >
          {/* completeness meter */}
          {!readOnly && (
            <View style={{ marginTop: 16 }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.22)',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${progress * 100}%`,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: BRAND.gold,
                  }}
                />
              </View>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 11.5,
                  fontWeight: '700',
                  marginTop: 6,
                }}
              >
                {filled} / 5
              </Text>
            </View>
          )}
          {statusInfo && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 12,
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.24)',
              }}
            >
              <Ionicons name={statusInfo.icon} size={13} color={statusInfo.tint} />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                {statusInfo.label}
              </Text>
            </View>
          )}
        </ScreenHero>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {current?.status === 'RETURNED' && current.returnReason && (
            <View
              style={{
                marginTop: spacing.lg,
                padding: 14,
                borderRadius: 18,
                borderLeftWidth: 4,
                borderLeftColor: AMBER,
                backgroundColor: withAlpha(AMBER, 0.12),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="return-down-back" size={16} color="#B45309" />
                <Text style={[typography.caption, { color: '#B45309', fontWeight: '800' }]}>
                  {t('zema.returnReason')}
                </Text>
              </View>
              <Text style={[typography.body, { color: colors.text, marginTop: 4 }]}>
                {current.returnReason}
              </Text>
            </View>
          )}

          {readOnly && (
            <View
              style={{
                marginTop: spacing.lg,
                padding: 14,
                borderRadius: 18,
                backgroundColor: withAlpha(BRAND.violet, 0.1),
                borderWidth: 1,
                borderColor: withAlpha(BRAND.violet, 0.35),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="lock-closed" size={16} color={BRAND.violet} />
              <Text
                style={[typography.bodySmall, { color: colors.text, flex: 1, fontWeight: '700' }]}
              >
                {current?.status === 'APPROVED' ? t('zema.lockedApproved') : t('zema.lockedPending')}
              </Text>
            </View>
          )}

          {/* ---------- Section 1: basics ---------- */}
          <Section
            icon="information-circle"
            title={t('zema.sectionBasics', { defaultValue: 'Basics' })}
          >
            <Field
              label={t('zema.titleField')}
              value={title}
              onChange={(v) => {
                setTitle(v);
                if (titleError) {
                  setTitleError(false);
                  setError(null);
                }
              }}
              editable={!readOnly}
              icon="text"
              invalid={titleError}
            />

            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.textSecondary,
                  marginTop: spacing.md,
                  marginBottom: spacing.xs,
                  fontWeight: '700',
                },
              ]}
            >
              {t('zema.categoryField')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <CategoryPill
                label={t('zema.noCategory')}
                active={categoryId === null}
                onPress={() => setCategoryId(null)}
                disabled={readOnly}
              />
              {categories.map((c) => (
                <CategoryPill
                  key={c.id}
                  label={c.name}
                  active={categoryId === c.id}
                  onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
                  disabled={readOnly}
                />
              ))}
            </View>
          </Section>

          {/* ---------- Section 2: media ---------- */}
          <Section icon="videocam" title={t('zema.sectionMedia', { defaultValue: 'Media' })}>
            <Field
              label={t('zema.youtubeField')}
              value={youtubeUrl}
              onChange={setYoutubeUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              editable={!readOnly}
              autoCapitalize="none"
              icon="logo-youtube"
            />

            <Text
              style={[
                typography.bodySmall,
                {
                  color: colors.textSecondary,
                  marginTop: spacing.md,
                  marginBottom: spacing.xs,
                  fontWeight: '700',
                },
              ]}
            >
              {t('zema.audioField')}
            </Text>
            <Pressable
              onPress={pickAudio}
              disabled={readOnly}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 18,
                borderWidth: 1.5,
                borderStyle: hasAudio ? 'solid' : 'dashed',
                borderColor: hasAudio ? BRAND.violet : colors.border,
                backgroundColor: hasAudio ? withAlpha(BRAND.violet, 0.08) : colors.background,
                opacity: readOnly ? 0.6 : pressed ? 0.85 : 1,
              })}
            >
              <LinearGradient
                colors={hasAudio ? [BRAND.violet, BRAND.magenta] : [colors.border, colors.border]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={hasAudio ? 'musical-notes' : 'cloud-upload-outline'}
                  size={22}
                  color={hasAudio ? '#FFFFFF' : colors.textSecondary}
                />
              </LinearGradient>
              <Text
                style={[typography.bodySmall, { color: colors.text, flex: 1, fontWeight: '600' }]}
                numberOfLines={1}
              >
                {audioName ?? (current?.song.audioUrl ? t('zema.audioCurrent') : t('zema.audioNone'))}
              </Text>
              {!readOnly && (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
                    backgroundColor: withAlpha(BRAND.violet, 0.14),
                  }}
                >
                  <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>
                    {t('zema.pickAudio')}
                  </Text>
                </View>
              )}
            </Pressable>
          </Section>

          {/* ---------- Section 3: lyrics ---------- */}
          <Section
            icon="document-text"
            title={t('zema.sectionLyrics', { defaultValue: 'Lyrics' })}
            trailing={
              lineCount > 0 ? (
                <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
                  {t('zema.lineCount', { count: lineCount, defaultValue: '{{count}} lines' })}
                </Text>
              ) : null
            }
          >
            <Field
              label={t('zema.lyricsField')}
              value={lyrics}
              onChange={setLyrics}
              multiline
              editable={!readOnly}
              icon="document-text"
            />
          </Section>

          {error && (
            <View
              style={{
                marginTop: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: spacing.md,
                borderRadius: 16,
                backgroundColor: withAlpha(colors.error, 0.1),
                borderWidth: 1,
                borderColor: withAlpha(colors.error, 0.35),
              }}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>{error}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---------- Sticky action bar ---------- */}
      {!readOnly && (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pressable
            onPress={onSaveDraft}
            disabled={busy}
            accessibilityRole="button"
            style={{
              flex: 1,
              minHeight: 54,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons name="save-outline" size={17} color={colors.text} />
            <Text style={[typography.button, { color: colors.text }]}>{t('zema.saveDraft')}</Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={busy}
            accessibilityRole="button"
            style={{ flex: 1.2, opacity: busy ? 0.7 : 1 }}
          >
            <LinearGradient
              colors={[BRAND.violet, BRAND.magenta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                minHeight: 54,
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={17} color="#FFFFFF" />
                  <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                    {t('zema.submit')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------

function Section({
  icon,
  title,
  trailing,
  children,
}: {
  icon: IconName;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  return (
    <View
      style={{
        marginTop: spacing.lg,
        padding: spacing.lg,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 11,
            backgroundColor: withAlpha(BRAND.violet, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={16} color={BRAND.violet} />
        </View>
        <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{title}</Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function CategoryPill({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: active ? BRAND.violet : colors.border,
        backgroundColor: active ? BRAND.violet : colors.surface,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text
        style={[typography.caption, { color: active ? '#FFFFFF' : colors.text, fontWeight: '800' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  editable = true,
  autoCapitalize,
  icon,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  icon?: IconName;
  invalid?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          {
            color: invalid ? colors.error : colors.textSecondary,
            marginBottom: spacing.xs,
            fontWeight: '700',
          },
        ]}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 10,
          backgroundColor: colors.background,
          borderColor: invalid ? colors.error : focused ? BRAND.violet : colors.border,
          borderWidth: 1.5,
          borderRadius: radius.md + 6,
          paddingHorizontal: spacing.md,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={invalid ? colors.error : focused ? BRAND.violet : colors.textSecondary}
            style={{ marginTop: multiline ? 15 : 0 }}
          />
        )}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline={multiline}
          editable={editable}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            color: editable ? colors.text : colors.textSecondary,
            minHeight: multiline ? 220 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
            opacity: editable ? 1 : 0.75,
            fontSize: 15,
            lineHeight: multiline ? 24 : undefined,
          }}
        />
      </View>
    </View>
  );
}