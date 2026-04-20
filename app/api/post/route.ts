import { NextRequest, NextResponse } from 'next/server';
import {
  postInstagramFeed,
  postInstagramStory,
  postFacebookFeed,
  postFacebookStory,
} from '@/lib/meta';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, caption, postType, platform } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({ error: '画像URLが必要です' }, { status: 400 });
    }

    const result: { instagramId?: string; facebookId?: string } = {};

    if (platform === 'instagram' || platform === 'both') {
      if (postType === 'story') {
        result.instagramId = await postInstagramStory(imageUrl);
      } else {
        result.instagramId = await postInstagramFeed(imageUrl, caption ?? '');
      }
    }

    if (platform === 'facebook' || platform === 'both') {
      if (postType === 'story') {
        result.facebookId = await postFacebookStory(imageUrl);
      } else {
        result.facebookId = await postFacebookFeed(imageUrl, caption ?? '');
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/post]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
