import React, { memo } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme/ThemeContext';
import { BRAND, withAlpha } from '../../auth/Auth_UI';
import { Avatar } from './ChatUI';
import { VoicePlayer } from './VoicePlayer';
import { useTr } from '../chatStrings';
import { formatClock, messagePreview, thumbUrl } from '../chatUtils';
import type { ChatMessage } from '../chatTypes';

type Props = {
  message: ChatMessage;
  meId: string;
  showSender: boolean;
  seen: boolean;
  highlighted: boolean;
  onLongPress: (m: ChatMessage) => void;
  onToggleReaction: (m: ChatMessage, emoji: string) => void;
  onOpenPhotos: (urls: string[], index: number) => void;
  onRetry: (m: ChatMessage) => void;
  onPressReply: (messageId: string) => void;
};

function groupReactions(m: ChatMessage, meId: string) {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of m.reactions) {
    const cur = map.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.userId === meId) cur.mine = true;
    map.set(r.emoji, cur);
  }
  return Array.from(map.entries());
}

function MessageBubbleBase({
  message: m,
  meId,
  showSender,
  seen,
  highlighted,
  onLongPress,
  onToggleReaction,
  onOpenPhotos,
  onRetry,
  onPressReply,
}: Props) {
  const tr = useTr();
  const { theme } = useTheme();
  const { colors } = theme;
  const { width } = useWindowDimensions();

  const mine = m.sender.id === meId;
  const bubbleBg = mine ? BRAND.violet : colors.surface;
  const textColor = mine ? '#FFFFFF' : colors.text;
  const subColor = mine ? 'rgba(255,255,255,0.75)' : colors.textSecondary;
  const maxW = Math.min(width * 0.76, 340);
  const photos = m.media.filter((x) => x.type === 'PHOTO');
  const voice = m.media.find((x) => x.type === 'VOICE');
  const reactions = groupReactions(m, meId);
  const failed = m._status === 'failed';
  const sending = m._status === 'sending';

  const tile = photos.length === 1 ? Math.min(maxW - 12, 270) : (Math.min(maxW - 12, 270) - 4) / 2;
  const tileH = photos.length === 1 ? tile * 0.75 : tile;

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        marginVertical: 3,
      }}
    >
      {!mine && showSender ? (
        <View style={{ marginRight: 6, marginBottom: 2 }}>
          <Avatar uri={m.sender.profilePhotoUrl} name={m.sender.fullName} size={28} />
        </View>
      ) : null}

      <View style={{ maxWidth: maxW, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <Pressable
          onLongPress={() => !sending && onLongPress(m)}
          onPress={failed ? () => onRetry(m) : undefined}
          delayLongPress={250}
          style={{
            backgroundColor: bubbleBg,
            borderRadius: 18,
            borderBottomRightRadius: mine ? 5 : 18,
            borderBottomLeftRadius: mine ? 18 : 5,
            paddingHorizontal: 6,
            paddingTop: 6,
            paddingBottom: 5,
            borderWidth: mine ? 0 : 1,
            borderColor: colors.border,
            opacity: sending ? 0.7 : 1,
            ...(highlighted ? { borderWidth: 2, borderColor: BRAND.gold } : null),
          }}
        >
          {!mine && showSender ? (
            <Text
              numberOfLines={1}
              style={{ color: BRAND.magenta, fontWeight: '800', fontSize: 12, marginHorizontal: 6, marginBottom: 3 }}
            >
              {m.sender.fullName}
            </Text>
          ) : null}

          {m.replyTo && !m.deleted ? (
            <Pressable
              onPress={() => m.replyTo && onPressReply(m.replyTo.id)}
              style={{
                marginBottom: 5,
                marginHorizontal: 0,
                padding: 7,
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: mine ? BRAND.gold : BRAND.magenta,
                backgroundColor: mine ? 'rgba(255,255,255,0.16)' : withAlpha(BRAND.violet, 0.09),
              }}
            >
              <Text numberOfLines={1} style={{ color: mine ? BRAND.gold : BRAND.magenta, fontWeight: '800', fontSize: 12 }}>
                {m.replyTo.sender.fullName}
              </Text>
              <Text numberOfLines={2} style={{ color: textColor, opacity: 0.85, fontSize: 13 }}>
                {messagePreview(m.replyTo, tr)}
              </Text>
            </Pressable>
          ) : null}

          {m.deleted ? (
            <Text style={{ color: subColor, fontStyle: 'italic', fontSize: 14, marginHorizontal: 6, marginVertical: 3 }}>
              🚫 {tr('messageDeleted')}
            </Text>
          ) : (
            <>
              {m.mediaExpired ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, margin: 6 }}>
                  <Ionicons name="image-outline" size={18} color={subColor} />
                  <Text style={{ color: subColor, fontStyle: 'italic', fontSize: 13 }}>{tr('mediaExpired')}</Text>
                </View>
              ) : null}

              {photos.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: m.text ? 5 : 0 }}>
                  {photos.map((p, i) => (
                    <Pressable
                      key={p.id}
                      onPress={() =>
                        onOpenPhotos(
                          photos.map((x) => x.storageUrl),
                          i,
                        )
                      }
                      onLongPress={() => !sending && onLongPress(m)}
                    >
                      <Image
                        source={{ uri: thumbUrl(p.storageUrl, 600) }}
                        style={{ width: tile, height: tileH, borderRadius: 13, backgroundColor: colors.border }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                        recyclingKey={p.id}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {voice ? (
                <View style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
                  <VoicePlayer
                    uri={voice.storageUrl}
                    durationSeconds={voice.durationSeconds ?? 0}
                    mine={mine}
                    textColor={textColor}
                  />
                </View>
              ) : null}

              {m.text ? (
                <Text style={{ color: textColor, fontSize: 16, lineHeight: 22, marginHorizontal: 6, marginTop: 2 }}>
                  {m.text}
                </Text>
              ) : null}
            </>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 5,
              marginRight: 6,
              marginTop: 2,
            }}
          >
            {m.pinned ? <Ionicons name="pin" size={11} color={subColor} /> : null}
            {m.editedAt && !m.deleted ? (
              <Text style={{ color: subColor, fontSize: 11 }}>{tr('edited')}</Text>
            ) : null}
            <Text style={{ color: subColor, fontSize: 11 }}>{formatClock(m.createdAt)}</Text>
            {mine && !m.deleted ? (
              failed ? (
                <Ionicons name="alert-circle" size={14} color="#FFB4B4" />
              ) : sending ? (
                <Ionicons name="time-outline" size={13} color={subColor} />
              ) : (
                <Ionicons
                  name={seen ? 'checkmark-done' : 'checkmark'}
                  size={15}
                  color={seen ? BRAND.gold : subColor}
                />
              )
            ) : null}
          </View>
        </Pressable>

        {failed ? (
          <Text style={{ color: colors.error, fontSize: 12, marginTop: 2 }}>{tr('failed')}</Text>
        ) : null}

        {reactions.length > 0 && !m.deleted ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -4, marginHorizontal: 6 }}>
            {reactions.map(([emoji, info]) => (
              <Pressable
                key={emoji}
                onPress={() => onToggleReaction(m, emoji)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 12,
                  backgroundColor: info.mine ? withAlpha(BRAND.violet, 0.22) : colors.surface,
                  borderWidth: 1,
                  borderColor: info.mine ? BRAND.violet : colors.border,
                }}
              >
                <Text style={{ fontSize: 13 }}>{emoji}</Text>
                {info.count > 1 ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
                    {info.count}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleBase);
