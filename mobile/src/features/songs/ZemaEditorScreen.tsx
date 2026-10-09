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
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
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

export default function ZemaEditorScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
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

  const readOnly =
    current?.status === 'PENDING_REVIEW' || current?.status === 'APPROVED';

  useEffect(() => {
    void (async () => {
      try {
        setCategories(await listCategories());
      } catch {
        // ignore
      }
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
          } else {
            setError(t('zema.notFound'));
          }
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
    if (!title.trim()) return setError(t('register.fieldRequired'));
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
      // If we just created a new draft, keep editing the same one.
      if (!editingId) {
        navigation.replace('ZemaEditor', { id: res.submissionId });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));

    // Save first (creates or updates the draft), then submit.
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

      Alert.alert(
        t('zema.submitted'),
        t('zema.submittedBody'),
        [{ text: t('common.continue'), onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xxl * 2,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={[typography.h2, { color: colors.primary }]}>
          {editingId ? t('zema.editSubmission') : t('zema.newSubmission')}
        </Text>

        {current?.status === 'RETURNED' && current.returnReason && (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.warning,
            }}
          >
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {t('zema.returnReason')}
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.text, marginTop: 2 },
              ]}
            >
              {current.returnReason}
            </Text>
          </View>
        )}

        {readOnly && (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {current?.status === 'APPROVED'
                ? t('zema.lockedApproved')
                : t('zema.lockedPending')}
            </Text>
          </View>
        )}

        <Field
          label={t('zema.titleField')}
          value={title}
          onChange={setTitle}
          editable={!readOnly}
        />

        {/* Category picker */}
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.textSecondary,
              marginTop: spacing.md,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {t('zema.categoryField')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Pressable
            disabled={readOnly}
            onPress={() => setCategoryId(null)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: categoryId === null ? colors.primary : colors.border,
              backgroundColor:
                categoryId === null ? colors.primary : colors.surface,
              opacity: readOnly ? 0.6 : 1,
            }}
          >
            <Text
              style={[
                typography.caption,
                {
                  color:
                    categoryId === null ? colors.primaryText : colors.text,
                },
              ]}
            >
              {t('zema.noCategory')}
            </Text>
          </Pressable>
          {categories.map((c) => {
            const active = categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                disabled={readOnly}
                onPress={() => setCategoryId(active ? null : c.id)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.surface,
                  opacity: readOnly ? 0.6 : 1,
                }}
              >
                <Text
                  style={[
                    typography.caption,
                    { color: active ? colors.primaryText : colors.text },
                  ]}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field
          label={t('zema.youtubeField')}
          value={youtubeUrl}
          onChange={setYoutubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          editable={!readOnly}
          autoCapitalize="none"
        />

        <Field
          label={t('zema.lyricsField')}
          value={lyrics}
          onChange={setLyrics}
          multiline
          editable={!readOnly}
        />

        {/* Audio */}
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.textSecondary,
              marginTop: spacing.md,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {t('zema.audioField')}
        </Text>
        <View
          style={{
            padding: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={[typography.bodySmall, { color: colors.text }]}>
            {audioName ?? current?.song.audioUrl
              ? t('zema.audioCurrent')
              : t('zema.audioNone')}
          </Text>
          <View
            style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}
          >
            <Pressable
              onPress={pickAudio}
              disabled={readOnly}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.primary,
                alignItems: 'center',
                opacity: readOnly ? 0.6 : 1,
              }}
            >
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('zema.pickAudio')}
              </Text>
            </Pressable>
          </View>
        </View>

        {error && (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.error, marginTop: spacing.md },
            ]}
          >
            {error}
          </Text>
        )}

        {!readOnly && (
          <View
            style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}
          >
            <Pressable
              onPress={onSaveDraft}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.button, { color: colors.text }]}>
                {t('zema.saveDraft')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onSubmit}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.primary,
                alignItems: 'center',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[typography.button, { color: colors.primaryText }]}>
                  {t('zema.submit')}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginBottom: spacing.xs },
        ]}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        editable={editable}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: editable ? colors.text : colors.textSecondary,
          minHeight: multiline ? 120 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
          opacity: editable ? 1 : 0.7,
        }}
      />
    </View>
  );
}