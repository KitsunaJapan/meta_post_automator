import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { verifyToken } from '../auth/route';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export interface MetaSettings {
  facebookPageAccessToken: string;
  facebookPageId: string;
  instagramBusinessAccountId: string;
}

export function loadSettings(): MetaSettings {
  // 環境変数を優先、なければファイルから読む
  const fromEnv: MetaSettings = {
    facebookPageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? '',
    facebookPageId: process.env.FACEBOOK_PAGE_ID ?? '',
    instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? '',
  };
  const allSet = Object.values(fromEnv).every(v => v.length > 0);
  if (allSet) return fromEnv;

  if (existsSync(SETTINGS_FILE)) {
    try {
      const saved = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as MetaSettings;
      // 環境変数があればそちらを優先
      return {
        facebookPageAccessToken: fromEnv.facebookPageAccessToken || saved.facebookPageAccessToken,
        facebookPageId: fromEnv.facebookPageId || saved.facebookPageId,
        instagramBusinessAccountId: fromEnv.instagramBusinessAccountId || saved.instagramBusinessAccountId,
      };
    } catch {
      return fromEnv;
    }
  }
  return fromEnv;
}

// GET: 現在の設定をマスクして返す
export async function GET(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  const s = loadSettings();
  // トークンは末尾6文字だけ表示
  const mask = (v: string) => v.length > 6 ? '•'.repeat(v.length - 6) + v.slice(-6) : v ? '••••••' : '';
  return NextResponse.json({
    facebookPageAccessToken: mask(s.facebookPageAccessToken),
    facebookPageId: s.facebookPageId,
    instagramBusinessAccountId: s.instagramBusinessAccountId,
    isConfigured: s.facebookPageAccessToken.length > 0 && s.facebookPageId.length > 0 && s.instagramBusinessAccountId.length > 0,
  });
}

// POST: 設定を保存
export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  const body = await req.json() as Partial<MetaSettings>;

  const current = loadSettings();
  const updated: MetaSettings = {
    facebookPageAccessToken: body.facebookPageAccessToken ?? current.facebookPageAccessToken,
    facebookPageId: body.facebookPageId ?? current.facebookPageId,
    instagramBusinessAccountId: body.instagramBusinessAccountId ?? current.instagramBusinessAccountId,
  };

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));

  return NextResponse.json({ success: true });
}
