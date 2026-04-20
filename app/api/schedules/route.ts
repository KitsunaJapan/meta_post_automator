import { NextRequest, NextResponse } from 'next/server';
import { readScheduled, deleteScheduled } from '@/lib/store';

export async function GET() {
  const posts = readScheduled();
  // 新しい順に返す
  return NextResponse.json(
    posts.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  );
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });
  deleteScheduled(id);
  return NextResponse.json({ success: true });
}
