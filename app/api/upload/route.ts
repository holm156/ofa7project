import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { Buffer } from "buffer";
import AdmZip from 'adm-zip';
import { createExtractorFromData } from 'node-unrar-js';
import process from "process";
import sharp from 'sharp';
import { deleteObjectFromWasabi, isWasabiConfigured, resolveWasabiKeyFromUrl, uploadBufferToWasabi, getWasabiConfig } from '@/lib/wasabi';

// WebP has a hard pixel limit of 16383x16383 — fall back to PNG for oversized images
const WEBP_MAX_DIMENSION = 16383;

async function convertImage(input: Buffer | Uint8Array, quality = 80): Promise<{ buffer: Buffer; ext: string }> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const meta = await sharp(buf, { limitInputPixels: false }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  // If within WebP limits → use WebP (smaller file size)
  if (w <= WEBP_MAX_DIMENSION && h <= WEBP_MAX_DIMENSION) {
    const buffer = await sharp(buf, { limitInputPixels: false }).webp({ quality }).toBuffer();
    return { buffer, ext: 'webp' };
  }

  // Otherwise → fall back to PNG (lossless, no resize, no dimension limit)
  const buffer = await sharp(buf, { limitInputPixels: false }).png({ compressionLevel: 6 }).toBuffer();
  return { buffer, ext: 'png' };
}

