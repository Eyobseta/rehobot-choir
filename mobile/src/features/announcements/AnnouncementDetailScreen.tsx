import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import {
  getAnnouncement,
  AnnouncementDetail,
} from '../../services/announcements';
import { ApiError } from '../../services/api';

export default function AnnouncementDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const { id } = route.params;

  const [item, setItem] = useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setItem(await getAnnouncement(id));
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

  if (!item) {
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
          {error ?? t('announcements.notFound')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingBottom: spacing.xl,
        backgroundColor: colors.background,
      }}
    >
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: '100%', height: 220 }}
        />
      )}

      <View style={{ padding: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: spacing.xs },
          ]}
        >
          {new Date(item.publishAt).toLocaleString()}
        </Text>

        <Text
          style={[
            typography.body,
            { color: colors.text, marginTop: spacing.lg, lineHeight: 22 },
          ]}
        >
          {item.message}
        </Text>

        {item.event && (
          <Pressable
            onPress={() =>
              navigation.navigate('Home', {
                screen: 'EventDetail',
                params: { id: item.event!.id },
              })
            }
            style={{
              marginTop: spacing.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: 'center',
            }}
          >
            <Text style={[typography.bodySmall, { color: colors.primary }]}>
              {item.event.title}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginTop: 2 },
              ]}
            >
              {new Date(item.event.date).toLocaleString()}
            </Text>
          </Pressable>
        )}

        {item.songs.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[typography.h3, { color: colors.text }]}>
              {t('announcements.songs')}
            </Text>
            {item.songs.map((s) => (
              <Text
                key={s.id}
                style={[
                  typography.body,
                  { color: colors.text, marginTop: spacing.xs },
                ]}
              >
                • {s.songTitle}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}