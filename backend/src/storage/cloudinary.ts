import { randomBytes } from 'crypto';
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

export type UploadOptions = {
  /**
   * Skip the 1024px / auto-quality transformation (images only).
   * Chat photos use this so "Original" really is original (SRS 19.10).
   * Backwards compatible: existing callers keep the old behaviour.
   */
  keepOriginal?: boolean;
};

/**
 * Upload an in-memory buffer to Cloudinary.
 *
 * @param resourceType 'image' (default) | 'video' | 'raw' | 'auto'
 *   'video' is also used for audio (Cloudinary stores audio under video).
 */
export function uploadBuffer(
  buffer: Buffer,
  folder: string,
  publicIdPrefix?: string,
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image',
  options: UploadOptions = {},
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const transformation =
      resourceType === 'image' && !options.keepOriginal
        ? [
            { width: 1024, height: 1024, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' },
          ]
        : undefined;

    // Random suffix: parallel uploads in the same millisecond must not collide.
    const suffix = `${Date.now()}_${randomBytes(4).toString('hex')}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation,
        public_id: publicIdPrefix ? `${publicIdPrefix}_${suffix}` : undefined,
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