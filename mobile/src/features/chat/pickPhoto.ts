import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { LocalPhoto } from './chatTypes';

/** Pick ONE photo from the gallery, resized to <= 900px wide (group photos). */
export async function pickSinglePhoto(): Promise<LocalPhoto | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];

  const ctx = ImageManipulator.manipulate(a.uri);
  if ((a.width ?? 0) > 900) ctx.resize({ width: 900 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, name: `group_${Date.now()}.jpg`, type: 'image/jpeg' };
}
