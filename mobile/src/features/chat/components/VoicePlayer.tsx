import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../../../theme/ThemeContext';
import { withAlpha } from '../../auth/Auth_UI';
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
  const { theme } = useTheme();
  const { colors } = theme;
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [loaded, setLoaded] = useState(false);
  const [rateIdx, setRateIdx] = useState(0);
  const owner = useRef<Owner>({ stop: () => undefined }).current;
  owner.stop = () => player.pause();

  // My bubbles are lime (dark mode) or teal (light mode): use the matching text color.
  const accent = mine ? colors.primaryText : colors.accent;
  const track = mine ? withAlpha(colors.primaryText, 0.25) : withAlpha(colors.accent, 0.25);
  const chipBg = mine ? withAlpha(colors.primaryText, 0.16) : withAlpha(colors.accent, 0.14);

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
        accessibilityRole="button"
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: chipBg,
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
        <View style={{ height: 5, borderRadius: 3, backgroundColor: track, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 5, backgroundColor: accent }} />
        </View>
        <Text style={{ color: textColor, opacity: 0.8, fontSize: 11, marginTop: 4 }}>
          {formatDuration(shown)}
        </Text>
      </View>

      <Pressable
        onPress={cycleRate}
        hitSlop={6}
        accessibilityRole="button"
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 12,
          backgroundColor: chipBg,
        }}
      >
        <Text style={{ color: accent, fontWeight: '800', fontSize: 12 }}>
          {RATES[rateIdx]}x
        </Text>
      </Pressable>
    </View>
  );
}