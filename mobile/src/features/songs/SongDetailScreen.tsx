import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../theme/ThemeContext';
import { SongDetail } from '../../services/songs';
import {
  saveOffline,
  isOffline,
  removeOffline,
  listOffline,
} from '../../services/offlineSongs';
import {
  playTrack,
  pauseTrack,
  resumeTrack,
  subscribe,
  getSnapshot,
  getCurrentKey,
  SimpleStatus,
} from '../../services/audioPlayer';
import { BRAND, withAlpha, ErrorBanner } from '../auth/Auth_UI';
import GlassBackButton from '../../components/GlassBackButton';
import {
  useSongDetailQuery,
  useFavoriteSongsQuery,
  useToggleFavoriteMutation,
} from './useSongs';

const HEART = '#FF5C7A';
const YT = '#FF0000';

// Escape user content before putting it into the PDF's HTML
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Turn the song title into a safe file name (keeps Amharic / any script)
const safePdfName = (title: string) =>
  title
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'song';

// ---------------------------------------------------------------------------
// PDF lyrics parsing + HTML template
// ---------------------------------------------------------------------------
type LyricBlock = { kind: 'chorus' | 'verse'; lines: string[] };

// "አዝ፦" (Amharic) / "Chorus:" marks the start of a chorus
const CHORUS_RE = /^\s*(አዝ|chorus)(?:\s*[:፦\-–.።]+\s*|\s+|$)/i;
// A line ending with (2x) / (x2) / (3x) closes a chorus that has no blank line after it
const REPEAT_END_RE = /[\(\[]\s*(\d+\s*x|x\s*\d+)\s*[\)\]]\s*$/i;

function parseLyrics(raw: string): LyricBlock[] {
  const blocks: LyricBlock[] = [];
  let cur: LyricBlock | null = null;
  const flush = () => {
    if (cur && cur.lines.length) blocks.push(cur);
    cur = null;
  };

  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = line.trim();

    if (!trimmed) {
      flush();
      continue;
    }

    if (CHORUS_RE.test(trimmed)) {
      flush();
      cur = { kind: 'chorus', lines: [] };
      const rest = trimmed.replace(CHORUS_RE, '').trim();
      if (rest) cur.lines.push(rest);
      if (rest && REPEAT_END_RE.test(rest)) flush();
      continue;
    }

    if (!cur) cur = { kind: 'verse', lines: [] };
    cur.lines.push(trimmed);
    if (cur.kind === 'chorus' && REPEAT_END_RE.test(trimmed)) flush();
  }
  flush();
  return blocks;
}

