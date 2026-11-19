import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useTheme } from '../../../theme/ThemeContext';
import { BRAND, withAlpha } from '../../auth/Auth_UI';
import { useTr } from '../chatStrings';
import { formatDuration, messagePreview } from '../chatUtils';
import type { ChatMessage, Draft, LocalPhoto } from '../chatTypes';

const MAX_PHOTOS = 10;
const MAX_VOICE_MS = 60_000;
const BIG_FILE_BYTES = 9_000_000; // Cloudinary free plan: 10 MB per image

type Picked = {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
};
type Quality = 'compressed' | 'original';

function toPicked(a: ImagePicker.ImagePickerAsset): Picked {
  return {
    uri: a.uri,
    width: a.width,
    height: a.height,
    fileSize: a.fileSize,
    mimeType: a.mimeType,
  };
}

async function prepare(a: Picked, i: number, quality: Quality): Promise<LocalPhoto> {
  const stamp = `${Date.now()}_${i}`;
  const tooBig = (a.fileSize ?? 0) > BIG_FILE_BYTES;

  if (quality === 'original' && !tooBig) {
    const ext = (a.mimeType?.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg');
    return { uri: a.uri, name: `photo_${stamp}.${ext}`, type: a.mimeType ?? 'image/jpeg' };
  }

  const maxW = quality === 'original' ? 3000 : 1600;
  const ctx = ImageManipulator.manipulate(a.uri);
  if ((a.width ?? 0) > maxW) ctx.resize({ width: maxW });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({
    compress: quality === 'original' ? 0.9 : 0.7,
    format: SaveFormat.JPEG,
  });
  return { uri: out.uri, name: `photo_${stamp}.jpg`, type: 'image/jpeg' };
}

export function Composer({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  onSubmitEdit,
}: {
  onSend: (draft: Draft) => void;
  onTyping: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  editing: ChatMessage | null;
  onCancelEdit: () => void;
  onSubmitEdit: (text: string) => void;
}) {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { colors } = theme;

  const [text, setText] = useState('');
  const [assets, setAssets] = useState<Picked[]>([]);
  const [quality, setQuality] = useState<Quality>('compressed');
  const [processing, setProcessing] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  // ---- voice ----
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const [recording, setRecording] = useState(false);
  const finishing = useRef(false);

  // Enter edit mode
  useEffect(() => {
    if (editing) {
      setText(editing.text ?? '');
      setAssets([]);
    }
  }, [editing]);

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(tr('micDenied'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      finishing.current = false;
      setRecording(true);
    } catch {
      Alert.alert(tr('micDenied'));
    }
  };

  const finishRecording = useCallback(
    async (send: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      const ms = recState.durationMillis;
      setRecording(false);
      try {
        await recorder.stop();
      } catch {
        // ignore
      }
      setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      const uri = recorder.uri;
      if (!send || !uri) return;
      const sec = Math.round(ms / 1000);
      if (sec < 1) {
        Alert.alert(tr('voiceTooShort'));
        return;
      }
      onSend({
        text: '',
        replyToId: replyTo?.id ?? null,
        photos: [],
        voice: {
          uri,
          name: `voice_${Date.now()}.m4a`,
          type: 'audio/m4a',
          durationSeconds: Math.min(60, sec),
        },
      });
    },
    [recorder, recState.durationMillis, onSend, replyTo, tr],
  );

  // Auto-stop at 60 s (SRS 19.11)
  useEffect(() => {
    if (recording && recState.durationMillis >= MAX_VOICE_MS - 500) {
      void finishRecording(true);
    }
  }, [recording, recState.durationMillis, finishRecording]);

  // ---- photos ----
  const pickFromGallery = async () => {
    setAttachOpen(false);
    const remaining = MAX_PHOTOS - assets.length;
    if (remaining <= 0) {
      Alert.alert(tr('tooManyPhotos'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (res.canceled) return;
    setAssets((prev) => [...prev, ...res.assets.map(toPicked)].slice(0, MAX_PHOTOS));
  };

  const pickFromCamera = async () => {
    setAttachOpen(false);
    if (assets.length >= MAX_PHOTOS) {
      Alert.alert(tr('tooManyPhotos'));
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled) return;
    setAssets((prev) => [...prev, ...res.assets.map(toPicked)].slice(0, MAX_PHOTOS));
  };

  // ---- send ----
  const hasContent = text.trim().length > 0 || assets.length > 0;

  const send = async () => {
    if (processing) return;
    const t = text.trim();

    if (editing) {
      if (!t && editing.type === 'TEXT') return;
      onSubmitEdit(t);
      setText('');
      return;
    }
    if (!t && assets.length === 0) return;

    setProcessing(true);
    try {
      // Check size before preparing
      const bigFiles = assets.filter((a) => (a.fileSize ?? 0) > BIG_FILE_BYTES);
      if (quality === 'original' && bigFiles.length > 0) {
        Alert.alert(
          tr('fileTooLarge'),
          'Some photos are too large to send in original quality. Please use the Compressed option.'
        );
        setProcessing(false);
        return;
      }

      const photos = await Promise.all(assets.map((a, i) => prepare(a, i, quality)));
      onSend({ text: t, replyToId: replyTo?.id ?? null, photos, voice: null });
      setText('');
      setAssets([]);
    } catch {
      Alert.alert(tr('uploadFailed'));
    } finally {
      setProcessing(false);
    }
  };

  const cancelEdit = () => {
    setText('');
    onCancelEdit();
  };

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------

  const banner = editing ? (
    <View style={bannerStyle(colors.border)}>
      <Ionicons name="pencil" size={18} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>{tr('editing')}</Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>
          {messagePreview(editing, tr)}
        </Text>
      </View>
      <Pressable onPress={cancelEdit} hitSlop={10}>
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  ) : replyTo ? (
    <View style={bannerStyle(colors.border)}>
      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.accent }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
          {tr('replyingTo', { name: replyTo.sender.fullName })}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 13 }}>
          {messagePreview(replyTo, tr)}
        </Text>
      </View>
      <Pressable onPress={onCancelReply} hitSlop={10}>
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  ) : null;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {banner}

      {assets.length > 0 && !editing ? (
        <View style={{ paddingTop: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
            {assets.map((a, i) => (
              <View key={`${a.uri}_${i}`}>
                <Image source={{ uri: a.uri }} style={{ width: 66, height: 66, borderRadius: 14 }} />
                <Pressable
                  onPress={() => setAssets((p) => p.filter((_, idx) => idx !== i))}
                  hitSlop={6}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#000000AA',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
            {(['compressed', 'original'] as Quality[]).map((q) => (
              <Pressable
                key={q}
                onPress={() => setQuality(q)}
                style={{
                  paddingHorizontal: 14,
                  minHeight: 32,
                  justifyContent: 'center',
                  borderRadius: 16,
                  backgroundColor: quality === q ? colors.primary : withAlpha(colors.accent, 0.14),
                }}
              >
                <Text style={{ color: quality === q ? colors.primaryText : colors.accent, fontWeight: '800', fontSize: 12 }}>
                  {tr(q)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {recording ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingTop: 10 }}>
          <Pressable
            onPress={() => finishRecording(false)}
            hitSlop={10}
            style={roundBtn(withAlpha(colors.error, 0.14))}
          >
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error }} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
              {formatDuration(recState.durationMillis / 1000)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{tr('recording')}</Text>
          </View>
          <Pressable onPress={() => finishRecording(true)} style={roundBtn(colors.primary)}>
            <Ionicons name="send" size={19} color={colors.primaryText} />
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8 }}>
          {!editing ? (
            <Pressable onPress={() => setAttachOpen(true)} hitSlop={6} style={roundBtn(withAlpha(colors.accent, 0.16))}>
              <Ionicons name="add" size={26} color={colors.accent} />
            </Pressable>
          ) : null}

          <View
            style={{
              flex: 1,
              minHeight: 46,
              maxHeight: 130,
              borderRadius: 24,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (v.length > 0 && !editing) onTyping();
              }}
              placeholder={tr('typeMessage')}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={4000}
              style={{ color: colors.text, fontSize: 16, paddingVertical: 10, maxHeight: 120 }}
            />
          </View>

          {hasContent || editing ? (
            <Pressable onPress={send} disabled={processing} style={{ opacity: processing ? 0.6 : 1 }}>
              <View style={[roundBtnStyle, { backgroundColor: colors.primary }]}>
                {processing ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Ionicons name={editing ? 'checkmark' : 'send'} size={20} color={colors.primaryText} />
                )}
              </View>
            </Pressable>
          ) : (
            <Pressable onPress={startRecording}>
              <View style={[roundBtnStyle, { backgroundColor: colors.primary }]}>
                <Ionicons name="mic" size={22} color={colors.primaryText} />
              </View>
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => setAttachOpen(false)}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 22,
              paddingBottom: Math.max(insets.bottom, 18),
              flexDirection: 'row',
              justifyContent: 'space-evenly',
            }}
          >
            {[
              { key: 'g', icon: 'images' as const, label: tr('gallery'), onPress: pickFromGallery, c: BRAND.teal, fg: BRAND.lime },
              { key: 'c', icon: 'camera' as const, label: tr('camera'), onPress: pickFromCamera, c: BRAND.lavender, fg: BRAND.teal },
            ].map((o) => (
              <Pressable key={o.key} onPress={o.onPress} style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 66, height: 66, borderRadius: 22, backgroundColor: o.c, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={o.icon} size={28} color={o.fg} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const roundBtnStyle = {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

function roundBtn(bg: string) {
  return { ...roundBtnStyle, backgroundColor: bg };
}

function bannerStyle(border: string) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginHorizontal: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: 'rgba(123,95,199,0.08)',
  };
}