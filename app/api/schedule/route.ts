import { NextRequest, NextResponse } from 'next/server';
import { addScheduled } from '@/lib/store';
import { ScheduledPost } from '@/types';
import { randomUUID } from 'crypto';
import { verifyToken } from '../auth/route';

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const { imageUrl, caption, postType, platform, scheduledAt } = await req.json();
    if (!imageUrl || !scheduledAt) return NextResponse.json({ error: '画像URLと投稿日時が必要です' }, { status: 400 });
    const post: ScheduledPost = { id: randomUUID(), imageUrl, caption: caption ?? '', postType: postType ?? 'feed', platform: platform ?? 'both', scheduledAt, status: 'scheduled', createdAt: new Date().toISOString() };
    addScheduled(post);
    return NextResponse.json({ success: true, post });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
