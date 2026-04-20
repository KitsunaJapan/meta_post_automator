/**
 * スケジュール投稿ワーカー
 * 使い方: npx ts-node scripts/scheduler.ts
 * または: node -r ts-node/register scripts/scheduler.ts
 *
 * 本番では PM2 や systemd で常時起動させてください。
 */

import cron from 'node-cron';
import { readScheduled, updateStatus } from '../lib/store';
import {
  postInstagramFeed,
  postInstagramStory,
  postFacebookFeed,
  postFacebookStory,
} from '../lib/meta';

// 毎分チェック
cron.schedule('* * * * *', async () => {
  const now = new Date();
  const posts = readScheduled().filter((p) => p.status === 'scheduled');

  for (const post of posts) {
    const scheduledAt = new Date(post.scheduledAt);
    if (scheduledAt > now) continue;

    console.log(`[Scheduler] 投稿開始: ${post.id} (${post.platform}/${post.postType})`);

    try {
      if (post.platform === 'instagram' || post.platform === 'both') {
        if (post.postType === 'story') {
          await postInstagramStory(post.imageUrl);
        } else {
          await postInstagramFeed(post.imageUrl, post.caption);
        }
      }

      if (post.platform === 'facebook' || post.platform === 'both') {
        if (post.postType === 'story') {
          await postFacebookStory(post.imageUrl);
        } else {
          await postFacebookFeed(post.imageUrl, post.caption);
        }
      }

      updateStatus(post.id, 'posted');
      console.log(`[Scheduler] ✅ 投稿成功: ${post.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStatus(post.id, 'failed', msg);
      console.error(`[Scheduler] ❌ 投稿失敗: ${post.id}`, msg);
    }
  }
});

console.log('[Scheduler] 起動しました。毎分スケジュールをチェックします。');
