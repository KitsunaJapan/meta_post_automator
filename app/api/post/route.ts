import { NextRequest, NextResponse } from 'next/server';
import { publishPost, MediaItem } from '@/lib/meta';
import { verifyToken } from '../auth/route';

// Node.js Runtimeを明示（fsモジュール使用のため必須）
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const body = await req.json();
    const { items, caption, postType, platform } = body as {
      items: MediaItem[];
      caption: string;
      postType: 'feed' | 'story';
      platform: 'instagram' | 'facebook' | 'both';
    };

    if (!items?.length) return NextResponse.json({ error: 'メディアが必要です' }, { status: 400 });

    const result = await publishPost(items, caption ?? '', postType ?? 'feed', platform ?? 'both');
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error('[/api/post ERROR]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