function buildSongPdfHtml(title: string, lyrics: string): string {
  const C = {
    deep: BRAND.deep,
    lavender: BRAND.lavender,
    gold: BRAND.gold,
    mint: BRAND.mint,
    ink: '#1F2430',
    muted: '#7A8190',
  };

  let verseNo = 0;
  const blocksHtml = parseLyrics(lyrics)
    .map((b) => {
      const body = b.lines.map((l) => `<div class="ln">${escapeHtml(l)}</div>`).join('');
      if (b.kind === 'chorus') {
        return `
          <div class="block chorus">
            <div class="badge"><span class="dot"></span>አዝ</div>
            ${body}
          </div>`;
      }
      verseNo += 1;
      return `
          <div class="block verse">
            <div class="num">${verseNo}</div>
            <div class="vbody">${body}</div>
          </div>`;
    })
    .join('');

  return `
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;600;800&family=Noto+Serif+Ethiopic:wght@500;700&family=Poppins:wght@500;700;800&display=swap" rel="stylesheet" />
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        margin: 0;
        padding: 36px 34px 40px;
        color: ${C.ink};
        font-family: 'Noto Sans Ethiopic', 'Abyssinica SIL', Kefa, 'Nyala', 'Poppins', 'Helvetica Neue', Helvetica, sans-serif;
        background: #FFFFFF;
      }

      /* ---------- Hero ---------- */
      .hero {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        padding: 34px 28px 30px;
        text-align: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, ${C.deep} 0%, ${C.lavender} 100%);
      }
      .hero .orb1 { position: absolute; width: 190px; height: 190px; border-radius: 50%; right: -60px; top: -70px; background: ${withAlpha(C.gold, 0.28)}; }
      .hero .orb2 { position: absolute; width: 150px; height: 150px; border-radius: 50%; left: -55px; bottom: -70px; background: ${withAlpha(C.mint, 0.25)}; }
      .hero .orb3 { position: absolute; width: 70px; height: 70px; border-radius: 50%; left: 38px; top: 26px; background: rgba(255,255,255,0.10); }
      .hero-inner { position: relative; }
      .note {
        width: 54px; height: 54px; border-radius: 18px; margin: 0 auto 14px;
        background: rgba(255,255,255,0.16);
        border: 1.5px solid rgba(255,255,255,0.35);
        display: flex; align-items: center; justify-content: center;
      }
      .overline {
        font-family: 'Poppins', Helvetica, sans-serif;
        font-size: 11px; font-weight: 700; letter-spacing: 4px; text-transform: uppercase;
        color: ${C.gold};
      }
      h1 {
        margin: 10px 0 0;
        font-family: 'Noto Serif Ethiopic', 'Noto Sans Ethiopic', 'Abyssinica SIL', Kefa, 'Poppins', Georgia, serif;
        font-size: 36px; line-height: 1.25; font-weight: 700; letter-spacing: 0.3px;
        color: #FFFFFF;
      }
      .rule { margin: 18px auto 0; width: 92px; height: 4px; border-radius: 4px;
        background: linear-gradient(90deg, ${C.gold}, ${C.mint}); }

      /* ---------- Lyrics ---------- */
      .lyrics { margin-top: 30px; }
      .block { page-break-inside: avoid; break-inside: avoid; margin-bottom: 16px; }
      .ln { font-size: 17px; line-height: 1.85; }

      .verse { display: flex; gap: 14px; align-items: flex-start; padding: 4px 6px 4px 0; }
      .num {
        flex: 0 0 auto; width: 30px; height: 30px; margin-top: 3px; border-radius: 50%;
        background: ${withAlpha(C.lavender, 0.14)}; color: ${C.lavender};
        font-family: 'Poppins', Helvetica, sans-serif; font-size: 13px; font-weight: 800;
        text-align: center; line-height: 30px;
      }
      .vbody { flex: 1; }

      .chorus {
        position: relative;
        padding: 16px 20px 14px 24px;
        border-radius: 20px;
        background: linear-gradient(135deg, ${withAlpha(C.gold, 0.16)}, ${withAlpha(C.lavender, 0.12)});
        border: 1.5px solid ${withAlpha(C.gold, 0.45)};
      }
      .chorus::before {
        content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 6px;
        border-radius: 0 6px 6px 0; background: linear-gradient(180deg, ${C.gold}, ${C.lavender});
      }
      .chorus .ln { font-weight: 800; color: ${C.deep}; }
      .badge {
        display: inline-block; margin-bottom: 6px; padding: 3px 12px; border-radius: 999px;
        background: ${C.deep}; color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 0.5px;
      }
      .badge .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${C.gold}; margin-right: 7px; vertical-align: middle; }

      /* ---------- Footer ---------- */
      .footer { margin-top: 34px; text-align: center; page-break-inside: avoid; }
      .footer .line { height: 1.5px; width: 60%; margin: 0 auto 14px;
        background: linear-gradient(90deg, transparent, ${withAlpha(C.lavender, 0.5)}, transparent); }
      .footer .brand {
        font-family: 'Poppins', Helvetica, sans-serif; font-size: 12px; font-weight: 700;
        letter-spacing: 3px; text-transform: uppercase; color: ${C.deep};
      }
      .footer .brand i { color: ${C.gold}; font-style: normal; margin: 0 8px; }
    </style>
  </head>
  <body>
    <div class="hero">
      <div class="orb1"></div><div class="orb2"></div><div class="orb3"></div>
      <div class="hero-inner">
        <div class="note">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
        </div>
        <div class="overline">Rehobot Choir</div>
        <h1>${escapeHtml(title)}</h1>
        <div class="rule"></div>
      </div>
    </div>

    <div class="lyrics">${blocksHtml}</div>

    <div class="footer">
      <div class="line"></div>
      <div class="brand"><i>♪</i>Rehobot Choir<i>♪</i></div>
    </div>
  </body>
</html>`;
}

