import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

export type UploadResult = {
  url: string;
  publicId: string;
};

/**
 * Upload an in-memory buffer to Cloudinary.
 *
 * @param buffer          File contents from multer memoryStorage
 * @param folder          Cloudinary folder (e.g. "rehobot/profile-photos")
 * @param publicIdPrefix  Optional prefix used in the generated public_id
 * @param resourceType    'image' (default) | 'video' | 'raw' | 'auto'
 *   - 'image' for photos.
 *   - 'video' for audio AND video (Cloudinary stores audio under the
 *     video resource type).
 *   - 'raw' for generic files.
 *   - 'auto' lets Cloudinary detect — slower, less predictable.
 */
export function uploadBuffer(
  buffer: Buffer,
  folder: string,
  publicIdPrefix?: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image',
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    // Only images get the resize/compress transformation.
    const transformation =
      resourceType === 'image'
        ? [
            { width: 1024, height: 1024, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ]
        : undefined;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation,
        public_id: publicIdPrefix
          ? `${publicIdPrefix}_${Date.now()}`
          : undefined,
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function deleteByPublicId(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch {
    // Best-effort.
  }
}