import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { getMember, MemberDetail } from '../../services/members';
import { ApiError } from '../../services/api';
import type { HomeStackParamList } from '../../navigation/HomeStack';

type Props = NativeStackScreenProps<HomeStackParamList, 'MemberProfile'>;

export default function MemberProfileScreen({ route }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [member, setMember] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setMember(await getMember(id));
      } catch (e) {
        const err = e as ApiError;
        setError(`${err.message} [${err.code}]`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  if (!member) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.body, { color: colors.error }]}>
          {error ?? 'Not found'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Image
          source={{ uri: member.profilePhotoUrl ?? undefined }}
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: colors.surfaceAlt,
          }}
        />
        <Text
          style={[
            typography.h2,
            { color: colors.text, marginTop: spacing.md, textAlign: 'center' },
          ]}
        >
          {member.fullName}
        </Text>
      </View>

      {!member.deleted && (
        <View style={{ marginTop: spacing.xl }}>
          {member.phone && (
            <Pressable
              onPress={() => Linking.openURL(`tel:${member.phone}`)}
              style={{ marginBottom: spacing.md }}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {t('memberProfile.phone')}
              </Text>
              <Text
                style={[
                  typography.body,
                  { color: colors.primary, textDecorationLine: 'underline' },
                ]}
              >
                {member.phone}
              </Text>
            </Pressable>
          )}

          {member.email && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {t('memberProfile.email')}
              </Text>
              <Text style={[typography.body, { color: colors.text }]}>
                {member.email}
              </Text>
            </View>
          )}

          {member.gender && (
            <Row label={t('memberProfile.gender')} value={member.gender} />
          )}
          {member.dateOfBirth && (
            <Row
              label={t('memberProfile.dateOfBirth')}
              value={new Date(member.dateOfBirth).toISOString().slice(0, 10)}
            />
          )}
          {member.joiningDate && (
            <Row
              label={t('memberProfile.joiningDate')}
              value={new Date(member.joiningDate).toISOString().slice(0, 10)}
            />
          )}
        </View>
      )}
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