import { loadSettings } from '@/app/api/settings/route';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function getConfig() {
  const s = loadSettings();
  if (!s.facebookPageAccessToken || !s.facebookPageId || !s.instagramBusinessAccountId) {
    throw new Error('Meta APIの設定が未完了です。設定画面でアクセストークン等を入力してください。');
  }
  return s;
}

// ─── Instagram ───────────────────────────────────────────────

export async function postInstagramFeed(imageUrl: string, caption: string) {
  const { instagramBusinessAccountId: igId, facebookPageAccessToken: token } = getConfig();
  const containerRes = await fetch(`${GRAPH_API_BASE}/${igId}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const container = await containerRes.json();
  if (!container.id) throw new Error(`Container error: ${JSON.stringify(container)}`);

  const publishRes = await fetch(`${GRAPH_API_BASE}/${igId}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const publish = await publishRes.json();
  if (!publish.id) throw new Error(`Publish error: ${JSON.stringify(publish)}`);
  return publish.id as string;
}

export async function postInstagramStory(imageUrl: string) {
  const { instagramBusinessAccountId: igId, facebookPageAccessToken: token } = getConfig();
  const containerRes = await fetch(`${GRAPH_API_BASE}/${igId}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, media_type: 'IMAGE', is_stories: true, access_token: token }),
  });
  const container = await containerRes.json();
  if (!container.id) throw new Error(`Story container error: ${JSON.stringify(container)}`);

  const publishRes = await fetch(`${GRAPH_API_BASE}/${igId}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const publish = await publishRes.json();
  if (!publish.id) throw new Error(`Story publish error: ${JSON.stringify(publish)}`);
  return publish.id as string;
}

// ─── Facebook ────────────────────────────────────────────────

export async function postFacebookFeed(imageUrl: string, caption: string) {
  const { facebookPageId: pageId, facebookPageAccessToken: token } = getConfig();
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, caption, access_token: token }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Facebook post error: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function postFacebookStory(imageUrl: string) {
  const { facebookPageId: pageId, facebookPageAccessToken: token } = getConfig();
  const uploadRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, published: false, access_token: token }),
  });
  const upload = await uploadRes.json();
  if (!upload.id) throw new Error(`FB story upload error: ${JSON.stringify(upload)}`);

  const storyRes = await fetch(`${GRAPH_API_BASE}/${pageId}/photo_stories`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: upload.id, access_token: token }),
  });
  const story = await storyRes.json();
  if (!story.success) throw new Error(`FB story publish error: ${JSON.stringify(story)}`);
  return upload.id as string;
}
