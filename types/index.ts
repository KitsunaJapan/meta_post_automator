export type PostType = 'feed' | 'story';
export type Platform = 'instagram' | 'facebook' | 'both';
export type PostStatus = 'pending' | 'posted' | 'failed' | 'scheduled';

export interface ScheduledPost {
  id: string;
  imageUrl: string;
  caption: string;
  postType: PostType;
  platform: Platform;
  scheduledAt: string; // ISO string
  status: PostStatus;
  createdAt: string;
  error?: string;
}

export interface PostResult {
  success: boolean;
  instagramId?: string;
  facebookId?: string;
  error?: string;
}