const getContentTypeByExt = (ext: string): string => {
  switch (ext.toLowerCase()) {
    case 'webp':
      return 'image/webp';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    const folder = data.get('folder') as string || 'uploads';

    // Allow admins/mods to upload anywhere, but normal users can only upload to avatars
    // @ts-ignore
    if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator' && folder !== 'avatars')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // 2. Validate File Type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    const validArchiveTypes = ['application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/vnd.rar'];

    if (!validImageTypes.includes(file.type) && !validArchiveTypes.includes(file.type) && !file.name.endsWith('.zip') && !file.name.endsWith('.rar')) {
      return NextResponse.json({ error: 'Invalid file type. Images or ZIP/RAR archives only.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const wasabiConfigured = isWasabiConfigured();
    // Decide storage destination based on folder name (Hybrid Storage)
    // Only backgrounds, chapters, and covers go to Wasabi. Others (avatars, collections, etc.) stay on host.
    const wasabiFolders = ['backgrounds', 'chapters', 'covers'];
    const isWasabiTarget = wasabiFolders.some(f => folder.toLowerCase().includes(f));
    const useWasabi = wasabiConfigured && isWasabiTarget;
    // Define path: public/{folder} (local fallback)
    const publicDir = path.join(process.cwd(), 'public');
    const uploadDir = path.join(publicDir, folder);

    console.log(`[UPLOAD] Target Directory: ${uploadDir}`);
    console.log(`[UPLOAD] Process CWD: ${process.cwd()}`);

    // Create directory if not exists
    if (!useWasabi) {
      try {
        if (!fs.existsSync(uploadDir)) {
          console.log(`[UPLOAD] Creating directory: ${uploadDir}`);
          await mkdir(uploadDir, { recursive: true });
        }
      } catch (e: any) {
        if (e.code !== 'EEXIST') {
          console.error("Directory creation error:", e);
          return NextResponse.json({ success: false, error: `Failed to create directory: ${e.message}` }, { status: 500 });
        }
      }
    }

    const isZip = file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.endsWith('.zip');
    const isRar = file.type === 'application/x-rar-compressed' || file.type === 'application/vnd.rar' || file.name.endsWith('.rar');

    // For RAR, we might need a library, but let's assume we use AdmZip for zip first
    if (isZip) {
      try {
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        const uploadedUrls: string[] = [];

        // Sort entries naturally (e.g., to keep chapters in order like 1.jpg, 2.jpg, ... 10.jpg)
        const sortedEntries = zipEntries.sort((a, b) => {
          return a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: 'base' });
        });

        for (const zipEntry of sortedEntries) {
          if (zipEntry.isDirectory) continue;

          const ext = path.extname(zipEntry.entryName).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
            // Extract just the filename if it's in a folder inside the zip
            const originalName = path.basename(zipEntry.entryName);
            const safeName = path.parse(originalName).name.replace(/[^a-zA-Z0-9.-]/g, '_');

            // تحويل الصورة — WebP إذا كانت الأبعاد في الحدود، PNG للصور الكبيرة جداً
            const { buffer: imgBuffer, ext } = await convertImage(zipEntry.getData());
            const filename = `${Date.now()}-${safeName}.${ext}`;
            if (useWasabi) {
              const objectKey = `${folder}/${filename}`;
              const uploadedUrl = await uploadBufferToWasabi(objectKey, imgBuffer, getContentTypeByExt(ext));
              uploadedUrls.push(uploadedUrl);
            } else {
              const filepath = path.join(uploadDir, filename);
              await writeFile(filepath, imgBuffer);
              uploadedUrls.push(`/api/${folder}/${filename}`);
            }
          }
        }

        if (uploadedUrls.length === 0) {
          return NextResponse.json({ success: false, error: 'No valid images found in the archive' }, { status: 400 });
        }

        return NextResponse.json({ urls: uploadedUrls });

      } catch (zipError: any) {
        console.error("ZIP Extraction Error:", zipError);
        return NextResponse.json({ success: false, error: 'Failed to extract ZIP' }, { status: 500 });
      }
    } else if (isRar) {
      // Handle RAR files using node-unrar-js
      try {
        // Unrar processes Uint8Array
        const uint8Array = new Uint8Array(buffer);
        const extractor = await createExtractorFromData({ data: uint8Array.buffer });

        const list = extractor.getFileList();
        const filesToExtract = Array.from(list.fileHeaders).filter((f: any) => !f.flags.directory).map((f: any) => f.name);
        const extractedFilesObj = extractor.extract({ files: filesToExtract });
        const extractedFiles = Array.from(extractedFilesObj.files);

        const uploadedUrls: string[] = [];

        // Sort entries naturally
        const sortedEntries = extractedFiles.sort((a: any, b: any) => {
          return a.fileHeader.name.localeCompare(b.fileHeader.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        for (const { fileHeader, extraction } of sortedEntries) {
          if (fileHeader.flags.directory) continue;

          const ext = path.extname(fileHeader.name).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
            if (extraction && extraction.length > 0) {
              const originalName = path.basename(fileHeader.name);
              const safeName = path.parse(originalName).name.replace(/[^a-zA-Z0-9.-]/g, '_');

              // تحويل الصورة — WebP إذا كانت الأبعاد في الحدود، PNG للصور الكبيرة جداً
              const { buffer: imgBuffer, ext } = await convertImage(Buffer.from(extraction));
              const filename = `${Date.now()}-${safeName}.${ext}`;
              if (useWasabi) {
                const objectKey = `${folder}/${filename}`;
                const uploadedUrl = await uploadBufferToWasabi(objectKey, imgBuffer, getContentTypeByExt(ext));
                uploadedUrls.push(uploadedUrl);
              } else {
                const filepath = path.join(uploadDir, filename);
                await writeFile(filepath, imgBuffer);
                uploadedUrls.push(`/api/${folder}/${filename}`);
              }
            }
          }
        }

        if (uploadedUrls.length === 0) {
          return NextResponse.json({ success: false, error: 'No valid images found in the archive' }, { status: 400 });
        }

        return NextResponse.json({ urls: uploadedUrls });

      } catch (rarError: any) {
        console.error("RAR Extraction Error:", rarError);
        return NextResponse.json({ success: false, error: 'Failed to extract RAR' }, { status: 500 });
      }
    } else {
      // Single Image Upload
      const safeName = path.parse(file.name).name.replace(/[^a-zA-Z0-9.-]/g, '_');

      // تحويل الصورة — WebP إذا كانت الأبعاد في الحدود، PNG للصور الكبيرة جداً
      const { buffer: imgBuffer, ext } = await convertImage(buffer);
      const filename = `${Date.now()}-${safeName}.${ext}`;
      let publicUrl = `/api/${folder}/${filename}`;
      if (useWasabi) {
        const objectKey = `${folder}/${filename}`;
        publicUrl = await uploadBufferToWasabi(objectKey, imgBuffer, getContentTypeByExt(ext));
      } else {
        const filepath = path.join(uploadDir, filename);
        console.log(`[UPLOAD] Writing file to: ${filepath}`);
        await writeFile(filepath, imgBuffer);
        console.log(`[UPLOAD] Successfully wrote: ${filename}`);
      }
      // Return both 'url' for backward compatibility and 'urls' array for the new unified approach
      return NextResponse.json({ url: publicUrl, urls: [publicUrl] });
    }

  } catch (e: any) {

    console.error("Upload Error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const wasabiConfig = isWasabiConfigured() ? getWasabiConfig() : null;
    const isWasabiUrl = wasabiConfig && url.startsWith(wasabiConfig.publicBaseUrl);

    if (isWasabiUrl) {
      const key = resolveWasabiKeyFromUrl(url);
      if (!key) {
        return NextResponse.json({ error: 'Invalid Wasabi URL' }, { status: 400 });
      }
      // Allow admins/mods to delete anywhere, but normal users can only delete from avatars
      // @ts-ignore
      if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator' && !key.startsWith('avatars/'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      await deleteObjectFromWasabi(key);
      return NextResponse.json({ success: true });
    } else {
      // Allow admins/mods to delete anywhere, but normal users can only delete from avatars
      // @ts-ignore
      if (!session || (session.user?.role !== 'admin' && session.user?.role !== 'moderator' && !url?.startsWith('/avatars/'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (!url.startsWith('/')) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }
      // Security: Only allow deleting files within public directory and prevent path traversal
      const normalizedUrl = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
      const filepath = path.join(process.cwd(), 'public', normalizedUrl);

      // Verify it's inside the public folder
      const publicDir = path.join(process.cwd(), 'public');
      if (!filepath.startsWith(publicDir)) {
        return NextResponse.json({ error: 'Forbidden path' }, { status: 403 });
      }

      try {
        await unlink(filepath);
        return NextResponse.json({ success: true });
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          return NextResponse.json({ success: true, message: 'File already gone' });
        }
        throw e;
      }
    }

  } catch (e: any) {
    console.error("Delete Error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}