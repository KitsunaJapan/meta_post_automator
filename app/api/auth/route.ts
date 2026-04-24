export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

// APP_PASSWORD は Render の環境変数で設定する（例: MY_SECRET_PASS）
const APP_PASSWORD = process.env.APP_PASSWORD ?? 'changeme';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== APP_PASSWORD) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 });
  }

  // シンプルなセッショントークン（ランダム文字列ではなくサーバー秘密鍵ベース）
  const token = Buffer.from(`${APP_PASSWORD}:${Date.now()}`).toString('base64');
  const res = NextResponse.json({ success: true, token });
  return res;
}

// トークン検証（他のAPIから呼び出す）
export function verifyToken(req: NextRequest): boolean {
  const auth = req.headers.get('x-app-token');
  if (!auth) return false;
  try {
    const decoded = Buffer.from(auth, 'base64').toString();
    const [pass] = decoded.split(':');
    return pass === APP_PASSWORD;
  } catch {
    return false;
  }
}
