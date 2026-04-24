export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { readScheduled, deleteScheduled } from '@/lib/store';
import { verifyToken } from '../auth/route';

export async function GET(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  const posts = readScheduled();
  return NextResponse.json(posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
}

export async function DELETE(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
  deleteScheduled(id);
  return NextResponse.json({ success: true });
}
