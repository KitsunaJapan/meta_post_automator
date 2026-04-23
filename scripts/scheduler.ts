import cron from 'node-cron';
import { readScheduled, updateStatus } from '../lib/store';
import { publishPost, MediaItem } from '../lib/meta';

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const posts = readScheduled().filter(p => p.status === 'scheduled');

  for (const post of posts) {
    if (new Date(post.scheduledAt) > now) continue;
    console.log(`[Scheduler] 投稿開始: ${post.id}`);
    try {
      const items: MediaItem[] = post.items ?? [{ url: post.imageUrl, mediaType: 'image' }];
      await publishPost(items, post.caption, post.postType, post.platform);
      updateStatus(post.id, 'posted');
      console.log(`[Scheduler] ✅ 完了: ${post.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStatus(post.id, 'failed', msg);
      console.error(`[Scheduler] ❌ 失敗: ${post.id}`, msg);
    }
  }
});

console.log('[Scheduler] 起動しました。毎分スケジュールをチェックします。');
