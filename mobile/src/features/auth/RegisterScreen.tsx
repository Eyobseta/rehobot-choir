import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Image, Alert, Animated, Easing } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { register, RegisterInput } from '../../services/registration';
import { ApiError } from '../../services/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { EthDate, formatEthDate, ethTodayFromInstant } from '../../utils/ethiopianCalendar';
import EthDatePicker from '../funding/EthDatePicker';
import {
  AuthScreen,
  AuthField,
  PrimaryButton,
  SecondaryButton,
  ErrorBanner,
  Stepper,
  BRAND,
} from './Auth_UI';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type FormState = {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  gender: 'male' | 'female' | '';
  dateOfBirth: EthDate | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  joiningDate: EthDate | null;
  photoUri: string | null;
};

const INITIAL: FormState = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  gender: '',
  dateOfBirth: null,
  emergencyContactName: '',
  emergencyContactPhone: '',
  joiningDate: null,
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
  const [picker, setPicker] = useState<'dob' | 'joining' | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, enter]);

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
    if (!form.dateOfBirth) return setError(t('register.fieldRequired'));

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
        joiningDate: form.joiningDate ?? undefined,
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

  // ---- picker default values ----
  const today = ethTodayFromInstant(new Date());
  const dobDefault: EthDate = { year: 2000, month: 1, day: 1 };
  const joiningDefault: EthDate = { year: today.year - 1, month: 1, day: 1 };

  return (
    <AuthScreen compact>
      <Text style={[typography.h2, { color: colors.text }]}>{t('register.title')}</Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
        ]}
      >
        {t('register.step', { current: step, total: 3 })}
      </Text>
      <Stepper step={step} icons={['👤', '📋', '📷']} />

      <Animated.View
        style={{
          marginTop: spacing.xl,
          opacity: enter,
          transform: [
            { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
          ],
        }}
      >
        {step === 1 && (
          <>
            <Heading text={t('register.step1Title')} />
            <AuthField
              label={t('register.fullName')}
              icon="👤"
              value={form.fullName}
              onChangeText={(v) => set('fullName', v)}
              autoCapitalize="words"
            />
            <AuthField
              label={t('register.phone')}
              icon="📞"
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <AuthField
              label={t('register.email')}
              icon="✉️"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthField
              label={t('register.password')}
              icon="🔒"
              value={form.password}
              onChangeText={(v) => set('password', v)}
              secureTextEntry
              autoCapitalize="none"
            />
          </>
        )}

        {step === 2 && (
          <>
            <Heading text={t('register.step2Title')} />
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
              ]}
            >
              {t('register.gender')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
              {(['male', 'female'] as const).map((g) => {
                const active = form.gender === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => set('gender', g)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1.5,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary : colors.surface,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: spacing.sm,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        color: active ? colors.primaryText : BRAND.magenta,
                      }}
                    >
                      {g === 'male' ? '♂' : '♀'}
                    </Text>
                    <Text
                      style={[
                        typography.body,
                        {
                          color: active ? colors.primaryText : colors.text,
                          fontWeight: active ? '700' : '500',
                        },
                      ]}
                    >
                      {t(`register.${g}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Date of Birth — E.C. picker */}
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
              ]}
            >
              {t('register.dateOfBirth')} ({t('funding.ethCalendar', { defaultValue: 'Ethiopian calendar' })})
            </Text>
            <Pressable
              onPress={() => setPicker('dob')}
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: form.dateOfBirth ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                marginBottom: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                minHeight: 50,
              }}
            >
              <Text style={{ color: form.dateOfBirth ? colors.text : colors.textSecondary }}>
                {form.dateOfBirth ? formatEthDate(form.dateOfBirth) : t('funding.selectDateHint', { defaultValue: 'Tap to select date' })}
              </Text>
              <Text style={{ fontSize: 16 }}>🎂</Text>
            </Pressable>

            <AuthField
              label={t('register.emergencyContactName')}
              icon="🚑"
              value={form.emergencyContactName}
              onChangeText={(v) => set('emergencyContactName', v)}
              autoCapitalize="words"
            />
            <AuthField
              label={t('register.emergencyContactPhone')}
              icon="📞"
              value={form.emergencyContactPhone}
              onChangeText={(v) => set('emergencyContactPhone', v)}
              keyboardType="phone-pad"
            />

            {/* Joining Date — E.C. picker (optional) */}
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
              ]}
            >
              {t('register.joiningDate')} ({t('funding.ethCalendar', { defaultValue: 'Ethiopian calendar' })})
            </Text>
            <Pressable
              onPress={() => setPicker('joining')}
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: form.joiningDate ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                minHeight: 50,
              }}
            >
              <Text style={{ color: form.joiningDate ? colors.text : colors.textSecondary }}>
                {form.joiningDate ? formatEthDate(form.joiningDate) : t('funding.selectDateHint', { defaultValue: 'Tap to select date' })}
              </Text>
              <Text style={{ fontSize: 16 }}>📅</Text>
            </Pressable>
          </>
        )}

        {step === 3 && (
          <>
            <Heading text={t('register.step3Title')} />

            <Pressable
              onPress={pickPhoto}
              style={{ alignItems: 'center', marginBottom: spacing.xl }}
              accessibilityRole="button"
              accessibilityLabel={t('register.pickPhoto')}
            >
              <LinearGradient
                colors={[BRAND.gold, BRAND.magenta, BRAND.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: BRAND.magenta,
                  shadowOpacity: 0.45,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 8,
                }}
              >
                <View
                  style={{
                    width: 152,
                    height: 152,
                    borderRadius: 76,
                    backgroundColor: colors.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {form.photoUri ? (
                    <Image
                      source={{ uri: form.photoUri }}
                      style={{ width: 140, height: 140, borderRadius: 70 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 140,
                        height: 140,
                        borderRadius: 70,
                        backgroundColor: colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: spacing.md,
                      }}
                    >
                      <Text style={{ fontSize: 34 }}>📷</Text>
                      <Text
                        style={[
                          typography.bodySmall,
                          { color: colors.primary, marginTop: spacing.xs, textAlign: 'center' },
                        ]}
                      >
                        {t('register.pickPhoto')}
                      </Text>
                    </View>
                  )}
                  {form.photoUri ? (
                    <View
                      style={{
                        position: 'absolute',
                        right: 4,
                        bottom: 4,
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: BRAND.magenta,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 3,
                        borderColor: colors.background,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                    </View>
                  ) : null}
                </View>
              </LinearGradient>
            </Pressable>

            <View
              style={{
                padding: spacing.lg,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Review label={t('register.fullName')} value={form.fullName} />
              <Review label={t('register.phone')} value={form.phone} />
              <Review label={t('register.email')} value={form.email} />
              <Review
                label={t('register.gender')}
                value={form.gender ? t(`register.${form.gender}`) : ''}
              />
              <Review
                label={t('register.dateOfBirth')}
                value={form.dateOfBirth ? formatEthDate(form.dateOfBirth) : ''}
              />
              <Review
                label={t('register.emergencyContactName')}
                value={form.emergencyContactName}
              />
              <Review
                label={t('register.emergencyContactPhone')}
                value={form.emergencyContactPhone}
              />
              {form.joiningDate ? (
                <Review label={t('register.joiningDate')} value={formatEthDate(form.joiningDate)} />
              ) : null}
            </View>
          </>
        )}
      </Animated.View>

      {error && (
        <View style={{ marginTop: spacing.md }}>
          <ErrorBanner message={error} />
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          marginTop: spacing.xl,
          marginBottom: spacing.md,
        }}
      >
        <SecondaryButton label={t('register.back')} onPress={back} flex={1} />
        {step < 3 ? (
          <PrimaryButton label={t('register.next')} onPress={next} flex={1} />
        ) : (
          <PrimaryButton
            label={t('register.submit')}
            onPress={submit}
            busy={busy}
            flex={1}
          />
        )}
      </View>

      <EthDatePicker
        visible={picker !== null}
        title={picker === 'dob' ? t('register.dateOfBirth') : t('register.joiningDate')}
        value={picker === 'dob' ? (form.dateOfBirth ?? dobDefault) : (form.joiningDate ?? joiningDefault)}
        onClose={() => setPicker(null)}
        onConfirm={(d) => {
          if (picker === 'dob') set('dateOfBirth', d);
          else if (picker === 'joining') set('joiningDate', d);
          setPicker(null);
        }}
        minYear={1950}
        maxYear={today.year}
      />
    </AuthScreen>
  );
}

// ---------- Helper components ----------

function Heading({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
      <View
        style={{
          width: 4,
          height: 22,
          borderRadius: 2,
          backgroundColor: BRAND.gold,
          marginRight: spacing.sm,
        }}
      />
      <Text style={[typography.h3, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.body, { color: colors.text, fontWeight: '600' }]}>
        {value || '—'}
      </Text>
    </View>
  );
}