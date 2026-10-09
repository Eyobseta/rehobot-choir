import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { logout, me } from '../../services/auth';
import { getOwnProfile } from '../../services/members';
import { getMyQuoteCount } from '../../services/quotes';
import { setSessionState } from '../../services/session';
import { setRole } from '../../services/role';

export default function ProfileScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const [phone, setPhone] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [quoteCount, setQuoteCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const res = await me();
          setPhone(res.user.phone);
          setRoleLabel(res.user.role);
        } catch {
          // ignore
        }
        try {
          const p = await getOwnProfile();
          setFullName(p.official.fullName || '');
          setPhotoUrl(p.editable.profilePhotoUrl);
        } catch {
          // ignore
        }
        try {
          setQuoteCount(await getMyQuoteCount());
        } catch {
          setQuoteCount(null);
        }
      })();
    }, []),
  );

  const onLogout = async () => {
    await logout();
    setRole(null);
    setSessionState('unauthenticated');
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      <Text style={[typography.h1, { color: colors.primary }]}>
        {t('tabs.profile')}
      </Text>

      {/* Header card */}
      <View
        style={{
          marginTop: spacing.lg,
          padding: spacing.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable onPress={() => navigation.navigate('OwnProfile')}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surfaceAlt,
              }}
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[typography.h2, { color: colors.textSecondary }]}>
                {(fullName || phone || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={{ marginLeft: spacing.lg, flex: 1 }}>
          <Text
            style={[typography.h3, { color: colors.text }]}
            numberOfLines={1}
          >
            {fullName || phone}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {phone}
          </Text>
          <Text
            style={[typography.caption, { color: colors.primary, marginTop: 2 }]}
          >
            {roleLabel}
          </Text>
        </View>
      </View>

      {/* Quote count */}
      {quoteCount !== null && (
        <View
          style={{
            marginTop: spacing.md,
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
          <Ionicons name="book-outline" size={20} color={colors.primary} />
          <Text style={[typography.bodySmall, { color: colors.text }]}>
            {t('quote.publishedCount', { count: quoteCount })}
          </Text>
        </View>
      )}

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
              <Row
          label={t('notifications.title')}
          onPress={() => navigation.navigate('Notifications')}
        />
        <Row
          label={t('notifications.preferences')}
          onPress={() => navigation.navigate('NotificationPreferences')}
        />
         <Row
          label={t('attendance.history')}
          onPress={() => navigation.navigate('MyAttendance')}
        />
        <Row
          label={t('myProfile.title')}
          onPress={() => navigation.navigate('OwnProfile')}
        />
        <Row
          label={t('settings.appearance')}
          onPress={() => navigation.navigate('Appearance')}
        />
        <Row
          label={t('settings.language')}
          onPress={() => navigation.navigate('Language')}
        />
        <Row
          label={t('password.changeTitle')}
          onPress={() => navigation.navigate('ChangePassword')}
        />
          
        <Row
          label={t('deleteAccount.title')}
          onPress={() => navigation.navigate('DeleteAccount')}
          danger
        />
      </View>

      <Pressable onPress={onLogout} style={{ marginTop: spacing.xl }}>
        <Text
          style={[
            typography.body,
            { color: colors.error, textAlign: 'center', fontWeight: '600' },
          ]}
        >
          Log out
        </Text>
      </Pressable>
    </ScrollView>
  );

  function Row({
    label,
    onPress,
    danger,
  }: {
    label: string;
    onPress: () => void;
    danger?: boolean;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={{
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
        }}
      >
        <Text
          style={[
            typography.body,
            { color: danger ? colors.error : colors.text },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
}