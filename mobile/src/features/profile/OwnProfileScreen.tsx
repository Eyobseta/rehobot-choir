import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { getOwnProfile, OwnProfile } from '../../services/members';
import { ApiError } from '../../services/api';

export default function OwnProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setProfile(await getOwnProfile());
        } catch (e) {
          const err = e as ApiError;
          setError(`${err.message} [${err.code}]`);
        } finally {
          setLoading(false);
        }
      })();
    }, []),
  );

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
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, backgroundColor: colors.background }}
    >
      <View style={{ alignItems: 'center' }}>
        <Image
          source={{ uri: profile?.editable.profilePhotoUrl ?? undefined }}
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.surfaceAlt,
          }}
        />
      </View>

      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xl }]}>
        {t('myProfile.officialSection')}
      </Text>
      <Row label={t('register.fullName')} value={profile?.official.fullName ?? ''} />
      <Row label={t('register.gender')} value={profile?.official.gender ?? ''} />
      <Row
        label={t('register.dateOfBirth')}
        value={profile?.official.dateOfBirth ? new Date(profile.official.dateOfBirth).toISOString().slice(0, 10) : '—'}
      />
      <Row
        label={t('register.joiningDate')}
        value={profile?.official.joiningDate ? new Date(profile.official.joiningDate).toISOString().slice(0, 10) : '—'}
      />

      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xl }]}>
        {t('myProfile.editableSection')}
      </Text>
      <Row label={t('register.phone')} value={profile?.editable.phone ?? ''} />
      <Row label={t('register.email')} value={profile?.editable.email ?? '—'} />
      <Row
        label={t('register.emergencyContactName')}
        value={profile?.editable.emergencyContactName ?? ''}
      />
      <Row
        label={t('register.emergencyContactPhone')}
        value={profile?.editable.emergencyContactPhone ?? ''}
      />

      {error && (
        <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.md }]}>
          {error}
        </Text>
      )}

      <Pressable
        onPress={() => navigation.navigate('EditProfile')}
        style={{
          marginTop: spacing.xl,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
        }}
      >
        <Text style={[typography.button, { color: colors.primaryText }]}>
          {t('profile.editProfile')}
        </Text>
      </Pressable>
    </ScrollView>
  );

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <View style={{ marginBottom: spacing.md }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[typography.body, { color: colors.text }]}>{value}</Text>
      </View>
    );
  }
}