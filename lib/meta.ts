const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

const PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
const PAGE_ID = process.env.FACEBOOK_PAGE_ID!;
const IG_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;

// ─── Instagram ───────────────────────────────────────────────

/** Instagram フィード投稿 */
export async function postInstagramFeed(imageUrl: string, caption: string) {
  // Step 1: メディアコンテナを作成
  const containerRes = await fetch(
    `${GRAPH_API_BASE}/${IG_ACCOUNT_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: PAGE_TOKEN,
      }),
    }
  );
  const container = await containerRes.json();
  if (!container.id) throw new Error(`Container error: ${JSON.stringify(container)}`);

  // Step 2: 公開
  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${IG_ACCOUNT_ID}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: PAGE_TOKEN,
      }),
    }
  );
  const publish = await publishRes.json();
  if (!publish.id) throw new Error(`Publish error: ${JSON.stringify(publish)}`);
  return publish.id as string;
}

/** Instagram ストーリーズ投稿 */
export async function postInstagramStory(imageUrl: string) {
  const containerRes = await fetch(
    `${GRAPH_API_BASE}/${IG_ACCOUNT_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        media_type: 'IMAGE',
        is_stories: true,
        access_token: PAGE_TOKEN,
      }),
    }
  );
  const container = await containerRes.json();
  if (!container.id) throw new Error(`Story container error: ${JSON.stringify(container)}`);

  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${IG_ACCOUNT_ID}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: PAGE_TOKEN,
      }),
    }
  );
  const publish = await publishRes.json();
  if (!publish.id) throw new Error(`Story publish error: ${JSON.stringify(publish)}`);
  return publish.id as string;
}

// ─── Facebook ────────────────────────────────────────────────

/** Facebook フィード投稿（画像付き） */
export async function postFacebookFeed(imageUrl: string, caption: string) {
  const res = await fetch(`${GRAPH_API_BASE}/${PAGE_ID}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      caption,
      access_token: PAGE_TOKEN,
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Facebook post error: ${JSON.stringify(data)}`);
  return data.id as string;
}

/** Facebook ストーリーズ投稿 */
export async function postFacebookStory(imageUrl: string) {
  // Step 1: 写真アップロード (published: false)
  const uploadRes = await fetch(`${GRAPH_API_BASE}/${PAGE_ID}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      published: false,
      access_token: PAGE_TOKEN,
    }),
  });
  const upload = await uploadRes.json();
  if (!upload.id) throw new Error(`FB story upload error: ${JSON.stringify(upload)}`);

  // Step 2: ストーリーとして公開
  const storyRes = await fetch(`${GRAPH_API_BASE}/${PAGE_ID}/photo_stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photo_id: upload.id,
      access_token: PAGE_TOKEN,
    }),
  });
  const story = await storyRes.json();
  if (!story.success) throw new Error(`FB story publish error: ${JSON.stringify(story)}`);
  return upload.id as string;
}
