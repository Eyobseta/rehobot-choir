import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, Animated, Easing, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { register, RegisterInput } from '../../services/registration';
import { ApiError } from '../../services/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { EthDate } from '../../utils/ethiopianCalendar';
import EthDatePicker from '../funding/EthDatePicker';
import { useRegistrationDates } from './useRegistrationDates';
import {
  AuthScreen,
  AuthField,
  AvatarRing,
  PrimaryButton,
  SecondaryButton,
  ErrorBanner,
  Stepper,
  BRAND,
} from './Auth_UI';
import {
  ChoiceCards,
  DateField,
  PasswordMeter,
  ReviewRow,
  ReviewSection,
  fieldIcon,
  useShake,
} from './Auth_kit';

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

/** A validation failure: which field to highlight + the message to show. */
type Invalid = { field: keyof FormState; message: string };

export default function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  // Registration-only date helpers (isolated from shared dateFormatter).
  const {
    bounds,
    defaultPickerValue,
    format: formatDate,
    isDobInRange,
    isJoiningDateInRange,
  } = useRegistrationDates();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<keyof FormState | null>(null);
  const [picker, setPicker] = useState<'dob' | 'joining' | null>(null);

  const { shakeStyle, shake } = useShake();

  // Refs so "Next" on the keyboard jumps to the following field.
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const ecPhoneRef = useRef<TextInput>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Step transition: slides in from the right going forward, from the left going back.
  const dir = useRef(1);
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
    if (invalidField === key) {
      setInvalidField(null);
      setError(null);
    }
  };

  const validateStep1 = (): Invalid | null => {
    if (!form.fullName.trim())
      return { field: 'fullName', message: t('register.fieldRequired') };
    if (!form.phone.trim()) return { field: 'phone', message: t('register.fieldRequired') };
    if (!form.email.includes('@'))
      return { field: 'email', message: t('register.invalidEmail') };
    if (form.password.length < 8)
      return { field: 'password', message: t('register.passwordTooShort') };
    return null;
  };

  const validateStep2 = (): Invalid | null => {
    if (!form.gender) return { field: 'gender', message: t('register.fieldRequired') };
    if (!form.dateOfBirth)
      return { field: 'dateOfBirth', message: t('register.fieldRequired') };
    if (!isDobInRange(form.dateOfBirth)) {
      return {
        field: 'dateOfBirth',
        message: t('register.invalidDate', {
          defaultValue: 'Please select a valid date of birth.',
        }),
      };
    }
    if (!form.emergencyContactName.trim())
      return { field: 'emergencyContactName', message: t('register.fieldRequired') };
    if (!form.emergencyContactPhone.trim())
      return { field: 'emergencyContactPhone', message: t('register.fieldRequired') };
    if (form.joiningDate && !isJoiningDateInRange(form.joiningDate)) {
      return {
        field: 'joiningDate',
        message: t('register.invalidDate', {
          defaultValue: 'Please select a valid joining date.',
        }),
      };
    }
    return null;
  };

  const fail = (v: Invalid) => {
    setInvalidField(v.field);
    setError(v.message);
    shake();
  };

  const clearErrors = () => {
    setError(null);
    setInvalidField(null);
  };

  const next = () => {
    clearErrors();
    if (step === 1) {
      const err = validateStep1();
      if (err) return fail(err);
      dir.current = 1;
      return setStep(2);
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) return fail(err);
      dir.current = 1;
      return setStep(3);
    }
  };

  const back = () => {
    clearErrors();
    if (step === 1) return navigation.goBack();
    dir.current = -1;
    setStep((s) => (s - 1) as 1 | 2);
  };

  const jumpTo = (target: 1 | 2) => {
    clearErrors();
    dir.current = -1;
    setStep(target);
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
    clearErrors();
    if (!form.photoUri) return fail({ field: 'photoUri', message: t('register.photoRequired') });
    if (!form.dateOfBirth)
      return fail({ field: 'dateOfBirth', message: t('register.fieldRequired') });

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
      shake();
    } finally {
      setBusy(false);
    }
  };

  const ethSuffix = `(${t('funding.ethCalendar', { defaultValue: 'Ethiopian calendar' })})`;
  const datePlaceholder = t('funding.selectDateHint', { defaultValue: 'Tap to select date' });
  const photoInvalid = invalidField === 'photoUri';

  return (
    <AuthScreen compact>
      <Text style={[typography.h1, { color: colors.text }]}>{t('register.title')}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: spacing.xs,
          marginBottom: spacing.lg,
        }}
      >
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingVertical: 3,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(108,63,224,0.14)',
          }}
        >
          <Text style={[typography.caption, { color: BRAND.violet, fontWeight: '800' }]}>
            {t('register.step', { current: step, total: 3 })}
          </Text>
        </View>
      </View>
      <Stepper step={step} icons={['👤', '📋', '📷']} />

      <Animated.View
        style={{
          marginTop: spacing.xl,
          opacity: enter,
          transform: [
            {
              translateX: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [28 * dir.current, 0],
              }),
            },
          ],
        }}
      >
        {step === 1 && (
          <>
            <Heading text={t('register.step1Title')} />
            <AuthField
              label={t('register.fullName')}
              iconNode={fieldIcon('person-outline')}
              value={form.fullName}
              onChangeText={(v) => set('fullName', v)}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              error={invalidField === 'fullName'}
              showCheck
            />
            <AuthField
              label={t('register.phone')}
              iconNode={fieldIcon('call-outline')}
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoComplete="tel"
              returnKeyType="next"
              inputRef={phoneRef}
              onSubmitEditing={() => emailRef.current?.focus()}
              error={invalidField === 'phone'}
              showCheck
            />
            <AuthField
              label={t('register.email')}
              iconNode={fieldIcon('mail-outline')}
              value={form.email}
              onChangeText={(v) => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              inputRef={emailRef}
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={invalidField === 'email'}
              showCheck={form.email.includes('@')}
            />
            <AuthField
              label={t('register.password')}
              iconNode={fieldIcon('lock-closed-outline')}
              value={form.password}
              onChangeText={(v) => set('password', v)}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="go"
              inputRef={passwordRef}
              onSubmitEditing={next}
              error={invalidField === 'password'}
            />
            <PasswordMeter password={form.password} />
          </>
        )}

        {step === 2 && (
          <>
            <Heading text={t('register.step2Title')} />

            <ChoiceCards
              label={t('register.gender')}
              value={form.gender}
              onChange={(g) => set('gender', g)}
              invalid={invalidField === 'gender'}
              options={[
                { value: 'male', label: t('register.male'), icon: 'male' },
                { value: 'female', label: t('register.female'), icon: 'female' },
              ]}
            />

            {/* Date of Birth — E.C. picker (opens on today when empty) */}
            <DateField
              label={`${t('register.dateOfBirth')} ${ethSuffix}`}
              icon="gift-outline"
              text={form.dateOfBirth ? formatDate(form.dateOfBirth) : ''}
              placeholder={datePlaceholder}
              onPress={() => setPicker('dob')}
              invalid={invalidField === 'dateOfBirth'}
            />

            <AuthField
              label={t('register.emergencyContactName')}
              iconNode={fieldIcon('medkit-outline')}
              value={form.emergencyContactName}
              onChangeText={(v) => set('emergencyContactName', v)}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => ecPhoneRef.current?.focus()}
              error={invalidField === 'emergencyContactName'}
            />
            <AuthField
              label={t('register.emergencyContactPhone')}
              iconNode={fieldIcon('call-outline')}
              value={form.emergencyContactPhone}
              onChangeText={(v) => set('emergencyContactPhone', v)}
              keyboardType="phone-pad"
              returnKeyType="done"
              inputRef={ecPhoneRef}
              error={invalidField === 'emergencyContactPhone'}
            />

            {/* Joining Date — E.C. picker (optional, opens on today when empty) */}
            <DateField
              label={`${t('register.joiningDate')} ${ethSuffix}`}
              icon="calendar-outline"
              text={form.joiningDate ? formatDate(form.joiningDate) : ''}
              placeholder={datePlaceholder}
              onPress={() => setPicker('joining')}
              onClear={() => set('joiningDate', null)}
              invalid={invalidField === 'joiningDate'}
            />
          </>
        )}

        {step === 3 && (
          <>
            <Heading text={t('register.step3Title')} />

            {/* Photo */}
            <Pressable
              onPress={pickPhoto}
              style={{ alignItems: 'center', marginBottom: spacing.xl }}
              accessibilityRole="button"
              accessibilityLabel={t('register.pickPhoto')}
            >
              <AvatarRing
                size={150}
                uri={form.photoUri}
                gapColor={colors.background}
                fallback={
                  <View style={{ alignItems: 'center', padding: spacing.md }}>
                    <Ionicons name="person" size={52} color={withMuted(colors.textSecondary)} />
                  </View>
                }
              >
                <View
                  style={{
                    position: 'absolute',
                    right: 2,
                    bottom: 2,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: BRAND.magenta,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: colors.background,
                  }}
                >
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                </View>
              </AvatarRing>
              <Text
                style={[
                  typography.bodySmall,
                  {
                    marginTop: spacing.md,
                    fontWeight: '700',
                    color: photoInvalid ? colors.error : BRAND.violet,
                  },
                ]}
              >
                {form.photoUri ? t('register.takePhoto') : t('register.pickPhoto')}
              </Text>
            </Pressable>

            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginBottom: spacing.md, textAlign: 'center' },
              ]}
            >
              {t('register.reviewInfo')}
            </Text>

            <ReviewSection title={t('register.step1Title')} onEdit={() => jumpTo(1)}>
              <ReviewRow icon="person-outline" label={t('register.fullName')} value={form.fullName} />
              <ReviewRow icon="call-outline" label={t('register.phone')} value={form.phone} />
              <ReviewRow icon="mail-outline" label={t('register.email')} value={form.email} last />
            </ReviewSection>

            <ReviewSection title={t('register.step2Title')} onEdit={() => jumpTo(2)}>
              <ReviewRow
                icon={form.gender === 'female' ? 'female' : 'male'}
                label={t('register.gender')}
                value={form.gender ? t(`register.${form.gender}`) : ''}
              />
              <ReviewRow
                icon="gift-outline"
                label={t('register.dateOfBirth')}
                value={form.dateOfBirth ? formatDate(form.dateOfBirth) : ''}
              />
              <ReviewRow
                icon="medkit-outline"
                label={t('register.emergencyContactName')}
                value={form.emergencyContactName}
              />
              <ReviewRow
                icon="call-outline"
                label={t('register.emergencyContactPhone')}
                value={form.emergencyContactPhone}
                last={!form.joiningDate}
              />
              {form.joiningDate ? (
                <ReviewRow
                  icon="calendar-outline"
                  label={t('register.joiningDate')}
                  value={formatDate(form.joiningDate)}
                  last
                />
              ) : null}
            </ReviewSection>
          </>
        )}
      </Animated.View>

      {error ? (
        <Animated.View style={[{ marginTop: spacing.md }, shakeStyle]}>
          <ErrorBanner message={error} />
        </Animated.View>
      ) : null}

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
            iconNode={<Ionicons name="paper-plane" size={18} color="#FFFFFF" />}
          />
        )}
      </View>

      <EthDatePicker
        visible={picker !== null}
        title={picker === 'dob' ? t('register.dateOfBirth') : t('register.joiningDate')}
        value={
          picker === 'dob'
            ? (form.dateOfBirth ?? defaultPickerValue())
            : (form.joiningDate ?? defaultPickerValue())
        }
        onClose={() => setPicker(null)}
        onConfirm={(d) => {
          if (picker === 'dob') set('dateOfBirth', d);
          else if (picker === 'joining') set('joiningDate', d);
          setPicker(null);
        }}
        minYear={bounds.minYear}
        maxYear={bounds.maxYear}
      />
    </AuthScreen>
  );
}

// ---------- Helpers ----------

/** Keeps the placeholder avatar icon subtle in both themes. */
function withMuted(color: string): string {
  return color.length === 7 ? `${color}99` : color;
}

function Heading({ text }: { text: string }) {
  const { theme } = useTheme();
  const { colors, typography, spacing } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
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