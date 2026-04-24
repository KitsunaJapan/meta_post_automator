export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../auth/route';

export type PostGoal = 'engagement' | 'promotion' | 'branding' | 'awareness';

const GOAL_DESCRIPTIONS: Record<PostGoal, string> = {
  engagement:  'フォロワーとの交流・いいね・コメントを最大化するエンゲージメント獲得',
  promotion:   '商品やサービスへの興味・購買意欲を高めるプロモーション',
  branding:    'ブランドの世界観・価値観・ストーリーを伝えるブランディング',
  awareness:   '新しい情報・ニュース・知識を広く届ける認知拡大・情報発信',
};

export async function POST(req: NextRequest) {
  if (!verifyToken(req)) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  try {
    const { content, goal, platform } = await req.json() as { content: string; goal: PostGoal; platform: 'instagram' | 'facebook' | 'both' };
    if (!content || !goal) return NextResponse.json({ error: 'content と goal が必要です' }, { status: 400 });
    const platformNote = platform === 'instagram' ? 'Instagram向け（ハッシュタグを10〜20個、絵文字を適度に使用）' : platform === 'facebook' ? 'Facebook向け（ハッシュタグは3〜5個、文章は少し長め・丁寧に）' : 'InstagramとFacebook両方に適した汎用スタイル（ハッシュタグは5〜15個）';
    const prompt = `あなたはSNSマーケティングの専門家です。\n以下の情報をもとに、${platformNote}のSNS投稿キャプションとハッシュタグを生成してください。\n\n## 投稿内容のメモ\n${content}\n\n## 投稿目的\n${GOAL_DESCRIPTIONS[goal]}\n\n## 出力ルール\n- 必ずJSON形式のみで返してください（前後の説明文・マークダウン記号不要）\n- JSONのキーは caption, hashtags, suggestions の3つ\n- caption: 投稿本文（ハッシュタグは含めない）。改行は \\n で表現\n- hashtags: ハッシュタグの配列（# 付き）\n- suggestions: 改善提案・注意点を2〜3個の文字列配列\n\n出力例:\n{"caption":"投稿本文\\n2行目","hashtags":["#例1","#例2"],"suggestions":["提案1","提案2"]}`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await response.json();
    const raw = data.content?.[0]?.text ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AIからの応答をパースできませんでした');
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
