'use client';

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import type { Platform, PostType, ScheduledPost } from '@/types';

type PostGoal = 'engagement' | 'promotion' | 'branding' | 'awareness';
type Step = 'input' | 'preview' | 'done';
type AppTab = 'post' | 'schedule' | 'list' | 'settings';

const GOAL_OPTIONS: { value: PostGoal; label: string; desc: string; emoji: string }[] = [
  { value: 'engagement',  label: 'エンゲージメント獲得', desc: 'いいね・コメントを最大化',   emoji: '💬' },
  { value: 'promotion',   label: 'プロモーション',       desc: '商品・サービスの購買促進',   emoji: '🛍' },
  { value: 'branding',    label: 'ブランディング',       desc: '世界観・ストーリーを伝える', emoji: '✨' },
  { value: 'awareness',   label: '認知拡大・情報発信',   desc: '新情報・知識を広く届ける',   emoji: '📢' },
];
const PLATFORM_LABELS: Record<Platform, string> = { instagram: 'Instagram', facebook: 'Facebook', both: '両方' };
const STATUS_LABELS: Record<ScheduledPost['status'], string> = { scheduled: '待機中', posted: '投稿済', failed: '失敗', pending: '処理中' };
const STATUS_COLORS: Record<ScheduledPost['status'], string> = { scheduled: '#2563eb', posted: '#16a34a', failed: '#dc2626', pending: '#d97706' };

// ─── shared fetch helper (always sends app token) ─────────────
function useAuthedFetch(token: string) {
  return useCallback(async (url: string, init: RequestInit = {}) => {
    return fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), 'x-app-token': token },
    });
  }, [token]);
}

