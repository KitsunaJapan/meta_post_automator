import { loadSettings } from '@/app/api/settings/route';

const BASE = 'https://graph.facebook.com/v19.0';

function cfg() {
  const s = loadSettings();
  if (!s.facebookPageAccessToken || !s.facebookPageId || !s.instagramBusinessAccountId) {
    throw new Error('Meta APIの設定が未完了です。⚙設定タブでアクセストークン・Page ID・Instagram IDを入力してください。');
  }
  return { token: s.facebookPageAccessToken, pageId: s.facebookPageId, igId: s.instagramBusinessAccountId };
}

// Meta APIエラーを分かりやすいメッセージで投げるヘルパー
async function metaPost(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data?.error) {
    const e = data.error;
    throw new Error(`Meta API Error ${e.code ?? ''}${e.error_subcode ? `(${e.error_subcode})` : ''}: ${e.message ?? JSON.stringify(e)}`);
  }
  return data;
}

async function metaGet(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (data?.error) {
    const e = data.error;
    throw new Error(`Meta API Error ${e.code ?? ''}: ${e.message ?? JSON.stringify(e)}`);
  }
  return data;
}

// ─── Instagram ────────────────────────────────────────────────

async function igSingleImage(imageUrl: string, caption: string, token: string, igId: string) {
  const c = await metaPost(`${BASE}/${igId}/media`, { image_url: imageUrl, caption, access_token: token });
  if (!c.id) throw new Error(`IGコンテナ作成失敗: ${JSON.stringify(c)}`);
  const p = await metaPost(`${BASE}/${igId}/media_publish`, { creation_id: c.id, access_token: token });
  if (!p.id) throw new Error(`IG公開失敗: ${JSON.stringify(p)}`);
  return p.id as string;
}

async function igCarousel(imageUrls: string[], caption: string, token: string, igId: string) {
  const childIds: string[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const c = await metaPost(`${BASE}/${igId}/media`, { image_url: url, is_carousel_item: true, access_token: token });
    if (!c.id) throw new Error(`IGカルーセルアイテム作成失敗: ${JSON.stringify(c)}`);
    childIds.push(c.id);
  }
  const carousel = await metaPost(`${BASE}/${igId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token,
  });
  if (!carousel.id) throw new Error(`IGカルーセルコンテナ作成失敗: ${JSON.stringify(carousel)}`);
  const p = await metaPost(`${BASE}/${igId}/media_publish`, { creation_id: carousel.id, access_token: token });
  if (!p.id) throw new Error(`IGカルーセル公開失敗: ${JSON.stringify(p)}`);
  return p.id as string;
}

async function igVideo(videoUrl: string, caption: string, token: string, igId: string) {
  const c = await metaPost(`${BASE}/${igId}/media`, {
    video_url: videoUrl,
    media_type: 'REELS',
    caption,
    access_token: token,
  });
  if (!c.id) throw new Error(`IGリールコンテナ作成失敗: ${JSON.stringify(c)}`);
  // 動画処理完了を待つ（最大60秒）
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await metaGet(`${BASE}/${c.id}?fields=status_code&access_token=${token}`);
    if (status.status_code === 'FINISHED') break;
    if (status.status_code === 'ERROR') throw new Error(`IG動画処理エラー: ${JSON.stringify(status)}`);
  }
  const p = await metaPost(`${BASE}/${igId}/media_publish`, { creation_id: c.id, access_token: token });
  if (!p.id) throw new Error(`IGリール公開失敗: ${JSON.stringify(p)}`);
  return p.id as string;
}

async function igStory(imageUrl: string, token: string, igId: string) {
  const c = await metaPost(`${BASE}/${igId}/media`, { image_url: imageUrl, media_type: 'IMAGE', is_stories: true, access_token: token });
  if (!c.id) throw new Error(`IGストーリーコンテナ作成失敗: ${JSON.stringify(c)}`);
  const p = await metaPost(`${BASE}/${igId}/media_publish`, { creation_id: c.id, access_token: token });
  if (!p.id) throw new Error(`IGストーリー公開失敗: ${JSON.stringify(p)}`);
  return p.id as string;
}

// ─── Facebook ─────────────────────────────────────────────────

async function fbImages(imageUrls: string[], caption: string, token: string, pageId: string) {
  if (imageUrls.length === 1) {
    const d = await metaPost(`${BASE}/${pageId}/photos`, { url: imageUrls[0], caption, access_token: token });
    if (!d.id) throw new Error(`FB写真投稿失敗: ${JSON.stringify(d)}`);
    return d.id as string;
  }
  const attached: { media_fbid: string }[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const d = await metaPost(`${BASE}/${pageId}/photos`, { url, published: false, access_token: token });
    if (!d.id) throw new Error(`FB写真アップロード失敗: ${JSON.stringify(d)}`);
    attached.push({ media_fbid: d.id });
  }
  const feed = await metaPost(`${BASE}/${pageId}/feed`, {
    message: caption,
    attached_media: attached,
    access_token: token,
  });
  if (!feed.id) throw new Error(`FB複数枚投稿失敗: ${JSON.stringify(feed)}`);
  return feed.id as string;
}

async function fbVideo(videoUrl: string, caption: string, token: string, pageId: string) {
  const d = await metaPost(`${BASE}/${pageId}/videos`, { file_url: videoUrl, description: caption, access_token: token });
  if (!d.id) throw new Error(`FB動画投稿失敗: ${JSON.stringify(d)}`);
  return d.id as string;
}

async function fbStory(imageUrl: string, token: string, pageId: string) {
  const u = await metaPost(`${BASE}/${pageId}/photos`, { url: imageUrl, published: false, access_token: token });
  if (!u.id) throw new Error(`FBストーリーアップロード失敗: ${JSON.stringify(u)}`);
  const s = await metaPost(`${BASE}/${pageId}/photo_stories`, { photo_id: u.id, access_token: token });
  if (!s.success) throw new Error(`FBストーリー公開失敗: ${JSON.stringify(s)}`);
  return u.id as string;
}

// ─── Public API ───────────────────────────────────────────────

export interface MediaItem {
  url: string;
  mediaType: 'image' | 'video';
}

export async function publishPost(
  items: MediaItem[],
  caption: string,
  postType: 'feed' | 'story',
  platform: 'instagram' | 'facebook' | 'both'
) {
  const { token, pageId, igId } = cfg();
  const result: { instagramId?: string; facebookId?: string } = {};

  const images = items.filter(i => i.mediaType === 'image').map(i => i.url);
  const video = items.find(i => i.mediaType === 'video');

  if (!images.length && !video) throw new Error('投稿するメディアがありません');

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
