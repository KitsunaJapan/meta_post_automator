export type PostType = 'feed' | 'story';
export type Platform = 'instagram' | 'facebook' | 'both';
export type PostStatus = 'pending' | 'posted' | 'failed' | 'scheduled';

export interface MediaItem {
  url: string;
  mediaType: 'image' | 'video';
}

export interface ScheduledPost {
  id: string;
  imageUrl: string; // 後方互換用（先頭メディアのURL）
  items?: MediaItem[]; // 複数メディア対応
  caption: string;
  postType: PostType;
  platform: Platform;
  scheduledAt: string;
  status: PostStatus;
  createdAt: string;
  error?: string;
}
