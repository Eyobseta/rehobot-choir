import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import * as Device from 'expo-device';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { ScreenHero } from './SettingsKit';
import { BRAND, withAlpha } from '../auth/Auth_UI';
import { me } from '../../services/auth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------- App Info ----------
const APP_INFO = {
  tagline: 'Sing together, grow together',
  contactEmail: 'eyobseta50@gmail.com',
  developerName: 'Eyob Seta',
  developerNickname: 'JOSE',
  organization: 'Rehobot Choir · Negelle Arsi No. 1 Kale Hiwot Church',
  year: new Date().getFullYear(),
};

export default function AboutScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await me();
        setIsLeader(res.user.role === 'LEADER' || res.user.role === 'ADMIN');
      } catch {
        setIsLeader(false);
      }
    })();
  }, []);

  // --- CRASH-PROOF VERSION INFO ---
  let appVersion: string = '1.0.0';
  let buildNumber: string | number = '—';
  let runtimeVersion: string = '—';
  let sdkVersion: string = '—';

  try {
    const cfg = Constants.expoConfig;
    if (cfg) {
      appVersion = cfg.version ?? appVersion;
      buildNumber =
        Platform.OS === 'ios'
          ? cfg.ios?.buildNumber ?? '—'
          : cfg.android?.versionCode ?? '—';
      runtimeVersion = String(cfg.runtimeVersion ?? '—');
      sdkVersion = String(cfg.sdkVersion ?? '—');
    }
  } catch (e) {}

  let updateId: string | null = null;
  let updateChannel: string | number = '—';
  let updateCreatedAt = '—';
  let isEmbedded = true;

  try {
    updateId = Updates.updateId ?? null;
    updateChannel = Updates.channel ?? '—';
    updateCreatedAt = Updates.createdAt
      ? new Date(Updates.createdAt).toLocaleString()
      : '—';
    isEmbedded = Updates.isEmbeddedLaunch ?? true;
  } catch (e) {}

  let deviceName = 'Unknown device';
  let deviceModel = '—';
  let deviceOS: string = Platform.OS;

  try {
    deviceName = Device.deviceName ?? 'Unknown device';
    deviceModel = Device.modelName ?? '—';
    deviceOS = String(`${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`).trim();
  } catch (e) {}
  // --------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        icon="information-circle"
        title={t('about.title', { defaultValue: 'About' })}
        subtitle={APP_INFO.organization}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl * 2,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Card */}
        <View
          style={[
            styles.brandCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.brandLogo, { backgroundColor: BRAND.gold }]}>
            <Ionicons name="musical-notes" size={28} color={BRAND.deep} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: 14 }]}>
            {t('common.appName')}
          </Text>
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
            ]}
          >
            {APP_INFO.tagline}
          </Text>
          <Text
            style={[
              typography.caption,
              { color: colors.textSecondary, marginTop: 10 },
            ]}
          >
            v{appVersion} ({buildNumber})
          </Text>
        </View>

        {/* Developer */}
        <SectionLabel color="#E0409A">
          {t('about.developerSection', { defaultValue: 'Built by' })}
        </SectionLabel>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow
            icon="code-slash"
            tint="#E0409A"
            soft={withAlpha('#E0409A', 0.14)}
            label={t('about.developer', { defaultValue: 'Developer' })}
            value={`${APP_INFO.developerNickname} · ${APP_INFO.developerName}`}
          />
          <InfoRow
            icon="mail"
            tint="#B6A0FF"
            soft={withAlpha('#B6A0FF', 0.14)}
            label={t('about.developerEmail', { defaultValue: 'Developer email' })}
            value={APP_INFO.contactEmail}
            last
          />
        </View>

        {/* Build */}
        <SectionLabel color={BRAND.violet}>
          {t('about.buildSection', { defaultValue: 'Build' })}
        </SectionLabel>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow
            icon="cloud-download"
            tint="#B6A0FF"
            soft={withAlpha('#B6A0FF', 0.14)}
            label={t('about.updateChannel', { defaultValue: 'Update channel' })}
            value={String(updateChannel)}
          />
          <InfoRow
            icon="git-commit"
            tint="#6EDBD5"
            soft={withAlpha('#6EDBD5', 0.14)}
            label={t('about.updateId', { defaultValue: 'Update ID' })}
            value={
              isEmbedded
                ? t('about.embedded', { defaultValue: 'Embedded (original build)' })
                : updateId ?? '—'
            }
          />
          <InfoRow
            icon="time"
            tint="#EE9BBD"
            soft={withAlpha('#EE9BBD', 0.14)}
            label={t('about.updateDate', { defaultValue: 'Update published' })}
            value={isEmbedded ? '—' : updateCreatedAt}
          />
          <InfoRow
            icon="layers"
            tint="#E6C779"
            soft={withAlpha('#E6C779', 0.14)}
            label={t('about.runtimeVersion', { defaultValue: 'Runtime version' })}
            value={String(runtimeVersion)}
          />
          <InfoRow
            icon="cube"
            tint="#B8E986"
            soft={withAlpha('#B8E986', 0.14)}
            label={t('about.sdkVersion', { defaultValue: 'Expo SDK' })}
            value={String(sdkVersion)}
            last
          />
        </View>

        {/* Device (leaders only) */}
        {isLeader && (
          <>
            <SectionLabel color={BRAND.magenta}>
              {t('about.deviceSection', { defaultValue: 'Device (leaders only)' })}
            </SectionLabel>
            <View
              style={[
                styles.group,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <InfoRow
                icon="phone-portrait"
                tint="#B6A0FF"
                soft={withAlpha('#B6A0FF', 0.14)}
                label={t('about.deviceName', { defaultValue: 'Device' })}
                value={deviceName}
              />
              <InfoRow
                icon="hardware-chip"
                tint="#6EDBD5"
                soft={withAlpha('#6EDBD5', 0.14)}
                label={t('about.deviceModel', { defaultValue: 'Model' })}
                value={deviceModel}
              />
              <InfoRow
                icon="logo-android"
                tint="#B8E986"
                soft={withAlpha('#B8E986', 0.14)}
                label={t('about.deviceOs', { defaultValue: 'OS' })}
                value={deviceOS}
                last
              />
            </View>
          </>
        )}

        {/* Contact */}
        <SectionLabel color="#0EA5E9">
          {t('about.contactSection', { defaultValue: 'Contact' })}
        </SectionLabel>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ActionRow
            icon="mail"
            tint="#EE9BBD"
            soft={withAlpha('#EE9BBD', 0.14)}
            label={t('about.email', { defaultValue: 'Email' })}
            value={APP_INFO.contactEmail}
            onPress={() =>
              Linking.openURL(`mailto:${APP_INFO.contactEmail}`).catch(() => {})
            }
            last
          />
        </View>

        {/* Legal */}
        <SectionLabel color="#F59E0B">
          {t('about.legalSection', { defaultValue: 'Legal' })}
        </SectionLabel>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <LegalRow
            icon="shield-checkmark"
            tint="#B6A0FF"
            soft={withAlpha('#B6A0FF', 0.14)}
            label={t('about.privacy', { defaultValue: 'Privacy Policy' })}
            onPress={() =>
              Alert.alert(
                'Privacy Policy',
                'This app keeps all data inside the Rehobot Choir. Contact the choir leadership for data requests.'
              )
            }
          />
          <LegalRow
            icon="document-text"
            tint="#6EDBD5"
            soft={withAlpha('#6EDBD5', 0.14)}
            label={t('about.terms', { defaultValue: 'Terms of Service' })}
            onPress={() =>
              Alert.alert(
                'Terms of Service',
                'By using this app you agree to respect choir members, keep their information private, and only post content you have the right to share.'
              )
            }
            last
          />
        </View>

        <Text
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
              textAlign: 'center',
              marginTop: 28,
              lineHeight: 18,
            },
          ]}
        >
          Made with ♥ by {APP_INFO.developerNickname} ({APP_INFO.developerName}){'\n'}
          © {APP_INFO.year} Rehobot Choir
        </Text>
      </ScrollView>
    </View>
  );
}

