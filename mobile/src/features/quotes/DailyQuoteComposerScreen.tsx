import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { publishTodayQuote } from '../../services/quotes';
import { ApiError } from '../../services/api';

export default function DailyQuoteComposerScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [quoteText, setQuoteText] = useState('');
  const [source, setSource] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError('Failed to pick audio.');
    }
  };

  const onSubmit = async () => {
    setError(null);
    if (!quoteText.trim()) return setError(t('register.fieldRequired'));
    if (!source.trim()) return setError(t('register.fieldRequired'));

    setBusy(true);
    try {
      await publishTodayQuote({
        quoteText: quoteText.trim(),
        source: source.trim(),
        youtubeUrl: youtubeUrl.trim() || undefined,
        audioUri,
        audioName,
        audioMime,
      });
      Alert.alert(
        t('quote.published'),
        t('quote.publishedBody'),
        [{ text: t('common.continue'), onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'QUOTE_ALREADY_PUBLISHED') {
        setError(t('quote.alreadyPublishedBody'));
      } else {
        setError(`${err.message} [${err.code}]`);
      }
    } finally {
      setBusy(false);
    }
  };

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
          {t('quote.addToday')}
        </Text>

        <Field
          label={t('quote.quoteField')}
          value={quoteText}
          onChange={setQuoteText}
          multiline
        />
        <Field
          label={t('quote.sourceField')}
          value={source}
          onChange={setSource}
          placeholder="Psalm 23:1"
          autoCapitalize="words"
        />
        <Field
          label={t('quote.youtubeField')}
          value={youtubeUrl}
          onChange={setYoutubeUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          autoCapitalize="none"
        />

        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
          ]}
        >
          {t('quote.audioField')}
        </Text>
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Ionicons
            name={audioUri ? 'musical-notes' : 'musical-note-outline'}
            size={22}
            color={audioUri ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[typography.bodySmall, { color: colors.text, flex: 1 }]}
            numberOfLines={1}
          >
            {audioUri ? audioName : t('quote.audioNone')}
          </Text>
          {audioUri ? (
            <Pressable
              onPress={() => {
                setAudioUri(null);
                setAudioName(null);
                setAudioMime(null);
              }}
            >
              <Text style={[typography.caption, { color: colors.error }]}>
                {t('quote.removeAudio')}
              </Text>
            </Pressable>
          ) : (
            <Pressable onPress={pickAudio}>
              <Text style={[typography.caption, { color: colors.primary }]}>
                {t('quote.pickAudio')}
              </Text>
            </Pressable>
          )}
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

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[typography.button, { color: colors.primaryText }]}>
              {t('quote.publish')}
            </Text>
          )}
        </Pressable>
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