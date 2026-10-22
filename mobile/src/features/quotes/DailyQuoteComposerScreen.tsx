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
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { publishTodayQuote } from '../../services/quotes';
import { ApiError } from '../../services/api';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';

type IconName = keyof typeof Ionicons.glyphMap;

const CREAM = '#FFF4E0';

export default function DailyQuoteComposerScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();

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
      Alert.alert(t('quote.published'), t('quote.publishedBody'), [
        { text: t('common.continue'), onPress: () => navigation.goBack() },
      ]);
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
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Full-bleed amber hero ---------- */}
        <LinearGradient
          colors={['#C98B4A', '#A56B36', '#6E4220']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: 16,
            paddingTop: insets.top + 16,
            paddingBottom: 22,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          {/* giant quote mark */}
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -34,
              right: 6,
              fontSize: 170,
              lineHeight: 190,
              fontWeight: '800',
              color: 'rgba(255,255,255,0.14)',
            }}
          >
            “
          </Text>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -40,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: 'rgba(255,215,140,0.14)',
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -70,
              left: -50,
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: 'rgba(255,232,180,0.14)',
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,
                backgroundColor: 'rgba(255,255,255,0.24)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="create" size={22} color={CREAM} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {t('quote.title')}
              </Text>
              <Text
                style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 }}
                numberOfLines={1}
              >
                {t('quote.addToday')}
              </Text>
            </View>

            <GlassBackButton
              onPress={() => navigation.goBack()}
              accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
              size={44}
            />
          </View>
        </LinearGradient>

        {/* ---------- Content ---------- */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* Quote + source */}
          <Card>
            <Field
              icon="chatbubble-ellipses-outline"
              label={t('quote.quoteField')}
              value={quoteText}
              onChange={setQuoteText}
              multiline
            />
            <Field
              icon="bookmark-outline"
              label={t('quote.sourceField')}
              value={source}
              onChange={setSource}
              placeholder="Psalm 23:1"
              autoCapitalize="words"
            />
          </Card>

          {/* Media */}
          <Card>
            <Field
              icon="logo-youtube"
              label={t('quote.youtubeField')}
              value={youtubeUrl}
              onChange={setYoutubeUrl}
              placeholder="https://www.youtube.com/watch?v=..."
              autoCapitalize="none"
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
              {t('quote.audioField')}
            </Text>
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md + 4,
                borderWidth: 1.5,
                borderStyle: audioUri ? 'solid' : 'dashed',
                borderColor: audioUri ? BRAND.violet : colors.border,
                backgroundColor: audioUri
                  ? withAlpha(BRAND.violet, 0.07)
                  : colors.background,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm + 2,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: audioUri
                    ? withAlpha(BRAND.violet, 0.18)
                    : withAlpha(colors.textSecondary, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={audioUri ? 'musical-notes' : 'musical-note-outline'}
                  size={20}
                  color={audioUri ? BRAND.violet : colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  typography.bodySmall,
                  { color: audioUri ? colors.text : colors.textSecondary, flex: 1 },
                ]}
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
                  hitSlop={8}
                  style={{
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: 12,
                    backgroundColor: withAlpha(colors.error, 0.12),
                  }}
                >
                  <Text style={[typography.caption, { color: colors.error, fontWeight: '800' }]}>
                    {t('quote.removeAudio')}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={pickAudio}
                  hitSlop={8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: 12,
                    backgroundColor: withAlpha(BRAND.violet, 0.12),
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={14} color={BRAND.violet} />
                  <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>
                    {t('quote.pickAudio')}
                  </Text>
                </Pressable>
              )}
            </View>
          </Card>

          {error && (
            <View
              style={{
                marginTop: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.md + 2,
                backgroundColor: withAlpha(colors.error, 0.1),
                borderWidth: 1,
                borderColor: withAlpha(colors.error, 0.35),
              }}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[typography.bodySmall, { color: colors.error, flex: 1 }]}>
                {error}
              </Text>
            </View>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={{
              marginTop: spacing.xl,
              borderRadius: radius.md + 6,
              overflow: 'hidden',
              opacity: busy ? 0.6 : 1,
              shadowColor: '#3A1F08',
              shadowOpacity: 0.4,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={['#C98B4A', '#A56B36']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                paddingVertical: spacing.md + 2,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing.sm,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                  <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                    {t('quote.publish')}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  return (
    <View
      style={{
        marginTop: spacing.lg,
        padding: spacing.lg,
        paddingTop: spacing.xs,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize,
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          backgroundColor: colors.background,
          borderColor: focused ? '#A56B36' : colors.border,
          borderWidth: 1.5,
          borderRadius: radius.md + 4,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={focused ? '#A56B36' : colors.textSecondary}
          style={{ marginTop: multiline ? spacing.md : 0 }}
        />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline={multiline}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            paddingVertical: spacing.md,
            color: colors.text,
            minHeight: multiline ? 120 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
      </View>
    </View>
  );
}