// ---------- Helpers ----------

function SectionLabel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <View style={styles.sectionRow}>
      <View style={[styles.sectionBar, { backgroundColor: color }]} />
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {children}
      </Text>
    </View>
  );
}

function InfoRow({
  icon,
  tint,
  soft,
  label,
  value,
  last,
}: {
  icon: IconName;
  tint: string;
  soft: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <View
      style={[
        styles.infoRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.text, fontWeight: '600', marginTop: 2 },
          ]}
          numberOfLines={3}
          selectable
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  tint,
  soft,
  label,
  value,
  onPress,
  last,
}: {
  icon: IconName;
  tint: string;
  soft: string;
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { backgroundColor: withAlpha(BRAND.violet, 0.06) },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[
            typography.bodySmall,
            { color: colors.text, fontWeight: '600', marginTop: 2 },
          ]}
        >
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

function LegalRow({
  icon,
  tint,
  soft,
  label,
  onPress,
  last,
}: {
  icon: IconName;
  tint: string;
  soft: string;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.infoRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        pressed && { backgroundColor: withAlpha(BRAND.violet, 0.06) },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text
        style={[
          typography.body,
          { color: colors.text, fontWeight: '600', flex: 1 },
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  brandLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    marginBottom: 11,
  },
  sectionBar: { width: 4, height: 14, borderRadius: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  group: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});