import { NextRequest, NextResponse } from 'next/server';
import { publishPost, MediaItem } from '@/lib/meta';
import { verifyToken } from '../auth/route';

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const { items, caption, postType, platform } = await req.json() as {
      items: MediaItem[];
      caption: string;
      postType: 'feed' | 'story';
      platform: 'instagram' | 'facebook' | 'both';
    };
    if (!items?.length) return NextResponse.json({ error: 'メディアが必要です' }, { status: 400 });
    const result = await publishPost(items, caption, postType, platform);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
