import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { register, RegisterInput } from '../../services/registration';
import { ApiError } from '../../services/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  gender: 'male' | 'female' | 'other' | '';
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningDate: string;
  photoUri: string | null;
};

const INITIAL: FormState = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  gender: '',
  dateOfBirth: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  joiningDate: '',
  photoUri: null,
};

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateStep1 = (): string | null => {
    if (!form.fullName.trim()) return t('register.fieldRequired');
    if (!form.phone.trim()) return t('register.fieldRequired');
    if (!form.email.includes('@')) return t('register.invalidEmail');
    if (form.password.length < 8) return t('register.passwordTooShort');
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!form.gender) return t('register.fieldRequired');
    if (!form.dateOfBirth) return t('register.fieldRequired');
    if (!form.emergencyContactName.trim()) return t('register.fieldRequired');
    if (!form.emergencyContactPhone.trim()) return t('register.fieldRequired');
    return null;
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) return setError(err);
      return setStep(2);
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) return setError(err);
      return setStep(3);
    }
  };

  const back = () => {
    setError(null);
    if (step === 1) return navigation.goBack();
    setStep((s) => (s - 1) as 1 | 2);
  };

  const pickPhoto = () => {
    Alert.alert(t('register.pickPhoto'), undefined, [
      { text: t('register.takePhoto'), onPress: takePhoto },
      { text: t('register.chooseFromLibrary'), onPress: chooseFromLibrary },
      { text: t('register.cancel'), style: 'cancel' },
    ]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets[0]) await compress(res.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!res.canceled && res.assets[0]) await compress(res.assets[0].uri);
  };

  const compress = async (uri: string) => {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    set('photoUri', out.uri);
  };

  const submit = async () => {
    setError(null);
    if (!form.photoUri) return setError(t('register.photoRequired'));
    setBusy(true);
    try {
      const input: RegisterInput = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactPhone: form.emergencyContactPhone.trim(),
        joiningDate: form.joiningDate || undefined,
        photoUri: form.photoUri,
        photoMimeType: 'image/jpeg',
      };
      await register(input);
      navigation.replace('Status', { phone: input.phone });
    } catch (e) {
      const err = e as ApiError;
      setError(`${err.message} [${err.code}]`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.h2, { color: colors.primary }]}>
          {t('register.title')}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {t('register.step', { current: step, total: 3 })}
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          {step === 1 && (
            <>
              <Heading text={t('register.step1Title')} />
              <Field label={t('register.fullName')} value={form.fullName} onChange={(v) => set('fullName', v)} />
              <Field label={t('register.phone')} value={form.phone} onChange={(v) => set('phone', v)} keyboardType="phone-pad" autoCapitalize="none" />
              <Field label={t('register.email')} value={form.email} onChange={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
              <Field label={t('register.password')} value={form.password} onChange={(v) => set('password', v)} secureTextEntry />
            </>
          )}

          {step === 2 && (
            <>
              <Heading text={t('register.step2Title')} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                {t('register.gender')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                {(['male', 'female', 'other'] as const).map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => set('gender', g)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: form.gender === g ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={[typography.bodySmall, { color: colors.text }]}>
                      {t(`register.${g}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field label={t('register.dateOfBirth')} value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} autoCapitalize="none" />
              <Field label={t('register.emergencyContactName')} value={form.emergencyContactName} onChange={(v) => set('emergencyContactName', v)} />
              <Field label={t('register.emergencyContactPhone')} value={form.emergencyContactPhone} onChange={(v) => set('emergencyContactPhone', v)} keyboardType="phone-pad" />
              <Field label={t('register.joiningDate')} value={form.joiningDate} onChange={(v) => set('joiningDate', v)} autoCapitalize="none" />
            </>
          )}

          {step === 3 && (
            <>
              <Heading text={t('register.step3Title')} />

              <Pressable onPress={pickPhoto} style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                {form.photoUri ? (
                  <Image source={{ uri: form.photoUri }} style={{ width: 140, height: 140, borderRadius: 70 }} />
                ) : (
                  <View
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 70,
                      backgroundColor: colors.surface,
                      borderWidth: 2,
                      borderColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[typography.bodySmall, { color: colors.primary }]}>
                      {t('register.pickPhoto')}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Review label={t('register.fullName')} value={form.fullName} />
              <Review label={t('register.phone')} value={form.phone} />
              <Review label={t('register.email')} value={form.email} />
              <Review label={t('register.gender')} value={t(`register.${form.gender || 'other'}`)} />
              <Review label={t('register.dateOfBirth')} value={form.dateOfBirth} />
              <Review label={t('register.emergencyContactName')} value={form.emergencyContactName} />
              <Review label={t('register.emergencyContactPhone')} value={form.emergencyContactPhone} />
              {form.joiningDate ? (
                <Review label={t('register.joiningDate')} value={form.joiningDate} />
              ) : null}
            </>
          )}

          {error && (
            <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
              {error}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xl }}>
            <Pressable
              onPress={back}
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
                {t('register.back')}
              </Text>
            </Pressable>

            {step < 3 && (
              <Pressable
                onPress={next}
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={[typography.button, { color: colors.primaryText }]}>
                  {t('register.next')}
                </Text>
              </Pressable>
            )}

            {step === 3 && (
              <Pressable
                onPress={submit}
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
                    {t('register.submit')}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------- Helper components (module scope) ----------

function Heading({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
      {text}
    </Text>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[typography.body, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  return (
    <View style={{ marginBottom: spacing.md }}>
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
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text,
          fontSize: typography.body.fontSize,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({});