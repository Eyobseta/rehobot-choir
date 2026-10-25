import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { BRAND, withAlpha } from '../../auth/Auth_UI';
import { formatDuration } from '../chatUtils';

const RATES = [1, 1.5, 2];

type Owner = { stop: () => void };
let activeOwner: Owner | null = null;

/**
 * Voice message player with 1x / 1.5x / 2x speed (SRS 19.11).
 * The audio is only downloaded when the user presses play.
 */
export function VoicePlayer({
  uri,
  durationSeconds,
  mine,
  textColor,
}: {
  uri: string;
  durationSeconds: number;
  mine: boolean;
  textColor: string;
}) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loaded, setLoaded] = useState(false);
  const [rateIdx, setRateIdx] = useState(0);
  const owner = useRef<Owner>({ stop: () => undefined }).current;
  owner.stop = () => player.pause();

  const accent = mine ? '#FFFFFF' : BRAND.violet;
  const track = mine ? 'rgba(255,255,255,0.3)' : withAlpha(BRAND.violet, 0.25);

  useEffect(() => {
    if (status.didJustFinish) {
      // 1. Pause the player to stop any loop
      player.pause();
      // 2. Reset the position to the start (0)
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  useEffect(
    () => () => {
      if (activeOwner === owner) activeOwner = null;
    },
    [owner],
  );

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (activeOwner && activeOwner !== owner) activeOwner.stop();
    if (!loaded) {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      } catch {
        // non-fatal
      }
      player.replace({ uri });
      setLoaded(true);
    }
    player.setPlaybackRate(RATES[rateIdx] ?? 1);
    player.play();
    activeOwner = owner;
  };

  const cycleRate = () => {
    const next = (rateIdx + 1) % RATES.length;
    setRateIdx(next);
    player.setPlaybackRate(RATES[next] ?? 1);
  };

  const total = status.duration > 0 ? status.duration : durationSeconds;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  const shown = status.playing || status.currentTime > 0 ? status.currentTime : total;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 210 }}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: mine ? 'rgba(255,255,255,0.22)' : withAlpha(BRAND.violet, 0.14),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={20}
          color={accent}
          style={{ marginLeft: status.playing ? 0 : 2 }}
        />
      </Pressable>

      <View style={{ flex: 1 }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: track, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: accent }} />
        </View>
        <Text style={{ color: textColor, opacity: 0.8, fontSize: 11, marginTop: 4 }}>
          {formatDuration(shown)}
        </Text>
      </View>

      <Pressable
        onPress={cycleRate}
        hitSlop={6}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 10,
          backgroundColor: mine ? 'rgba(255,255,255,0.22)' : withAlpha(BRAND.violet, 0.14),
        }}
      >
        <Text style={{ color: accent, fontWeight: '800', fontSize: 12 }}>
          {RATES[rateIdx]}x
        </Text>
      </Pressable>
    </View>
  );
}