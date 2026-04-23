import { loadSettings } from '@/app/api/settings/route';

const BASE = 'https://graph.facebook.com/v19.0';

function cfg() {
  const s = loadSettings();
  if (!s.facebookPageAccessToken || !s.facebookPageId || !s.instagramBusinessAccountId) {
    throw new Error('Meta APIの設定が未完了です。設定画面でアクセストークン等を入力してください。');
  }
  return { token: s.facebookPageAccessToken, pageId: s.facebookPageId, igId: s.instagramBusinessAccountId };
}

async function post(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Instagram ────────────────────────────────────────────────

/** 単枚画像フィード */
async function igSingleImage(imageUrl: string, caption: string, token: string, igId: string) {
  const c = await post(`${BASE}/${igId}/media`, { image_url: imageUrl, caption, access_token: token });
  if (!c.id) throw new Error(`IG container error: ${JSON.stringify(c)}`);
  const p = await post(`${BASE}/${igId}/media_publish`, { creation_id: c.id, access_token: token });
  if (!p.id) throw new Error(`IG publish error: ${JSON.stringify(p)}`);
  return p.id as string;
}

/** カルーセル（複数画像、最大10枚） */
async function igCarousel(imageUrls: string[], caption: string, token: string, igId: string) {
  // Step1: 各画像のコンテナを作成
  const childIds: string[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const c = await post(`${BASE}/${igId}/media`, { image_url: url, is_carousel_item: true, access_token: token });
    if (!c.id) throw new Error(`IG carousel item error: ${JSON.stringify(c)}`);
    childIds.push(c.id);
  }
  // Step2: カルーセルコンテナを作成
  const carousel = await post(`${BASE}/${igId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token,
  });
  if (!carousel.id) throw new Error(`IG carousel container error: ${JSON.stringify(carousel)}`);
  // Step3: 公開
  const p = await post(`${BASE}/${igId}/media_publish`, { creation_id: carousel.id, access_token: token });
  if (!p.id) throw new Error(`IG carousel publish error: ${JSON.stringify(p)}`);
  return p.id as string;
}

/** 動画リール */
async function igVideo(videoUrl: string, caption: string, token: string, igId: string) {
  const c = await post(`${BASE}/${igId}/media`, {
    video_url: videoUrl,
    media_type: 'REELS',
    caption,
    access_token: token,
  });
  if (!c.id) throw new Error(`IG video container error: ${JSON.stringify(c)}`);
  // 動画処理が完了するまでポーリング（最大30秒）
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await fetch(`${BASE}/${c.id}?fields=status_code&access_token=${token}`).then(r => r.json());
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error(`IG video processing error: ${JSON.stringify(status)}`);
  }
  const p = await post(`${BASE}/${igId}/media_publish`, { creation_id: c.id, access_token: token });
  if (!p.id) throw new Error(`IG video publish error: ${JSON.stringify(p)}`);
  return p.id as string;
}

/** ストーリーズ（画像） */
async function igStory(imageUrl: string, token: string, igId: string) {
  const c = await post(`${BASE}/${igId}/media`, { image_url: imageUrl, media_type: 'IMAGE', is_stories: true, access_token: token });
  if (!c.id) throw new Error(`IG story container error: ${JSON.stringify(c)}`);
  const p = await post(`${BASE}/${igId}/media_publish`, { creation_id: c.id, access_token: token });
  if (!p.id) throw new Error(`IG story publish error: ${JSON.stringify(p)}`);
  return p.id as string;
}

// ─── Facebook ─────────────────────────────────────────────────

/** Facebookフィード（画像1枚 or 複数） */
async function fbImages(imageUrls: string[], caption: string, token: string, pageId: string) {
  if (imageUrls.length === 1) {
    // 単枚
    const d = await post(`${BASE}/${pageId}/photos`, { url: imageUrls[0], caption, access_token: token });
    if (!d.id) throw new Error(`FB photo error: ${JSON.stringify(d)}`);
    return d.id as string;
  }
  // 複数: 各画像をunpublishedでアップして1投稿にまとめる
  const attached: { media_fbid: string }[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const d = await post(`${BASE}/${pageId}/photos`, { url, published: false, access_token: token });
    if (!d.id) throw new Error(`FB multi-photo error: ${JSON.stringify(d)}`);
    attached.push({ media_fbid: d.id });
  }
  const feed = await post(`${BASE}/${pageId}/feed`, {
    message: caption,
    attached_media: attached,
    access_token: token,
  });
  if (!feed.id) throw new Error(`FB feed error: ${JSON.stringify(feed)}`);
  return feed.id as string;
}

/** Facebook動画 */
async function fbVideo(videoUrl: string, caption: string, token: string, pageId: string) {
  const d = await post(`${BASE}/${pageId}/videos`, { file_url: videoUrl, description: caption, access_token: token });
  if (!d.id) throw new Error(`FB video error: ${JSON.stringify(d)}`);
  return d.id as string;
}

/** Facebookストーリーズ */
async function fbStory(imageUrl: string, token: string, pageId: string) {
  const u = await post(`${BASE}/${pageId}/photos`, { url: imageUrl, published: false, access_token: token });
  if (!u.id) throw new Error(`FB story upload error: ${JSON.stringify(u)}`);
  const s = await post(`${BASE}/${pageId}/photo_stories`, { photo_id: u.id, access_token: token });
  if (!s.success) throw new Error(`FB story publish error: ${JSON.stringify(s)}`);
  return u.id as string;
}

// ─── Public API ───────────────────────────────────────────────

export interface MediaItem {
  url: string;
  mediaType: 'image' | 'video';
}

export async function publishPost(items: MediaItem[], caption: string, postType: 'feed' | 'story', platform: 'instagram' | 'facebook' | 'both') {
  const { token, pageId, igId } = cfg();
  const result: { instagramId?: string; facebookId?: string } = {};

  const images = items.filter(i => i.mediaType === 'image').map(i => i.url);
  const video = items.find(i => i.mediaType === 'video');

  if (platform === 'instagram' || platform === 'both') {
    if (postType === 'story') {
      result.instagramId = await igStory(images[0] ?? video!.url, token, igId);
    } else if (video) {
      result.instagramId = await igVideo(video.url, caption, token, igId);
    } else if (images.length > 1) {
      result.instagramId = await igCarousel(images, caption, token, igId);
    } else {
      result.instagramId = await igSingleImage(images[0], caption, token, igId);
    }
  }

  if (platform === 'facebook' || platform === 'both') {
    if (postType === 'story') {
      result.facebookId = await fbStory(images[0] ?? video!.url, token, pageId);
    } else if (video) {
      result.facebookId = await fbVideo(video.url, caption, token, pageId);
    } else {
      result.facebookId = await fbImages(images, caption, token, pageId);
    }
  }

  return result;
}