export default function SongDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;
  const insets = useSafeAreaInsets();
  const { id } = route.params;

  // --- TanStack Queries ---
  const q = useSongDetailQuery(id);
  const favQ = useFavoriteSongsQuery();
  const toggleFavMut = useToggleFavoriteMutation();

  const item = q.data;
  const firstLoad = q.isPending && q.data === undefined;
  const showingSavedData = q.isError && q.data !== undefined;

  // Derive favorite status from the favorites list cache
  const isFav = favQ.data?.some((f) => f.song.id === id) ?? false;
  const isBusyFav = toggleFavMut.isPending;

  // --- Local UI State ---
  const [savedOffline, setSavedOffline] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(true);
  const [offlineUri, setOfflineUri] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<SimpleStatus>(getSnapshot());
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [lyricsFullscreen, setLyricsFullscreen] = useState(false);

  // --- Copy & Share State ---
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the "Copied" timer when leaving the screen
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // --- Animations ---
  const lyricsEnter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (lyricsOpen) {
      lyricsEnter.setValue(0);
      Animated.timing(lyricsEnter, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [lyricsOpen, lyricsEnter]);

  const fsEnter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (lyricsFullscreen) {
      fsEnter.setValue(0);
      Animated.timing(fsEnter, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [lyricsFullscreen, fsEnter]);

  // --- Player Status Subscription ---
  useEffect(() => {
    const unsub = subscribe(setPlayerStatus);
    setPlayerStatus(getSnapshot());
    return unsub;
  }, []);

  // --- Check Offline Status ---
  useEffect(() => {
    if (!item) return;
    void (async () => {
      const isSaved = await isOffline(item.id);
      setSavedOffline(isSaved);
      if (isSaved) {
        const list = await listOffline();
        setOfflineUri(list.find((x) => x.songId === item.id)?.fileUri ?? null);
      } else {
        setOfflineUri(null);
      }
    })();
  }, [item]);

  // --- Handlers ---
  const onToggleFav = () => {
    if (!item) return;
    toggleFavMut.mutate({ id: item.id, isFav });
  };

  const onToggleOffline = async () => {
    if (!item) return;
    if (!item.audioUrl) {
      Alert.alert(t('songs.noAudio'), t('songs.noAudioBody'));
      return;
    }
    if (savedOffline) {
      setOfflineBusy(true);
      try {
        await removeOffline(item.id);
        setSavedOffline(false);
        setOfflineUri(null);
      } catch (e) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          (e as any)?.message ?? 'Could not remove offline file',
        );
      } finally {
        setOfflineBusy(false);
      }
      return;
    }

    setOfflineBusy(true);
    setDownloadPct(0);
    try {
      const entry = await saveOffline(
        item.id,
        item.title,
        item.audioUrl,
        (pct: number) => setDownloadPct(pct),
      );
      setSavedOffline(true);
      setOfflineUri(entry.fileUri);
    } catch (e) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        (e as any)?.message ?? 'Could not save offline',
      );
    } finally {
      setOfflineBusy(false);
      setDownloadPct(null);
    }
  };

  const onTogglePlay = async () => {
    if (!item) return;
    const isThisTrack = getCurrentKey() === item.id;
    const isPlaying =
      playerStatus.isLoaded && isThisTrack && playerStatus.isPlaying;

    if (isPlaying) {
      await pauseTrack();
      return;
    }
    if (isThisTrack && playerStatus.isLoaded && !playerStatus.isPlaying) {
      await resumeTrack();
      return;
    }

    const uri = offlineUri ?? item.audioUrl;
    if (!uri) {
      Alert.alert(t('songs.noAudio'), t('songs.noAudioBody'));
      return;
    }
    await playTrack({ key: item.id, uri, title: item.title });
  };

  // --- Copy Lyrics ---
  const onCopyLyrics = async () => {
    if (!item?.lyrics) return;
    try {
      await Clipboard.setStringAsync(item.lyrics);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('songs.copyFailed', { defaultValue: 'Could not copy lyrics.' }),
      );
    }
  };

  // --- Share as PDF ---
  const onSharePDF = async () => {
    if (!item?.lyrics) return;
    setPdfLoading(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('songs.sharingUnavailable', {
            defaultValue: 'Sharing is not available on this device.',
          }),
        );
        return;
      }

      const html = buildSongPdfHtml(item.title, item.lyrics);
      const { uri } = await Print.printToFileAsync({ html });

      // Rename the generated file to the song title so it shares as "<song name>.pdf"
      let shareUri = uri;
      try {
        const dest = `${FileSystem.cacheDirectory}${safePdfName(item.title)}.pdf`;
        await FileSystem.deleteAsync(dest, { idempotent: true });
        await FileSystem.moveAsync({ from: uri, to: dest });
        shareUri = dest;
      } catch {
        // fall back to the original temp file if renaming fails
      }

      await Sharing.shareAsync(shareUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: item.title,
      });
    } catch (e) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('songs.pdfFailed', { defaultValue: 'Could not generate PDF.' }),
      );
    } finally {
      setPdfLoading(false);
    }
  };

  // --- Render Checks ---
  if (firstLoad) {
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
        <ErrorBanner message={((q as any).error)?.message ?? 'Error'} />
        <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
          <GlassBackButton onPress={() => navigation.goBack()} size={44} />
        </View>
      </View>
    );
  }

  const isThisPlaying =
    playerStatus.isLoaded &&
    getCurrentKey() === item.id &&
    playerStatus.isPlaying;

  const hasAudio = Boolean(offlineUri || item.audioUrl);
  const downloading = downloadPct !== null;
  const isAnyBusy = isBusyFav || downloading || offlineBusy;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Hero ---------- */}
        <View style={{ backgroundColor: BRAND.teal, 
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: 34,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
          }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: insets.top - 22,
              right: -52,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: withAlpha(BRAND.lime, 0.14),
            }}
          />

          <View style={{ alignSelf: 'flex-end', marginBottom: 12 }}>
            <GlassBackButton onPress={() => navigation.goBack()} size={44} />
          </View>

          <LinearGradient
            colors={[BRAND.lime, BRAND.mint, BRAND.lavender, BRAND.lime]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 132, height: 132, borderRadius: 66, padding: 4, alignSelf: 'center' }}
          >
            <View
              style={{
                flex: 1,
                borderRadius: 62,
                backgroundColor: BRAND.deep,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={item.youtubeUrl ? 'logo-youtube' : 'musical-notes'}
                size={54}
                color={BRAND.gold}
              />
            </View>
          </LinearGradient>

          <Text
            style={[
              typography.h2,
              { color: '#FFFFFF', marginTop: 16, textAlign: 'center', fontWeight: '800' },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.category && (
            <Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'center',
                marginTop: 4,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              {item.category.name}
            </Text>
          )}

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 20,
              justifyContent: 'center',
            }}
          >
            <ActionPill
              icon={isFav ? 'heart' : 'heart-outline'}
              label={
                isFav
                  ? t('songs.favorited', { defaultValue: 'Favorited' })
                  : t('songs.favorite', { defaultValue: 'Favorite' })
              }
              tint={isFav ? '#FFFFFF' : HEART}
              active={isFav}
              bgActive={HEART}
              onPress={onToggleFav}
              disabled={isAnyBusy}
            />

            {downloading ? (
              <DownloadProgressPill pct={downloadPct ?? 0} />
            ) : (
              <ActionPill
                icon={savedOffline ? 'cloud-done' : 'download-outline'}
                label={
                  savedOffline
                    ? t('songs.saved', { defaultValue: 'Saved' })
                    : t('songs.saveOffline', { defaultValue: 'Save offline' })
                }
                tint="#FFFFFF"
                active={savedOffline}
                bgActive="rgba(255,255,255,0.28)"
                onPress={onToggleOffline}
                disabled={isAnyBusy}
              />
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.lg }}>
          {/* ---------- Saved Data Notice ---------- */}
          {showingSavedData && (
            <View style={{ marginBottom: spacing.md }}>
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: withAlpha('#E8A65D', 0.14),
                  borderWidth: 1,
                  borderColor: withAlpha('#E8A65D', 0.4),
                }}
              >
                <Ionicons name="cloud-offline" size={13} color="#E8A65D" />
                <Text style={[typography.caption, { color: '#E8A65D', fontWeight: '800' }]}>
                  {t('home.showingSavedData', { defaultValue: 'Showing saved data' })}
                </Text>
              </View>
            </View>
          )}

          {/* ---------- YouTube ---------- */}
          {item.youtubeUrl && (
            <Pressable
              onPress={() =>
                navigation.navigate('SongVideo', {
                  youtubeUrl: item.youtubeUrl,
                  title: item.title,
                })
              }
              style={{
                borderRadius: 18,
                overflow: 'hidden',
                shadowColor: YT,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
              }}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[YT, '#B3001B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 16,
                  borderRadius: 18,
                }}
              >
                <Ionicons name="logo-youtube" size={22} color="#FFFFFF" />
                <Text style={[typography.button, { color: '#FFFFFF', fontWeight: '800' }]}>
                  {t('songs.watchOnYoutube')}
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* ---------- Audio ---------- */}
          {hasAudio && (
            <Pressable
              onPress={onTogglePlay}
              disabled={isAnyBusy}
              style={{
                marginTop: 14,
                borderRadius: 18,
                overflow: 'hidden',
                shadowColor: colors.primary,
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 5,
                opacity: isAnyBusy ? 0.6 : 1,
              }}
              accessibilityRole="button"
            >
              <View style={{ backgroundColor: colors.primary, 
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderRadius: 18,
                }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.primaryText,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isThisPlaying ? 'pause' : 'play'}
                    size={20}
                    color={colors.primary}
                    style={{ marginLeft: isThisPlaying ? 0 : 2 }}
                  />
                </View>
                <Text style={[typography.button, { color: colors.primaryText, fontWeight: '800' }]}>
                  {isThisPlaying ? t('songs.pause') : t('songs.playAudio')}
                </Text>
              </View>
            </Pressable>
          )}

          {/* ---------- Modern lyrics card ---------- */}
          {item.lyrics && (
            <View
              style={{
                marginTop: spacing.xl,
                borderRadius: 24,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: colors.primary,
                shadowOpacity: 0.18,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 10 },
                elevation: 6,
              }}
            >
              {/* Gradient header strip */}
              <View style={{ backgroundColor: BRAND.teal, paddingHorizontal: 16, paddingVertical: 14, overflow: 'hidden' }}>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: -34,
                    right: -26,
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: withAlpha(BRAND.lavender, 0.16),
                  }}
                />

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Pressable
                    onPress={() => setLyricsOpen((o) => !o)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                    accessibilityRole="button"
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        backgroundColor: BRAND.gold,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="document-text" size={17} color={BRAND.deep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 15,
                          fontWeight: '800',
                          letterSpacing: 0.4,
                        }}
                      >
                        {t('songs.lyrics')}
                      </Text>
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.75)',
                          fontSize: 11,
                          fontWeight: '700',
                          letterSpacing: 0.6,
                          textTransform: 'uppercase',
                        }}
                        numberOfLines={1}
                      >
                        {lyricsOpen
                          ? t('songs.tapToCollapse', { defaultValue: 'Tap to collapse' })
                          : t('songs.tapToExpand', { defaultValue: 'Tap to expand' })}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Fullscreen button */}
                  <Pressable
                    onPress={() => setLyricsFullscreen(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Open fullscreen lyrics"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: 'rgba(255,255,255,0.14)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons name="expand" size={16} color="#FFFFFF" />
                  </Pressable>

                  {/* Inline collapse chevron */}
                  <Pressable
                    onPress={() => setLyricsOpen((o) => !o)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={
                      lyricsOpen
                        ? t('songs.tapToCollapse', { defaultValue: 'Tap to collapse' })
                        : t('songs.tapToExpand', { defaultValue: 'Tap to expand' })
                    }
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: 'rgba(255,255,255,0.14)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons
                      name={lyricsOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#FFFFFF"
                    />
                  </Pressable>
                </View>
              </View>

              {lyricsOpen && (
                <Animated.View
                  style={{
                    opacity: lyricsEnter,
                    transform: [
                      {
                        translateY: lyricsEnter.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <Text
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: 12,
                      fontSize: 68,
                      lineHeight: 80,
                      fontWeight: '800',
                      color: withAlpha(colors.primary, 0.14),
                    }}
                  >
                    “
                  </Text>

                  <ScrollView
                    style={{ maxHeight: 340 }}
                    contentContainerStyle={{
                      paddingHorizontal: 22,
                      paddingTop: 16,
                      paddingBottom: 16,
                    }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                      <LinearGradient
                        colors={[BRAND.lime, BRAND.mint, BRAND.lavender]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={{ width: 4, borderRadius: 2 }}
                      />
                      <Text
                        selectable
                        style={[
                          typography.body,
                          {
                            color: colors.text,
                            lineHeight: 28,
                            fontSize: 16,
                            fontStyle: 'italic',
                            flex: 1,
                          },
                        ]}
                      >
                        {item.lyrics}
                      </Text>
                    </View>
                  </ScrollView>

                  {/* Bottom action row: Copy & Share */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 12,
                      paddingHorizontal: 22,
                      paddingBottom: 18,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: withAlpha(colors.border, 0.5),
                    }}
                  >
                    <Pressable
                      onPress={onCopyLyrics}
                      accessibilityRole="button"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: withAlpha(colors.primary, 0.1),
                      }}
                    >
                      <Ionicons
                        name={copied ? 'checkmark-circle' : 'copy-outline'}
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                        {copied
                          ? t('songs.copied', { defaultValue: 'Copied' })
                          : t('songs.copy', { defaultValue: 'Copy' })}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={onSharePDF}
                      disabled={pdfLoading}
                      accessibilityRole="button"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: withAlpha(colors.accent, 0.1),
                        opacity: pdfLoading ? 0.7 : 1,
                      }}
                    >
                      {pdfLoading ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Ionicons name="share-outline" size={16} color={colors.accent} />
                      )}
                      <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                        {pdfLoading
                          ? '...'
                          : t('songs.sharePdf', { defaultValue: 'Share PDF' })}
                      </Text>
                    </Pressable>
                  </View>
                </Animated.View>
              )}
            </View>
          )}

          {q.isError && q.data === undefined && (
            <View style={{ marginTop: spacing.md }}>
              <ErrorBanner message={((q as any).error)?.message ?? 'Error'} />
            </View>
          )}
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* FULLSCREEN LYRICS MODAL                                   */}
      {/* ========================================================= */}
      {item.lyrics && (
        <Modal
          visible={lyricsFullscreen}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setLyricsFullscreen(false)}
          statusBarTranslucent
        >
          <LinearGradient
            colors={[BRAND.deep, '#0F2A31', '#08161A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
          >
            {/* Decorative glows */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: -120,
                right: -80,
                width: 340,
                height: 340,
                borderRadius: 170,
                backgroundColor: withAlpha(BRAND.lavender, 0.2),
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: -140,
                left: -100,
                width: 380,
                height: 380,
                borderRadius: 190,
                backgroundColor: withAlpha(BRAND.mint, 0.18),
              }}
            />

            {/* Giant decorative quote mark */}
            <Text
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 40,
                left: 24,
                fontSize: 200,
                lineHeight: 220,
                fontWeight: '800',
                color: 'rgba(255,255,255,0.06)',
              }}
            >
              “
            </Text>

            {/* Header */}
            <Animated.View
              style={{
                paddingTop: (insets.top || 0) + 12,
                paddingHorizontal: 20,
                paddingBottom: 16,
                opacity: fsEnter,
                transform: [
                  {
                    translateY: fsEnter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <LinearGradient
                  colors={[BRAND.lime, BRAND.mint]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="musical-notes" size={22} color={BRAND.teal} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                    numberOfLines={1}
                  >
                    {t('songs.lyrics')}
                  </Text>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 18,
                      fontWeight: '800',
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.category && (
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: 12,
                        fontWeight: '600',
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {item.category.name}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() => setLyricsFullscreen(false)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Close fullscreen lyrics"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.28)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Gradient divider */}
              <LinearGradient
                colors={[
                  'transparent',
                  withAlpha(BRAND.gold, 0.55),
                  'transparent',
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 1, marginTop: 14, borderRadius: 1 }}
              />
            </Animated.View>

            {/* Body */}
            <Animated.View
              style={{
                flex: 1,
                opacity: fsEnter,
                transform: [
                  {
                    translateY: fsEnter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: 26,
                  paddingTop: 8,
                  paddingBottom: (insets.bottom || 0) + 110,
                }}
                showsVerticalScrollIndicator={false}
              >
                {/* Left gradient rail + big italic lyrics */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <LinearGradient
                    colors={[BRAND.gold, colors.accent, colors.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={{ width: 4, borderRadius: 2, minHeight: 60 }}
                  />
                  <Text
                    selectable
                    style={{
                      color: '#FFFFFF',
                      fontSize: 20,
                      lineHeight: 36,
                      fontStyle: 'italic',
                      fontWeight: '500',
                      flex: 1,
                      letterSpacing: 0.2,
                    }}
                  >
                    {item.lyrics}
                  </Text>
                </View>

                {/* Footer */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 32,
                  }}
                >
                  <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.55)" />
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: 12,
                      fontWeight: '700',
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                    }}
                  >
                    Rehobot Choir
                  </Text>
                </View>
              </ScrollView>
            </Animated.View>

            {/* Floating action bar: Copy & Share PDF */}
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                flexDirection: 'row',
                gap: 12,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: (insets.bottom || 0) + 14,
                opacity: fsEnter,
              }}
            >
              <Pressable
                onPress={onCopyLyrics}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.28)',
                }}
              >
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={copied ? BRAND.gold : '#FFFFFF'}
                />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}>
                  {copied
                    ? t('songs.copied', { defaultValue: 'Copied' })
                    : t('songs.copy', { defaultValue: 'Copy' })}
                </Text>
              </Pressable>

              <Pressable
                onPress={onSharePDF}
                disabled={pdfLoading}
                accessibilityRole="button"
                style={{
                  flex: 1,
                  borderRadius: 16,
                  overflow: 'hidden',
                  opacity: pdfLoading ? 0.7 : 1,
                }}
              >
                <View style={{ backgroundColor: colors.primary, 
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 16,
                  }}>
                  {pdfLoading ? (
                    <ActivityIndicator size="small" color={colors.primaryText} />
                  ) : (
                    <Ionicons name="share-outline" size={18} color={colors.primaryText} />
                  )}
                  <Text style={{ color: colors.primaryText, fontSize: 13, fontWeight: '800' }}>
                    {pdfLoading
                      ? '...'
                      : t('songs.sharePdf', { defaultValue: 'Share PDF' })}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </LinearGradient>
        </Modal>
      )}
    </View>
  );
}

// ---------- Reusable widgets (unchanged) ----------

function ActionPill({
  icon,
  label,
  tint,
  active,
  bgActive,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tint: string;
  active: boolean;
  bgActive: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.95)}
        onPressOut={() => to(1)}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: active ? bgActive : 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderColor: active ? 'transparent' : 'rgba(255,255,255,0.3)',
          opacity: disabled ? 0.7 : 1,
        }}
      >
        <Ionicons name={icon} size={15} color={tint} />
        <Text style={{ color: active ? '#FFFFFF' : tint, fontWeight: '800', fontSize: 12 }}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function DownloadProgressPill({ pct }: { pct: number }) {
  const pctValue = Math.round(Math.min(1, Math.max(0, pct)) * 100);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(1, Math.max(0, pct)),
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pct, anim]);
  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2.5,
          borderColor: 'rgba(255,255,255,0.32)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2.5,
            borderTopColor: BRAND.gold,
            borderRightColor: BRAND.gold,
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            transform: [{ rotate }],
          }}
        />
      </View>
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>
        {pctValue}%
      </Text>
    </View>
  );
}