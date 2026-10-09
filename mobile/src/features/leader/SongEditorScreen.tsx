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
  leaderGetSong,
  leaderCreateSong,
  leaderUpdateSong,
  leaderDeleteSong,
  LeaderSongDetail,
} from '../../services/songs';
import { ApiError } from '../../services/api';

export default function SongEditorScreen({ route, navigation }: any) {
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
  const [current, setCurrent] = useState<LeaderSongDetail | null>(null);

  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setCategories(await listCategories());
      } catch {
        // ignore
      }

      if (editingId) {
        try {
          const detail = await leaderGetSong(editingId);
          setCurrent(detail);
          setTitle(detail.title);
          setLyrics(detail.lyrics ?? '');
          setYoutubeUrl(detail.youtubeUrl ?? '');
          setCategoryId(detail.category?.id ?? null);
        } catch (e) {
          const err = e as ApiError;
          setError(`${err.message} [${err.code}]`);
        }
      }
      setLoading(false);
    })();
  }, [editingId]);

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

  const onSave = async (publish: boolean) => {
    setError(null);
    if (!title.trim()) return setError(t('register.fieldRequired'));

    setBusy(true);
    try {
      if (editingId) {
        await leaderUpdateSong(editingId, {
          title: title.trim(),
          lyrics: lyrics.trim(),
          youtubeUrl: youtubeUrl.trim(),
          categoryId: categoryId ?? null,
          publish,
          audioUri: audioUri ?? null,
          audioName,
          audioMime,
        });
      } else {
        await leaderCreateSong({
          title: title.trim(),
          lyrics: lyrics.trim(),
          youtubeUrl: youtubeUrl.trim(),
          categoryId: categoryId ?? null,
          publish,
          audioUri: audioUri ?? null,
          audioName,
          audioMime,
        });
      }
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onUnpublish = async () => {
    if (!editingId) return;
    setBusy(true);
    try {
      await leaderUpdateSong(editingId, { unpublish: true });
      navigation.goBack();
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert(t('leaderSongs.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('leaderSongs.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await leaderDeleteSong(editingId);
            navigation.goBack();
          } catch (e) {
            const err = e as ApiError;
            setError(`${err.message} [${err.code}]`);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
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
          {editingId ? t('leaderSongs.editSong') : t('leaderSongs.newSong')}
        </Text>

        <Field
          label={t('leaderSongs.titleField')}
          value={title}
          onChange={setTitle}
        />

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
          {t('leaderSongs.categoryField')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Pressable
            onPress={() => setCategoryId(null)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: categoryId === null ? colors.primary : colors.border,
              backgroundColor:
                categoryId === null ? colors.primary : colors.surface,
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
              {t('leaderSongs.noCategory')}
            </Text>
          </Pressable>
          {categories.map((c) => {
            const active = categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(active ? null : c.id)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.surface,
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
          label={t('leaderSongs.youtubeField')}
          value={youtubeUrl}
          onChange={setYoutubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          autoCapitalize="none"
        />

        <Field
          label={t('leaderSongs.lyricsField')}
          value={lyrics}
          onChange={setLyrics}
          multiline
        />

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
          {t('leaderSongs.audioField')}
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
            {audioName || current?.audioUrl
              ? t('leaderSongs.audioCurrent')
              : t('leaderSongs.audioNone')}
          </Text>
          <View
            style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}
          >
            <Pressable
              onPress={pickAudio}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.primary,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('leaderSongs.pickAudio')}
              </Text>
            </Pressable>
            {(audioUri || current?.audioUrl) && (
              <Pressable
                onPress={() => {
                  setAudioUri(null);
                  setAudioName(null);
                  setAudioMime(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.error,
                  alignItems: 'center',
                }}
              >
                <Text style={[typography.caption, { color: colors.error }]}>
                  {t('leaderSongs.removeAudio')}
                </Text>
              </Pressable>
            )}
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

        <View
          style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}
        >
          {editingId && (
            <Pressable
              onPress={onDelete}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.error,
                alignItems: 'center',
              }}
            >
              <Text style={[typography.button, { color: colors.error }]}>
                {t('leaderSongs.delete')}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => onSave(false)}
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
              {t('leaderSongs.saveDraft')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSave(true)}
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
                {t('leaderSongs.publishNow')}
              </Text>
            )}
          </Pressable>
        </View>

        {editingId && current?.status === 'PUBLISHED' && (
          <Pressable
            onPress={onUnpublish}
            disabled={busy}
            style={{
              marginTop: spacing.md,
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.warning,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.button, { color: colors.warning }]}>
              {t('leaderSongs.unpublish')}
            </Text>
          </Pressable>
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
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
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
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          minHeight: multiline ? 120 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}