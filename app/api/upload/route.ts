import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(req: NextRequest) {
  try {
    // アップロードディレクトリを確保
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    // バリデーション: ファイルタイプ
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'JPEG / PNG / WebP / GIF のみ対応しています' },
        { status: 400 }
      );
    }

    // バリデーション: ファイルサイズ
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `ファイルサイズは ${MAX_SIZE_MB}MB 以下にしてください` },
        { status: 400 }
      );
    }

    // ユニークなファイル名を生成
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // ファイルを保存
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // 公開URLを構築（Next.js の public/ ディレクトリは静的配信される）
    const host = req.headers.get('host') ?? 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const publicUrl = `${protocol}://${host}/uploads/${filename}`;

    return NextResponse.json({ success: true, url: publicUrl, filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/upload]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
