import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeContext';
import { FavoriteRow } from '../../services/songs';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import { useFavoriteSongsQuery } from './useSongs';
import {
  HEART,
  PALETTES,
  ScreenHero,
  HeroPill,
  SavedPill,
  EmptyState,
  ListSkeleton,
  SongRow,
  useNowPlaying,
} from './Songs_Kit';

export default function FavoritesScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const np = useNowPlaying();

  const q = useFavoriteSongsQuery();
  const items = q.data ?? [];
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHero
        gradient={['#5C1230', HEART, BRAND.magenta]}
        icon="heart"
        overline={t('tabs.songs', { defaultValue: 'Songs' })}
        title={t('songs.favorites')}
        onBack={() => navigation.goBack()}
      >
        {!firstLoad && (
          <HeroPill
            icon="heart"
            text={t('songs.count', { count: items.length, defaultValue: '{{count}} songs' })}
          />
        )}
      </ScreenHero>

      {showingSavedData && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <SavedPill />
        </View>
      )}

      {q.isError && q.data === undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <ErrorBanner message={(q.error as any)?.message ?? 'Error'} />
        </View>
      )}

      <FlatList
        data={firstLoad ? [] : items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !firstLoad}
            onRefresh={() => q.refetch()}
            tintColor={HEART}
            colors={[HEART]}
          />
        }
        ListEmptyComponent={
          firstLoad ? (
            <ListSkeleton rows={5} />
          ) : (
            <EmptyState
              icon="heart-outline"
              text={t('songs.emptyFavorites')}
              ring={[HEART, BRAND.magenta, BRAND.gold]}
            />
          )
        }
        renderItem={({ item, index }) => (
          <FavCard
            item={item}
            index={index}
            playing={np.playing && np.key === item.song.id}
            onPress={() => navigation.navigate('SongDetail', { id: item.song.id })}
          />
        )}
      />
    </View>
  );
}

function FavCard({
  item,
  index,
  playing,
  onPress,
}: {
  item: FavoriteRow;
  index: number;
  playing: boolean;
  onPress: () => void;
}) {
  return (
    <SongRow
      index={index}
      title={item.song.title}
      subtitle={item.song.category?.name}
      icon="musical-notes"
      palette={PALETTES[index % PALETTES.length]}
      playing={playing}
      onPress={onPress}
      trailing={
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            marginLeft: 8,
            backgroundColor: withAlpha(HEART, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="heart" size={17} color={HEART} />
        </View>
      }
    />
  );
}