export default function Home() {
  // ── Auth state ───────────────────────────────────────────────
  const [appToken, setAppToken] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Load token from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('sp_token');
    if (saved) setAppToken(saved);
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true); setLoginError('');
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: loginPassword }) });
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('sp_token', data.token);
      setAppToken(data.token);
    } else {
      setLoginError(data.error ?? 'パスワードが違います');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('sp_token');
    setAppToken('');
    setLoginPassword('');
  };

  const authedFetch = useAuthedFetch(appToken);

  // ── App tabs ─────────────────────────────────────────────────
  const [tab, setTab] = useState<AppTab>('post');
  const [step, setStep] = useState<Step>('input');

  // ── Settings state ───────────────────────────────────────────
  const [settingsFbToken, setSettingsFbToken] = useState('');
  const [settingsFbPageId, setSettingsFbPageId] = useState('');
  const [settingsIgId, setSettingsIgId] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [settingsMasked, setSettingsMasked] = useState<{ facebookPageAccessToken: string; facebookPageId: string; instagramBusinessAccountId: string; isConfigured: boolean } | null>(null);

  const fetchSettings = useCallback(async () => {
    const res = await authedFetch('/api/settings');
    if (res.ok) setSettingsMasked(await res.json());
  }, [authedFetch]);

  useEffect(() => { if (tab === 'settings' && appToken) fetchSettings(); }, [tab, appToken, fetchSettings]);

  const handleSaveSettings = async () => {
    setSettingsLoading(true); setSettingsMsg(null);
    const body: Record<string, string> = {};
    if (settingsFbToken) body.facebookPageAccessToken = settingsFbToken;
    if (settingsFbPageId) body.facebookPageId = settingsFbPageId;
    if (settingsIgId) body.instagramBusinessAccountId = settingsIgId;
    const res = await authedFetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
      setSettingsMsg({ type: 'success', text: '✅ 設定を保存しました' });
      setSettingsFbToken(''); setSettingsFbPageId(''); setSettingsIgId('');
      fetchSettings();
    } else {
      setSettingsMsg({ type: 'error', text: `❌ ${data.error}` });
    }
    setSettingsLoading(false);
  };

  // ── Post / Image state ───────────────────────────────────────
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [contentMemo, setContentMemo] = useState('');
  const [goal, setGoal] = useState<PostGoal>('engagement');
  const [postType, setPostType] = useState<PostType>('feed');
  const [platform, setPlatform] = useState<Platform>('both');
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);

  const fetchScheduled = useCallback(async () => {
    const res = await authedFetch('/api/schedules');
    if (res.ok) setScheduled(await res.json());
  }, [authedFetch]);

  useEffect(() => { if (tab === 'list') fetchScheduled(); }, [tab, fetchScheduled]);
  useEffect(() => { setStep('input'); setMessage(null); }, [tab]);

  // ── Image helpers ────────────────────────────────────────────
  const selectFile = (file: File) => {
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) { setMessage({ type: 'error', text: 'JPEG / PNG / WebP / GIF のみ対応しています' }); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage({ type: 'error', text: 'ファイルサイズは 10MB 以下にしてください' }); return; }
    setImageFile(file); setImageUrl(''); setMessage(null);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;
    if (imageUrl) return imageUrl;
    setUploading(true); setUploadProgress(0);
    try {
      const interval = setInterval(() => setUploadProgress(p => Math.min(p + 15, 85)), 150);
      const fd = new FormData(); fd.append('file', imageFile);
      const res = await authedFetch('/api/upload', { method: 'POST', body: fd });
      clearInterval(interval); setUploadProgress(100);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setImageUrl(data.url);
      return data.url as string;
    } catch (err) {
      setMessage({ type: 'error', text: `❌ アップロード失敗: ${err instanceof Error ? err.message : err}` });
      return null;
    } finally { setUploading(false); }
  };

  const clearImage = () => { setImageFile(null); setImagePreview(null); setImageUrl(''); if (fileInputRef.current) fileInputRef.current.value = ''; };

  // ── AI Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!contentMemo.trim()) return setMessage({ type: 'error', text: '投稿内容のメモを入力してください' });
    setGenerating(true); setMessage(null);
    try {
      const res = await authedFetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: contentMemo, goal, platform }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setCaption(data.caption ?? ''); setHashtags(data.hashtags ?? []); setSuggestions(data.suggestions ?? []);
      setStep('preview');
    } catch (err) { setMessage({ type: 'error', text: `❌ AI生成失敗: ${err instanceof Error ? err.message : err}` }); }
    finally { setGenerating(false); }
  };

  // ── Post / Schedule ──────────────────────────────────────────
  const buildFullCaption = () => `${caption}\n\n${hashtags.join(' ')}`.trim();

  const handlePost = async () => {
    if (!imageFile) return setMessage({ type: 'error', text: '画像を選択してください' });
    setLoading(true); setMessage(null);
    try {
      const url = await uploadImage(); if (!url) return;
      const res = await authedFetch('/api/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: url, caption: buildFullCaption(), postType, platform }) });
      const data = await res.json();
      if (data.success) { setMessage({ type: 'success', text: '✅ 投稿が完了しました！' }); resetAll(); setStep('done'); }
      else setMessage({ type: 'error', text: `❌ ${data.error}` });
    } catch { setMessage({ type: 'error', text: '❌ ネットワークエラーが発生しました' }); }
    finally { setLoading(false); }
  };

  const handleSchedule = async () => {
    if (!imageFile) return setMessage({ type: 'error', text: '画像を選択してください' });
    if (!scheduledAt) return setMessage({ type: 'error', text: '投稿日時を指定してください' });
    setLoading(true); setMessage(null);
    try {
      const url = await uploadImage(); if (!url) return;
      const res = await authedFetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: url, caption: buildFullCaption(), postType, platform, scheduledAt }) });
      const data = await res.json();
      if (data.success) { setMessage({ type: 'success', text: '✅ スケジュールを登録しました！' }); resetAll(); setStep('done'); }
      else setMessage({ type: 'error', text: `❌ ${data.error}` });
    } catch { setMessage({ type: 'error', text: '❌ ネットワークエラーが発生しました' }); }
    finally { setLoading(false); }
  };

  const resetAll = () => { clearImage(); setContentMemo(''); setCaption(''); setHashtags([]); setSuggestions([]); setScheduledAt(''); setGoal('engagement'); setPlatform('both'); setPostType('feed'); };

  const handleDelete = async (id: string) => {
    await authedFetch('/api/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchScheduled();
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#*/, '#');
    if (tag.length > 1 && !hashtags.includes(tag)) setHashtags(h => [...h, tag]);
    setHashtagInput('');
  };
  const removeHashtag = (tag: string) => setHashtags(h => h.filter(t => t !== tag));

  // ── Styles ───────────────────────────────────────────────────
  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 };
  const input: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#1a1a1a', background: '#fff' };
  const toggleBtn = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${active ? '#1a1a1a' : '#ddd'}`, background: active ? '#1a1a1a' : '#fff', color: active ? '#fff' : '#555', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' });

  // ── LOGIN SCREEN ─────────────────────────────────────────────
  if (!appToken) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e3de', padding: '40px 36px', width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 12px' }}>📡</div>
            <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>SocialPoster</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#888' }}>パスワードを入力してください</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              type="password"
              placeholder="パスワード"
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...input, fontSize: 15, padding: '12px 14px', textAlign: 'center', letterSpacing: '0.1em' }}
              autoFocus
            />
            {loginError && <p style={{ margin: 0, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>{loginError}</p>}
            <button
              onClick={handleLogin}
              disabled={loginLoading || !loginPassword}
              style={{ padding: '13px', background: loginLoading || !loginPassword ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loginLoading || !loginPassword ? 'not-allowed' : 'pointer' }}
            >
              {loginLoading ? '確認中...' : 'ログイン'}
            </button>
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 11, color: '#bbb', textAlign: 'center' }}>Render環境変数 APP_PASSWORD で設定</p>
        </div>
      </div>
    );
  }

  // ── IMAGE UPLOADER ───────────────────────────────────────────
  const ImageUploader = (
    <div>
      <label style={label}>画像</label>
      {!imagePreview ? (
        <div onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) selectFile(f); }} onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${isDragging ? '#1a1a1a' : '#ccc'}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: isDragging ? '#f5f5f2' : '#fafaf8', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#333' }}>クリックまたはドラッグ＆ドロップ</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>JPEG / PNG / WebP / GIF・最大 10MB</p>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f); }} />
        </div>
      ) : (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e3de', position: 'relative' }}>
          <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
          <div style={{ padding: '10px 14px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageFile?.name}</p>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12, color: '#555', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>変更</button>
              <button onClick={clearImage} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>削除</button>
            </div>
          </div>
          {uploading && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#eee' }}><div style={{ height: '100%', width: `${uploadProgress}%`, background: '#1a1a1a', transition: 'width 0.2s' }} /></div>}
          {imageUrl && !uploading && <div style={{ position: 'absolute', top: 10, right: 10, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>✓ アップロード済</div>}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f); }} />
        </div>
      )}
    </div>
  );

  // ── STEP BAR ─────────────────────────────────────────────────
  const StepBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {[{ s: 'input', n: 1, l: '入力' }, { s: 'preview', n: 2, l: 'プレビュー・編集' }, { s: 'done', n: 3, l: '完了' }].map(({ s, n, l }, i) => {
        const active = step === s;
        const done = (step === 'preview' && n === 1) || (step === 'done' && n < 3);
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, background: done ? '#16a34a' : active ? '#1a1a1a' : '#e5e3de', color: done || active ? '#fff' : '#999', flexShrink: 0 }}>{done ? '✓' : n}</div>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#1a1a1a' : '#999', whiteSpace: 'nowrap' }}>{l}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: done ? '#16a34a' : '#e5e3de', margin: '0 8px' }} />}
          </div>
        );
      })}
    </div>
  );

  // ── MAIN APP ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e3de', padding: '0 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #f09433 0%, #dc2743 50%, #bc1888 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📡</div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>SocialPoster</h1>
          <button onClick={handleLogout} style={{ marginLeft: 'auto', fontSize: 12, color: '#888', background: 'none', border: '1px solid #e0ded9', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>ログアウト</button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, background: '#eeece7', borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {[{ key: 'post', label: '今すぐ投稿' }, { key: 'schedule', label: 'スケジュール' }, { key: 'list', label: '予約一覧' }, { key: 'settings', label: '⚙ 設定' }].map(({ key, label: l }) => (
            <button key={key} onClick={() => { setTab(key as AppTab); setMessage(null); }} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 600 : 400, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#1a1a1a' : '#666', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{l}</button>
          ))}
        </div>

        {message && (
          <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`, color: message.type === 'success' ? '#166534' : '#991b1b' }}>{message.text}</div>
        )}

        {/* ═══ SETTINGS TAB ═══════════════════════════════════════ */}
        {tab === 'settings' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e3de', padding: 28 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Meta API 設定</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#888' }}>ここで入力した値はサーバーに保存されます。空欄のまま保存すると変更されません。</p>

            {settingsMasked && (
              <div style={{ background: settingsMasked.isConfigured ? '#f0fdf4' : '#fef2f2', border: `1px solid ${settingsMasked.isConfigured ? '#86efac' : '#fca5a5'}`, borderRadius: 9, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: settingsMasked.isConfigured ? '#166534' : '#991b1b' }}>
                {settingsMasked.isConfigured ? '✅ 設定済み — 投稿機能が使えます' : '⚠️ 未設定 — 下のフォームで設定してください'}
                {settingsMasked.isConfigured && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'monospace', fontSize: 12, color: '#555' }}>
                    <span>Page Access Token: {settingsMasked.facebookPageAccessToken}</span>
                    <span>Facebook Page ID: {settingsMasked.facebookPageId}</span>
                    <span>Instagram Account ID: {settingsMasked.instagramBusinessAccountId}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={label}>Facebook Page Access Token（長期トークン）</label>
                <input type="password" placeholder="EAABxx... （新しいトークンを入力する場合のみ）" value={settingsFbToken} onChange={e => setSettingsFbToken(e.target.value)} style={input} />
              </div>
              <div>
                <label style={label}>Facebook Page ID</label>
                <input type="text" placeholder="例: 123456789012345" value={settingsFbPageId} onChange={e => setSettingsFbPageId(e.target.value)} style={input} />
              </div>
              <div>
                <label style={label}>Instagram Business Account ID</label>
                <input type="text" placeholder="例: 17841400000000000" value={settingsIgId} onChange={e => setSettingsIgId(e.target.value)} style={input} />
              </div>

              {settingsMsg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: settingsMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${settingsMsg.type === 'success' ? '#86efac' : '#fca5a5'}`, color: settingsMsg.type === 'success' ? '#166534' : '#991b1b' }}>{settingsMsg.text}</div>}

              <button onClick={handleSaveSettings} disabled={settingsLoading} style={{ padding: '13px', background: settingsLoading ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: settingsLoading ? 'not-allowed' : 'pointer' }}>
                {settingsLoading ? '保存中...' : '設定を保存する'}
              </button>
            </div>

            <div style={{ marginTop: 28, padding: '16px', background: '#fafaf8', borderRadius: 9, border: '1px solid #e5e3de', fontSize: 12, color: '#666', lineHeight: 1.8 }}>
              <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#444' }}>各IDの取得方法</p>
              <p style={{ margin: 0 }}>Graph API Explorer → <code style={{ background: '#f0eee9', padding: '1px 5px', borderRadius: 4 }}>/me/accounts</code> を実行 → <code style={{ background: '#f0eee9', padding: '1px 5px', borderRadius: 4 }}>id</code> = Page ID、<code style={{ background: '#f0eee9', padding: '1px 5px', borderRadius: 4 }}>access_token</code> = トークン</p>
              <p style={{ margin: '4px 0 0' }}>次に <code style={{ background: '#f0eee9', padding: '1px 5px', borderRadius: 4 }}>/{"{PAGE_ID}"}?fields=instagram_business_account</code> を実行 → <code style={{ background: '#f0eee9', padding: '1px 5px', borderRadius: 4 }}>id</code> = Instagram Account ID</p>
            </div>
          </div>
        )}

        {/* ═══ POST / SCHEDULE TABS ═══════════════════════════════ */}
        {(tab === 'post' || tab === 'schedule') && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e3de', padding: 28 }}>
            {StepBar}

            {step === 'input' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {ImageUploader}
                <div>
                  <label style={label}>投稿内容のメモ <span style={{ color: '#888', fontWeight: 400 }}>（AIへの指示）</span></label>
                  <textarea placeholder={`例：\n新商品のコーヒーを紹介したい。深煎りで香りが良く、朝の一杯に最適。価格は1,200円。`} value={contentMemo} onChange={e => setContentMemo(e.target.value)} rows={4} style={{ ...input, resize: 'vertical', height: 'auto', paddingTop: 10, lineHeight: 1.6 }} />
                </div>
                <div>
                  <label style={label}>投稿目的</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {GOAL_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setGoal(opt.value)} style={{ padding: '12px 14px', borderRadius: 9, border: `1.5px solid ${goal === opt.value ? '#1a1a1a' : '#e0ded9'}`, background: goal === opt.value ? '#1a1a1a' : '#fafaf8', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.emoji}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: goal === opt.value ? '#fff' : '#222' }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: goal === opt.value ? '#ccc' : '#888', marginTop: 2 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={label}>投稿タイプ</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['feed', 'story'] as PostType[]).map(t => (<button key={t} onClick={() => setPostType(t)} style={toggleBtn(postType === t)}>{t === 'feed' ? '📷 フィード' : '⏱ ストーリーズ'}</button>))}
                    </div>
                  </div>
                  <div>
                    <label style={label}>投稿先</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['instagram', 'facebook', 'both'] as Platform[]).map(p => (<button key={p} onClick={() => setPlatform(p)} style={toggleBtn(platform === p)}>{p === 'instagram' ? '📸 IG' : p === 'facebook' ? '👍 FB' : '🔀 両方'}</button>))}
                    </div>
                  </div>
                </div>
                <button onClick={handleGenerate} disabled={generating || !contentMemo.trim()} style={{ padding: '14px', background: generating || !contentMemo.trim() ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: generating || !contentMemo.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {generating ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 16 }}>⟳</span> AIがキャプションを生成中...</> : '✦ AIにキャプションを生成してもらう'}
                </button>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {step === 'preview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {suggestions.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>💡 AIからの提案</p>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {suggestions.map((s, i) => <li key={i} style={{ fontSize: 13, color: '#78350f' }}>{s}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <label style={label}>プレビュー</label>
                    <div style={{ border: '1px solid #e5e3de', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                      {imagePreview && <img src={imagePreview} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />}
                      <div style={{ padding: '12px 14px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.6, wordBreak: 'break-word' }}>{caption}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#2563eb', lineHeight: 1.7, wordBreak: 'break-word' }}>{hashtags.join(' ')}</p>
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#999' }}>文字数：{(caption + '\n\n' + hashtags.join(' ')).length} 字</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={label}>キャプション編集</label>
                      <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={8} style={{ ...input, resize: 'vertical', height: 'auto', paddingTop: 10, fontSize: 13, lineHeight: 1.6 }} />
                    </div>
                    <div>
                      <label style={label}>ハッシュタグ</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {hashtags.map(tag => (
                          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 10px', fontWeight: 500 }}>
                            {tag}<button onClick={() => removeHashtag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="text" placeholder="#タグを追加" value={hashtagInput} onChange={e => setHashtagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHashtag(); } }} style={{ ...input, fontSize: 13 }} />
                        <button onClick={addHashtag} style={{ flexShrink: 0, padding: '0 14px', background: '#f3f2ef', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#555' }}>追加</button>
                      </div>
                    </div>
                    <button onClick={() => setStep('input')} style={{ padding: '8px', background: 'none', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#555' }}>← 入力に戻る</button>
                  </div>
                </div>
                {tab === 'schedule' && (
                  <div>
                    <label style={label}>投稿日時</label>
                    <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={input} min={new Date().toISOString().slice(0, 16)} />
                  </div>
                )}
                <button onClick={tab === 'post' ? handlePost : handleSchedule} disabled={loading || uploading} style={{ padding: '14px', background: loading || uploading ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loading || uploading ? 'not-allowed' : 'pointer' }}>
                  {uploading ? `アップロード中 ${uploadProgress}%...` : loading ? '処理中...' : tab === 'post' ? '今すぐ投稿する' : 'スケジュールに追加する'}
                </button>
              </div>
            )}

            {step === 'done' && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{tab === 'post' ? '投稿が完了しました！' : 'スケジュールを登録しました！'}</p>
                <p style={{ margin: '0 0 24px', fontSize: 14, color: '#888' }}>{PLATFORM_LABELS[platform]} に{postType === 'feed' ? 'フィード' : 'ストーリーズ'}として{tab === 'post' ? '投稿されました' : '予約されました'}</p>
                <button onClick={() => { setStep('input'); setMessage(null); }} style={{ padding: '12px 32px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>続けて投稿する</button>
              </div>
            )}
          </div>
        )}

        {/* ═══ LIST TAB ═══════════════════════════════════════════ */}
        {tab === 'list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>予約投稿一覧</h2>
              <button onClick={fetchScheduled} style={{ fontSize: 12, color: '#666', background: 'none', border: '1px solid #e0ded9', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>🔄 更新</button>
            </div>
            {scheduled.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#999', fontSize: 14 }}>スケジュール済みの投稿はありません</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {scheduled.map(post => (
                  <div key={post.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e3de', padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <img src={post.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #e5e3de' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[post.status], background: STATUS_COLORS[post.status] + '18', padding: '2px 8px', borderRadius: 20 }}>{STATUS_LABELS[post.status]}</span>
                        <span style={{ fontSize: 12, color: '#888', background: '#f3f2ef', padding: '2px 8px', borderRadius: 20 }}>{PLATFORM_LABELS[post.platform]}</span>
                        <span style={{ fontSize: 12, color: '#888', background: '#f3f2ef', padding: '2px 8px', borderRadius: 20 }}>{post.postType === 'feed' ? 'フィード' : 'ストーリーズ'}</span>
                      </div>
                      {post.caption && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</p>}
                      <p style={{ margin: 0, fontSize: 12, color: '#999' }}>📅 {new Date(post.scheduledAt).toLocaleString('ja-JP')}</p>
                      {post.error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>⚠ {post.error}</p>}
                    </div>
                    {post.status === 'scheduled' && (
                      <button onClick={() => handleDelete(post.id)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: '2px 4px' }} title="削除">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
