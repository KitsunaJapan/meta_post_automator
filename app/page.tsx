'use client';

import { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import type { Platform, PostType, ScheduledPost, MediaItem } from '@/types';

type PostGoal = 'engagement' | 'promotion' | 'branding' | 'awareness';
type Step = 'input' | 'preview' | 'done';
type AppTab = 'post' | 'schedule' | 'list' | 'settings';

interface LocalMedia {
  id: string;
  file: File;
  preview: string; // dataURL for image, object URL for video
  mediaType: 'image' | 'video';
  uploadedUrl?: string;
}

const GOAL_OPTIONS = [
  { value: 'engagement' as PostGoal, label: 'エンゲージメント獲得', desc: 'いいね・コメントを最大化', emoji: '💬' },
  { value: 'promotion'  as PostGoal, label: 'プロモーション',       desc: '商品・サービスの購買促進', emoji: '🛍' },
  { value: 'branding'   as PostGoal, label: 'ブランディング',       desc: '世界観・ストーリーを伝える', emoji: '✨' },
  { value: 'awareness'  as PostGoal, label: '認知拡大・情報発信',   desc: '新情報・知識を広く届ける', emoji: '📢' },
];
const PLATFORM_LABELS: Record<Platform, string> = { instagram: 'Instagram', facebook: 'Facebook', both: '両方' };
const STATUS_LABELS: Record<ScheduledPost['status'], string> = { scheduled: '待機中', posted: '投稿済', failed: '失敗', pending: '処理中' };
const STATUS_COLORS: Record<ScheduledPost['status'], string> = { scheduled: '#2563eb', posted: '#16a34a', failed: '#dc2626', pending: '#d97706' };

const ALLOWED_TYPES = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/mov'];
const MAX_FILES = 10;

function useAuthedFetch(token: string) {
  return useCallback(async (url: string, init: RequestInit = {}) =>
    fetch(url, { ...init, headers: { ...(init.headers ?? {}), 'x-app-token': token } }),
  [token]);
}

export default function Home() {
  // ── Auth ─────────────────────────────────────────────────────
  const [appToken, setAppToken] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  useEffect(() => { const t = sessionStorage.getItem('sp_token'); if (t) setAppToken(t); }, []);

  const handleLogin = async () => {
    setLoginLoading(true); setLoginErr('');
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: loginPw }) });
    const data = await res.json();
    if (data.success) { sessionStorage.setItem('sp_token', data.token); setAppToken(data.token); }
    else setLoginErr(data.error ?? 'パスワードが違います');
    setLoginLoading(false);
  };
  const handleLogout = () => { sessionStorage.removeItem('sp_token'); setAppToken(''); setLoginPw(''); };
  const authedFetch = useAuthedFetch(appToken);

  // ── Tabs / Step ──────────────────────────────────────────────
  const [tab, setTab] = useState<AppTab>('post');
  const [step, setStep] = useState<Step>('input');
  useEffect(() => { setStep('input'); setMessage(null); }, [tab]);

  // ── Settings ─────────────────────────────────────────────────
  const [sFbToken, setSFbToken] = useState('');
  const [sFbPageId, setSFbPageId] = useState('');
  const [sIgId, setSIgId] = useState('');
  const [sLoading, setSLoading] = useState(false);
  const [sMsg, setSMsg] = useState<{ type: 'success'|'error'; text: string }|null>(null);
  const [sMasked, setSMasked] = useState<{ facebookPageAccessToken: string; facebookPageId: string; instagramBusinessAccountId: string; isConfigured: boolean }|null>(null);

  const fetchSettings = useCallback(async () => {
    const r = await authedFetch('/api/settings');
    if (r.ok) setSMasked(await r.json());
  }, [authedFetch]);
  useEffect(() => { if (tab === 'settings' && appToken) fetchSettings(); }, [tab, appToken, fetchSettings]);

  const handleSaveSettings = async () => {
    setSLoading(true); setSMsg(null);
    const body: Record<string,string> = {};
    if (sFbToken) body.facebookPageAccessToken = sFbToken;
    if (sFbPageId) body.facebookPageId = sFbPageId;
    if (sIgId) body.instagramBusinessAccountId = sIgId;
    const r = await authedFetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (d.success) { setSMsg({ type: 'success', text: '✅ 設定を保存しました' }); setSFbToken(''); setSFbPageId(''); setSIgId(''); fetchSettings(); }
    else setSMsg({ type: 'error', text: `❌ ${d.error}` });
    setSLoading(false);
  };

  // ── Media state ──────────────────────────────────────────────
  const [mediaItems, setMediaItems] = useState<LocalMedia[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: File[]) => {
    const toAdd = files.filter(f => ALLOWED_TYPES.includes(f.type)).slice(0, MAX_FILES - mediaItems.length);
    toAdd.forEach(file => {
      const isVideo = file.type.startsWith('video/');
      const id = Math.random().toString(36).slice(2);
      if (isVideo) {
        const preview = URL.createObjectURL(file);
        setMediaItems(prev => [...prev, { id, file, preview, mediaType: 'video' }]);
      } else {
        const reader = new FileReader();
        reader.onload = e => setMediaItems(prev => [...prev, { id, file, preview: e.target?.result as string, mediaType: 'image' }]);
        reader.readAsDataURL(file);
      }
    });
  }, [mediaItems.length]);

  const removeMedia = (id: string) => setMediaItems(prev => prev.filter(m => m.id !== id));
  const moveMedia = (id: string, dir: -1|1) => {
    setMediaItems(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  // ── Post state ───────────────────────────────────────────────
  const [contentMemo, setContentMemo] = useState('');
  const [goal, setGoal] = useState<PostGoal>('engagement');
  const [postType, setPostType] = useState<PostType>('feed');
  const [platform, setPlatform] = useState<Platform>('both');
  const [generating, setGenerating] = useState(false);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number|null>(null);
  const [message, setMessage] = useState<{ type: 'success'|'error'; text: string }|null>(null);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);

  const fetchScheduled = useCallback(async () => {
    const r = await authedFetch('/api/schedules');
    if (r.ok) setScheduled(await r.json());
  }, [authedFetch]);
  useEffect(() => { if (tab === 'list') fetchScheduled(); }, [tab, fetchScheduled]);

  // ── Upload all media ─────────────────────────────────────────
  const uploadAll = async (): Promise<MediaItem[]|null> => {
    const results: MediaItem[] = [];
    for (let i = 0; i < mediaItems.length; i++) {
      const m = mediaItems[i];
      if (m.uploadedUrl) { results.push({ url: m.uploadedUrl, mediaType: m.mediaType }); continue; }
      setUploadingIdx(i);
      const fd = new FormData(); fd.append('file', m.file);
      const r = await authedFetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (!d.success) { setMessage({ type: 'error', text: `❌ アップロード失敗 (${m.file.name}): ${d.error}` }); setUploadingIdx(null); return null; }
      setMediaItems(prev => prev.map(x => x.id === m.id ? { ...x, uploadedUrl: d.url } : x));
      results.push({ url: d.url, mediaType: m.mediaType });
    }
    setUploadingIdx(null);
    return results;
  };

  // ── AI Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!contentMemo.trim()) return setMessage({ type: 'error', text: '投稿内容のメモを入力してください' });
    setGenerating(true); setMessage(null);
    try {
      const r = await authedFetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: contentMemo, goal, platform }) });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      setCaption(d.caption ?? ''); setHashtags(d.hashtags ?? []); setSuggestions(d.suggestions ?? []);
      setStep('preview');
    } catch (err) { setMessage({ type: 'error', text: `❌ AI生成失敗: ${err instanceof Error ? err.message : err}` }); }
    finally { setGenerating(false); }
  };

  const buildCaption = () => `${caption}\n\n${hashtags.join(' ')}`.trim();

  // ── Post / Schedule ──────────────────────────────────────────
  const handlePost = async () => {
    if (!mediaItems.length) return setMessage({ type: 'error', text: 'メディアを追加してください' });
    setLoading(true); setMessage(null);
    try {
      const items = await uploadAll(); if (!items) return;
      const r = await authedFetch('/api/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, caption: buildCaption(), postType, platform }) });
      const d = await r.json();
      if (d.success) { resetAll(); setStep('done'); }
      else setMessage({ type: 'error', text: `❌ ${d.error}` });
    } catch { setMessage({ type: 'error', text: '❌ ネットワークエラーが発生しました' }); }
    finally { setLoading(false); }
  };

  const handleSchedule = async () => {
    if (!mediaItems.length) return setMessage({ type: 'error', text: 'メディアを追加してください' });
    if (!scheduledAt) return setMessage({ type: 'error', text: '投稿日時を指定してください' });
    setLoading(true); setMessage(null);
    try {
      const items = await uploadAll(); if (!items) return;
      const r = await authedFetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, caption: buildCaption(), postType, platform, scheduledAt }) });
      const d = await r.json();
      if (d.success) { resetAll(); setStep('done'); }
      else setMessage({ type: 'error', text: `❌ ${d.error}` });
    } catch { setMessage({ type: 'error', text: '❌ ネットワークエラーが発生しました' }); }
    finally { setLoading(false); }
  };

  const resetAll = () => {
    setMediaItems([]); setContentMemo(''); setCaption(''); setHashtags([]);
    setSuggestions([]); setScheduledAt(''); setGoal('engagement'); setPlatform('both'); setPostType('feed');
  };

  const handleDelete = async (id: string) => {
    await authedFetch('/api/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    fetchScheduled();
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#*/, '#');
    if (tag.length > 1 && !hashtags.includes(tag)) setHashtags(h => [...h, tag]);
    setHashtagInput('');
  };

  // ── Styles ───────────────────────────────────────────────────
  const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 };
  const inp: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', boxSizing: 'border-box', color: '#1a1a1a', background: '#fff' };
  const tgl = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 7, border: `1.5px solid ${on ? '#1a1a1a' : '#ddd'}`, background: on ? '#1a1a1a' : '#fff', color: on ? '#fff' : '#555', fontSize: 13, fontWeight: on ? 600 : 400, cursor: 'pointer' });

  // ── Media grid ───────────────────────────────────────────────
  const hasVideo = mediaItems.some(m => m.mediaType === 'video');
  const MediaGrid = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={lbl}>メディア <span style={{ color: '#999', fontWeight: 400 }}>（画像・動画、最大10件）</span></label>
        {mediaItems.length > 0 && (
          <span style={{ fontSize: 12, color: '#888' }}>{mediaItems.length} / 10 件</span>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{ border: `2px dashed ${isDragging ? '#1a1a1a' : '#ccc'}`, borderRadius: 10, padding: mediaItems.length ? '10px 14px' : '28px 20px', background: isDragging ? '#f5f5f2' : '#fafaf8', cursor: mediaItems.length >= MAX_FILES ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
      >
        {mediaItems.length === 0 ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#333' }}>クリックまたはドラッグ＆ドロップ</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>画像（JPEG/PNG/WebP）・動画（MP4/MOV）・最大10件</p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#888', textAlign: 'center' }}>
            {mediaItems.length < MAX_FILES ? '＋ さらに追加（クリック or ドロップ）' : '上限（10件）に達しました'}
          </p>
        )}
        <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime" style={{ display: 'none' }} onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>

      {/* Thumbnail grid */}
      {mediaItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginTop: 10 }}>
          {mediaItems.map((m, i) => (
            <div key={m.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `2px solid ${uploadingIdx === i ? '#2563eb' : '#e5e3de'}`, background: '#000' }}>
              {m.mediaType === 'video' ? (
                <video src={m.preview} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} muted />
              ) : (
                <img src={m.preview} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
              )}
              {/* Overlay */}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: m.mediaType === 'video' ? '#dc2626' : '#1a1a1a', padding: '2px 5px', borderRadius: 4 }}>
                    {m.mediaType === 'video' ? '動画' : `#${i + 1}`}
                  </span>
                  <button onClick={e => { e.stopPropagation(); removeMedia(m.id); }} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); moveMedia(m.id, -1); }} disabled={i === 0} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 6px', cursor: i === 0 ? 'not-allowed' : 'pointer', fontSize: 11, opacity: i === 0 ? 0.4 : 1 }}>◀</button>
                  <button onClick={e => { e.stopPropagation(); moveMedia(m.id, 1); }} disabled={i === mediaItems.length - 1} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 6px', cursor: i === mediaItems.length - 1 ? 'not-allowed' : 'pointer', fontSize: 11, opacity: i === mediaItems.length - 1 ? 0.4 : 1 }}>▶</button>
                </div>
              </div>
              {/* Upload progress overlay */}
              {uploadingIdx === i && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(37,99,235,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>UP...</span>
                </div>
              )}
              {m.uploadedUrl && (
                <div style={{ position: 'absolute', top: 4, right: 4, background: '#16a34a', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {mediaItems.length > 1 && !hasVideo && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#888' }}>📸 複数画像はInstagramではカルーセル投稿、Facebookでは複数枚投稿になります</p>
      )}
      {hasVideo && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#d97706' }}>🎬 動画が含まれる場合、Instagramではリール、Facebookでは動画投稿になります（動画は1件のみ有効）</p>
      )}
    </div>
  );

  // ── Step bar ─────────────────────────────────────────────────
  const StepBar = (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
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

  // ── Login screen ─────────────────────────────────────────────
  if (!appToken) return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e3de', padding: '40px 36px', width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 12px' }}>📡</div>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>SocialPoster</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>パスワードを入力してください</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="password" placeholder="パスワード" value={loginPw} onChange={e => setLoginPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ ...inp, fontSize: 15, padding: '12px 14px', textAlign: 'center', letterSpacing: '0.1em' }} autoFocus />
          {loginErr && <p style={{ margin: 0, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>{loginErr}</p>}
          <button onClick={handleLogin} disabled={loginLoading || !loginPw} style={{ padding: 13, background: loginLoading || !loginPw ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loginLoading || !loginPw ? 'not-allowed' : 'pointer' }}>
            {loginLoading ? '確認中...' : 'ログイン'}
          </button>
        </div>
        <p style={{ margin: '20px 0 0', fontSize: 11, color: '#bbb', textAlign: 'center' }}>Render環境変数 APP_PASSWORD で設定</p>
      </div>
    </div>
  );

  // ── Main app ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e3de', padding: '0 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', height: 60, gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📡</div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>SocialPoster</h1>
          <button onClick={handleLogout} style={{ marginLeft: 'auto', fontSize: 12, color: '#888', background: 'none', border: '1px solid #e0ded9', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>ログアウト</button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: '#eeece7', borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {[{ key: 'post', l: '今すぐ投稿' }, { key: 'schedule', l: 'スケジュール' }, { key: 'list', l: '予約一覧' }, { key: 'settings', l: '⚙ 設定' }].map(({ key, l }) => (
            <button key={key} onClick={() => { setTab(key as AppTab); setMessage(null); }} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === key ? 600 : 400, background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#1a1a1a' : '#666', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{l}</button>
          ))}
        </div>

        {message && <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 14, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`, color: message.type === 'success' ? '#166534' : '#991b1b' }}>{message.text}</div>}

        {/* ═══ SETTINGS ═══════════════════════════════════════════ */}
        {tab === 'settings' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e3de', padding: 28 }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Meta API 設定</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#888' }}>空欄のまま保存すると変更されません。</p>
            {sMasked && (
              <div style={{ background: sMasked.isConfigured ? '#f0fdf4' : '#fef2f2', border: `1px solid ${sMasked.isConfigured ? '#86efac' : '#fca5a5'}`, borderRadius: 9, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: sMasked.isConfigured ? '#166534' : '#991b1b' }}>
                {sMasked.isConfigured ? '✅ 設定済み — 投稿機能が使えます' : '⚠️ 未設定 — 下のフォームで設定してください'}
                {sMasked.isConfigured && <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#555', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>Token: {sMasked.facebookPageAccessToken}</span>
                  <span>Page ID: {sMasked.facebookPageId}</span>
                  <span>IG ID: {sMasked.instagramBusinessAccountId}</span>
                </div>}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div><label style={lbl}>Facebook Page Access Token</label><input type="password" placeholder="EAABxx..." value={sFbToken} onChange={e => setSFbToken(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Facebook Page ID</label><input type="text" placeholder="例: 123456789012345" value={sFbPageId} onChange={e => setSFbPageId(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Instagram Business Account ID</label><input type="text" placeholder="例: 17841400000000000" value={sIgId} onChange={e => setSIgId(e.target.value)} style={inp} /></div>
              {sMsg && <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: sMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${sMsg.type === 'success' ? '#86efac' : '#fca5a5'}`, color: sMsg.type === 'success' ? '#166534' : '#991b1b' }}>{sMsg.text}</div>}
              <button onClick={handleSaveSettings} disabled={sLoading} style={{ padding: 13, background: sLoading ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: sLoading ? 'not-allowed' : 'pointer' }}>{sLoading ? '保存中...' : '設定を保存する'}</button>
            </div>
          </div>
        )}

        {/* ═══ POST / SCHEDULE ════════════════════════════════════ */}
        {(tab === 'post' || tab === 'schedule') && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e3de', padding: 28 }}>
            {StepBar}

            {/* STEP 1: INPUT */}
            {step === 'input' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {MediaGrid}
                <div>
                  <label style={lbl}>投稿内容のメモ <span style={{ color: '#888', fontWeight: 400 }}>（AIへの指示）</span></label>
                  <textarea placeholder={`例：\n新商品のコーヒーを紹介したい。深煎りで香りが良く、朝の一杯に最適。価格は1,200円。`} value={contentMemo} onChange={e => setContentMemo(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical', height: 'auto', paddingTop: 10, lineHeight: 1.6 }} />
                </div>
                <div>
                  <label style={lbl}>投稿目的</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {GOAL_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setGoal(o.value)} style={{ padding: '12px 14px', borderRadius: 9, border: `1.5px solid ${goal === o.value ? '#1a1a1a' : '#e0ded9'}`, background: goal === o.value ? '#1a1a1a' : '#fafaf8', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{o.emoji}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: goal === o.value ? '#fff' : '#222' }}>{o.label}</div>
                        <div style={{ fontSize: 11, color: goal === o.value ? '#ccc' : '#888', marginTop: 2 }}>{o.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={lbl}>投稿タイプ</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['feed','story'] as PostType[]).map(t => <button key={t} onClick={() => setPostType(t)} style={tgl(postType === t)}>{t === 'feed' ? '📷 フィード' : '⏱ ストーリーズ'}</button>)}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>投稿先</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['instagram','facebook','both'] as Platform[]).map(p => <button key={p} onClick={() => setPlatform(p)} style={tgl(platform === p)}>{p === 'instagram' ? '📸 IG' : p === 'facebook' ? '👍 FB' : '🔀 両方'}</button>)}
                    </div>
                  </div>
                </div>
                <button onClick={handleGenerate} disabled={generating || !contentMemo.trim()} style={{ padding: 14, background: generating || !contentMemo.trim() ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: generating || !contentMemo.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {generating ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> AIがキャプションを生成中...</> : '✦ AIにキャプションを生成してもらう'}
                </button>
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {/* STEP 2: PREVIEW */}
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
                  {/* Preview panel */}
                  <div>
                    <label style={lbl}>プレビュー ({mediaItems.length}件)</label>
                    <div style={{ border: '1px solid #e5e3de', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                      {mediaItems[0] && (
                        mediaItems[0].mediaType === 'video'
                          ? <video src={mediaItems[0].preview} controls style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                          : <img src={mediaItems[0].preview} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                      )}
                      {mediaItems.length > 1 && (
                        <div style={{ display: 'flex', gap: 4, padding: 6, overflowX: 'auto' }}>
                          {mediaItems.slice(1).map(m => (
                            <div key={m.id} style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 4, overflow: 'hidden', border: '1px solid #e5e3de' }}>
                              {m.mediaType === 'video' ? <video src={m.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted /> : <img src={m.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ padding: '12px 14px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.6, wordBreak: 'break-word' }}>{caption}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#2563eb', lineHeight: 1.7, wordBreak: 'break-word' }}>{hashtags.join(' ')}</p>
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#999' }}>文字数：{(caption + '\n\n' + hashtags.join(' ')).length} 字</p>
                  </div>
                  {/* Edit panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={lbl}>キャプション編集</label>
                      <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={8} style={{ ...inp, resize: 'vertical', height: 'auto', paddingTop: 10, fontSize: 13, lineHeight: 1.6 }} />
                    </div>
                    <div>
                      <label style={lbl}>ハッシュタグ</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {hashtags.map(tag => (
                          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 10px', fontWeight: 500 }}>
                            {tag}<button onClick={() => setHashtags(h => h.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="text" placeholder="#タグを追加" value={hashtagInput} onChange={e => setHashtagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHashtag(); } }} style={{ ...inp, fontSize: 13 }} />
                        <button onClick={addHashtag} style={{ flexShrink: 0, padding: '0 14px', background: '#f3f2ef', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#555' }}>追加</button>
                      </div>
                    </div>
                    <button onClick={() => setStep('input')} style={{ padding: 8, background: 'none', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#555' }}>← 入力に戻る</button>
                  </div>
                </div>
                {tab === 'schedule' && (
                  <div>
                    <label style={lbl}>投稿日時</label>
                    <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={inp} min={new Date().toISOString().slice(0, 16)} />
                  </div>
                )}
                <button onClick={tab === 'post' ? handlePost : handleSchedule} disabled={loading || uploadingIdx !== null} style={{ padding: 14, background: loading || uploadingIdx !== null ? '#aaa' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: loading || uploadingIdx !== null ? 'not-allowed' : 'pointer' }}>
                  {uploadingIdx !== null ? `アップロード中 (${uploadingIdx + 1}/${mediaItems.length})...` : loading ? '処理中...' : tab === 'post' ? '今すぐ投稿する' : 'スケジュールに追加する'}
                </button>
              </div>
            )}

            {/* STEP 3: DONE */}
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

        {/* ═══ LIST ═══════════════════════════════════════════════ */}
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
                        {post.items && post.items.length > 1 && <span style={{ fontSize: 12, color: '#888', background: '#f3f2ef', padding: '2px 8px', borderRadius: 20 }}>{post.items.length}件</span>}
                      </div>
                      {post.caption && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.caption}</p>}
                      <p style={{ margin: 0, fontSize: 12, color: '#999' }}>📅 {new Date(post.scheduledAt).toLocaleString('ja-JP')}</p>
                      {post.error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>⚠ {post.error}</p>}
                    </div>
                    {post.status === 'scheduled' && (
                      <button onClick={() => handleDelete(post.id)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: '2px 4px' }}>✕</button>
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
