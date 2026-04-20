import fs from 'fs';
import path from 'path';
import { ScheduledPost } from '@/types';

const DATA_FILE = path.join(process.cwd(), 'data', 'scheduled.json');

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readScheduled(): ScheduledPost[] {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function writeScheduled(posts: ScheduledPost[]) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
}

export function addScheduled(post: ScheduledPost) {
  const posts = readScheduled();
  posts.push(post);
  writeScheduled(posts);
}

export function updateStatus(
  id: string,
  status: ScheduledPost['status'],
  error?: string
) {
  const posts = readScheduled();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx >= 0) {
    posts[idx].status = status;
    if (error) posts[idx].error = error;
    writeScheduled(posts);
  }
}

export function deleteScheduled(id: string) {
  const posts = readScheduled();
  writeScheduled(posts.filter((p) => p.id !== id));
}
