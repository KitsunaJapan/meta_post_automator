import { NextRequest, NextResponse } from 'next/server';
import { postInstagramFeed, postInstagramStory, postFacebookFeed, postFacebookStory } from '@/lib/meta';
import { verifyToken } from '../auth/route';

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const { imageUrl, caption, postType, platform } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: '画像URLが必要です' }, { status: 400 });
    const result: { instagramId?: string; facebookId?: string } = {};
    if (platform === 'instagram' || platform === 'both') {
      result.instagramId = postType === 'story' ? await postInstagramStory(imageUrl) : await postInstagramFeed(imageUrl, caption ?? '');
    }
    if (platform === 'facebook' || platform === 'both') {
      result.facebookId = postType === 'story' ? await postFacebookStory(imageUrl) : await postFacebookFeed(imageUrl, caption ?? '');
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
