export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../auth/route';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/mov'];
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: '画像（JPEG/PNG/WebP）または動画（MP4/MOV）のみ対応しています' }, { status: 400 });
    }

    const maxMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (file.size > maxMB * 1024 * 1024) {
      return NextResponse.json({ error: `ファイルサイズは ${maxMB}MB 以下にしてください` }, { status: 400 });
    }

    const ext = file.name.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg');
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, Buffer.from(await file.arrayBuffer()));

    const host = req.headers.get('host') ?? 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    return NextResponse.json({
      success: true,
      url: `${protocol}://${host}/uploads/${filename}`,
      filename,
      mediaType: isVideo ? 'video' : 'image',
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
