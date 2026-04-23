import { NextRequest, NextResponse } from 'next/server';
import { addScheduled } from '@/lib/store';
import { ScheduledPost } from '@/types';
import { randomUUID } from 'crypto';
import { verifyToken } from '../auth/route';
import { MediaItem } from '@/lib/meta';

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const { items, caption, postType, platform, scheduledAt } = await req.json() as {
      items: MediaItem[];
      caption: string;
      postType: 'feed' | 'story';
      platform: 'instagram' | 'facebook' | 'both';
      scheduledAt: string;
    };
    if (!items?.length || !scheduledAt) return NextResponse.json({ error: 'メディアと投稿日時が必要です' }, { status: 400 });
    const post: ScheduledPost = {
      id: randomUUID(),
      // 後方互換のため先頭画像URLをimageUrlに入れる
      imageUrl: items[0].url,
      items,
      caption: caption ?? '',
      postType: postType ?? 'feed',
      platform: platform ?? 'both',
      scheduledAt,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    addScheduled(post);
    return NextResponse.json({ success: true, post });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
