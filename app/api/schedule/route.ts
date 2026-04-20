import { NextRequest, NextResponse } from 'next/server';
import { addScheduled } from '@/lib/store';
import { ScheduledPost } from '@/types';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, caption, postType, platform, scheduledAt } = body;

    if (!imageUrl || !scheduledAt) {
      return NextResponse.json(
        { error: '画像URLと投稿日時が必要です' },
        { status: 400 }
      );
    }

    const post: ScheduledPost = {
      id: randomUUID(),
      imageUrl,
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
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
