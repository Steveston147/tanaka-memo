"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  connectGoogleCalendar,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  disconnectGoogleCalendar,
  isGoogleCalendarConfigured,
  isGoogleCalendarConnected,
  updateGoogleCalendarEvent,
  type GoogleSyncStatus,
} from "../lib/google-calendar";

type Category = "idea" | "feature" | "improvement" | "bug";
type Priority = "normal" | "high";
type Status = "active" | "done";
type ScheduleType = "deadline" | "event";
type Memo = {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  createdAt: string;
  updatedAt?: string;
  status?: Status;
  pinned?: boolean;
  scheduleType?: ScheduleType;
  scheduleDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  syncToGoogle?: boolean;
  googleEventId?: string;
  googleEventUrl?: string;
  googleSyncStatus?: GoogleSyncStatus;
  googleSyncError?: string;
  googleLastSyncedAt?: string;
};
type Form = Pick<Memo, "title" | "description" | "category" | "priority" | "scheduleType" | "scheduleDate" | "startTime" | "endTime" | "allDay" | "syncToGoogle">;

type IconName = "spark" | "plus" | "search" | "pin" | "check" | "edit" | "trash" | "close" | "list" | "grid" | "inbox" | "clock" | "calendar" | "refresh" | "link";

const STORAGE_KEY = "tanaka-memo-items";
const initialForm: Form = { title: "", description: "", category: "idea", priority: "normal", scheduleType: "deadline", scheduleDate: "", startTime: "", endTime: "", allDay: false, syncToGoogle: false };
const categories: { value: Category; label: string; colour: string }[] = [
  { value: "idea", label: "アイデア", colour: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "feature", label: "機能追加", colour: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "improvement", label: "改善", colour: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "bug", label: "不具合", colour: "bg-rose-50 text-rose-700 ring-rose-200" },
];

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    spark: <path d="m12 3-1.2 4.1L7 8.5l3.8 1.4L12 14l1.2-4.1L17 8.5l-3.8-1.4L12 3Z" />,
    plus: <path d="M12 5v14M5 12h14" />, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    pin: <path d="m14 4 6 6-3 1-4 4-1 5-6-6 5-1 4-4 1-3-2-2ZM6 18l-3 3" />,
    check: <path d="m5 12 4 4L19 6" />, edit: <path d="M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></>, close: <path d="m6 6 12 12M18 6 6 18"/>,
    list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>, grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    inbox: <><path d="M4 5h16l2 10v4H2v-4L4 5Z"/><path d="M2 15h6l2 2h4l2-2h6"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>, refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/></>, link: <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>,
  };
  return <svg viewBox="0 0 24 24" fill={name === "spark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function createId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function validMemo(value: unknown): value is Memo { const m = value as Partial<Memo>; return !!m && typeof m.id === "string" && typeof m.title === "string" && typeof m.description === "string" && ["idea","feature","improvement","bug"].includes(m.category || "") && ["normal","high"].includes(m.priority || "") && typeof m.createdAt === "string"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function categoryMeta(value: Category) { return categories.find(c => c.value === value)!; }
function scheduleTimestamp(memo: Memo) { if (!memo.scheduleDate) return Number.POSITIVE_INFINITY; return +new Date(`${memo.scheduleDate}T${memo.allDay || !memo.startTime ? "23:59" : memo.startTime}:00`); }
function formatSchedule(memo: Memo) { if (!memo.scheduleDate) return ""; const date = new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${memo.scheduleDate}T00:00:00`)); const time = memo.allDay ? "終日" : [memo.startTime, memo.endTime].filter(Boolean).join("〜"); return `${memo.scheduleType === "event" ? "実施" : "期限"}：${date}${time ? ` ${time}` : ""}`; }
function scheduleTone(memo: Memo) { if (!memo.scheduleDate || (memo.status || "active") === "done") return "bg-slate-50 text-slate-600 ring-slate-200"; const today = new Date(); today.setHours(0,0,0,0); const days = Math.round((new Date(`${memo.scheduleDate}T00:00:00`).getTime() - today.getTime()) / 86400000); if (days < 0) return "bg-rose-50 text-rose-700 ring-rose-200"; if (days <= 1) return "bg-amber-50 text-amber-700 ring-amber-200"; return "bg-indigo-50 text-indigo-700 ring-indigo-200"; }
function syncLabel(memo: Memo) { if (!memo.syncToGoogle) return null; if (memo.googleSyncStatus === "synced") return ["Google同期済み", "bg-emerald-50 text-emerald-700 ring-emerald-200"]; if (memo.googleSyncStatus === "error") return ["Google同期エラー", "bg-rose-50 text-rose-700 ring-rose-200"]; if (memo.googleSyncStatus === "pending") return ["Google同期中", "bg-amber-50 text-amber-700 ring-amber-200"]; return ["Google未同期", "bg-slate-50 text-slate-600 ring-slate-200"]; }

export default function Home() {
  const [memos, setMemos] = useState<Memo[]>([]); const [form, setForm] = useState<Form>(initialForm); const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Memo | null>(null); const [query, setQuery] = useState(""); const [category, setCategory] = useState<"all" | Category>("all");
  const [status, setStatus] = useState<"all" | Status>("active"); const [sort, setSort] = useState<"new" | "old" | "priority" | "schedule">("new"); const [view, setView] = useState<"cards" | "compact">("cards");
  const [notice, setNotice] = useState(""); const [googleConnected, setGoogleConnected] = useState(false); const [googleBusy, setGoogleBusy] = useState(false); const titleRef = useRef<HTMLInputElement>(null);
  const googleConfigured = isGoogleCalendarConfigured();

  useEffect(() => { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); if (Array.isArray(parsed)) setMemos(parsed.filter(validMemo)); } catch {} setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(memos)); }, [loaded, memos]);
  useEffect(() => { const handler = (e: globalThis.KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("memo-search")?.focus(); } if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (document.getElementById("memo-form") as HTMLFormElement | null)?.requestSubmit(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const patchMemo = (id: string, patch: Partial<Memo>) => setMemos(current => current.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m));
  const connectGoogle = async () => { setGoogleBusy(true); try { await connectGoogleCalendar(); setGoogleConnected(true); flash("Google Calendarに接続しました"); } catch (error) { flash(error instanceof Error ? error.message : "Google Calendarに接続できませんでした"); } finally { setGoogleBusy(false); } };
  const disconnectGoogle = () => { disconnectGoogleCalendar(); setGoogleConnected(false); flash("Google Calendarとの接続を解除しました"); };
  const syncMemo = async (memo: Memo) => {
    if (!memo.scheduleDate) return patchMemo(memo.id, { googleSyncStatus: "error", googleSyncError: "日付が必要です" });
    if (!isGoogleCalendarConnected()) { setGoogleConnected(false); return patchMemo(memo.id, { googleSyncStatus: "error", googleSyncError: "Google Calendarに接続してください" }); }
    patchMemo(memo.id, { googleSyncStatus: "pending", googleSyncError: undefined });
    try {
      const result = memo.googleEventId ? await updateGoogleCalendarEvent(memo.googleEventId, memo) : await createGoogleCalendarEvent(memo);
      patchMemo(memo.id, { googleEventId: result.id, googleEventUrl: result.htmlLink, googleSyncStatus: "synced", googleSyncError: undefined, googleLastSyncedAt: new Date().toISOString() });
      flash("Google Calendarへ反映しました");
    } catch (error) { patchMemo(memo.id, { googleSyncStatus: "error", googleSyncError: error instanceof Error ? error.message : "同期に失敗しました" }); if (!isGoogleCalendarConnected()) setGoogleConnected(false); }
  };
  const saveMemo = async (event: FormEvent) => {
    event.preventDefault(); const title = form.title.trim(); if (!title) return titleRef.current?.focus();
    const memo: Memo = { ...form, title, description: form.description.trim(), id: createId(), createdAt: new Date().toISOString(), status: "active", pinned: false, googleSyncStatus: form.syncToGoogle ? "not-synced" : undefined };
    setMemos(current => [memo, ...current]); setForm(initialForm); flash("メモを保存しました"); titleRef.current?.focus();
    if (memo.syncToGoogle) await syncMemo(memo);
  };
  const updateMemo = async (event: FormEvent) => {
    event.preventDefault(); if (!editing?.title.trim()) return;
    const next = { ...editing, title: editing.title.trim(), description: editing.description.trim(), updatedAt: new Date().toISOString() };
    setMemos(current => current.map(m => m.id === next.id ? next : m)); setEditing(null); flash("変更を保存しました");
    if (next.syncToGoogle) await syncMemo(next);
  };
  const removeMemo = async (memo: Memo) => {
    if (!confirm(`「${memo.title}」を削除しますか？`)) return;
    if (memo.googleEventId && confirm("Google Calendarの予定も削除しますか？")) { try { await deleteGoogleCalendarEvent(memo.googleEventId); } catch (error) { flash(error instanceof Error ? `Google側の削除に失敗：${error.message}` : "Google側の削除に失敗しました"); return; } }
    setMemos(current => current.filter(m => m.id !== memo.id)); flash("メモを削除しました");
  };
  const filtered = useMemo(() => memos.filter(m => { const q = query.trim().toLowerCase(); return (!q || `${m.title} ${m.description}`.toLowerCase().includes(q)) && (category === "all" || m.category === category) && (status === "all" || (m.status || "active") === status); }).sort((a,b) => { if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1; if (sort === "priority" && a.priority !== b.priority) return a.priority === "high" ? -1 : 1; if (sort === "schedule") return scheduleTimestamp(a) - scheduleTimestamp(b); return sort === "old" ? +new Date(a.createdAt) - +new Date(b.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt); }), [memos, query, category, status, sort]);
  const active = memos.filter(m => (m.status || "active") === "active").length; const high = memos.filter(m => (m.status || "active") === "active" && m.priority === "high").length; const done = memos.length - active;

  return <main className="app-shell min-h-screen pb-20">
    <header className="glass sticky top-0 z-30 border-b border-slate-200/80"><div className="mx-auto flex min-h-16 max-w-[1480px] items-center justify-between gap-3 px-4 py-2 sm:px-7">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-200"><Icon name="spark" /></div><div><h1 className="text-[17px] font-bold tracking-tight text-slate-900">Work Board</h1><p className="text-[11px] font-medium tracking-wide text-slate-400">IDEAS INTO ACTION</p></div></div>
      <div className="flex items-center gap-2"><span className="hidden text-xs text-slate-500 sm:inline">{loaded ? "この端末に自動保存中" : "読み込み中"}</span>{googleConfigured ? googleConnected ? <button onClick={disconnectGoogle} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Google接続済み</button> : <button onClick={connectGoogle} disabled={googleBusy} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"><Icon name="calendar" className="mr-1 inline h-4 w-4"/>{googleBusy ? "接続中" : "Google Calendarに接続"}</button> : <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-200">Google設定待ち</span>}</div>
    </div></header>
    <div className="mx-auto max-w-[1480px] px-4 pt-7 sm:px-7 sm:pt-10">
      <section className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="mb-2 text-sm font-semibold text-indigo-600">WORKSPACE</p><h2 className="text-3xl font-bold tracking-[-.035em] text-slate-950 sm:text-4xl">気づきを、次のアクションへ。</h2><p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">予定をWork Boardで管理し、必要なものだけGoogle Calendarへ反映。</p></div><div className="grid grid-cols-3 gap-2 sm:gap-3">{[["対応中",active,"text-indigo-600","bg-indigo-50"],["優先度 高",high,"text-rose-600","bg-rose-50"],["完了",done,"text-emerald-600","bg-emerald-50"]].map(([label,count,colour,bg]) => <div key={String(label)} className={`min-w-[92px] rounded-2xl ${bg} px-4 py-3 sm:min-w-[120px]`}><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${colour}`}>{count}</p></div>)}</div></section>
      <div className="grid items-start gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="panel rounded-[24px] p-5 lg:sticky lg:top-24 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><Icon name="plus" /></span><div><h3 className="font-bold text-slate-900">新しいメモ</h3><p className="text-xs text-slate-400">思いついた瞬間に記録</p></div></div>
          <form id="memo-form" onSubmit={saveMemo} className="space-y-4"><div><label className="mb-1.5 block text-xs font-bold text-slate-600">タイトル <span className="text-rose-500">*</span></label><input ref={titleRef} className="field" value={form.title} maxLength={100} onChange={e=>setForm({...form,title:e.target.value})} placeholder="何を改善したいですか？" /></div>
            <div><div className="mb-1.5 flex justify-between"><label className="text-xs font-bold text-slate-600">詳細メモ</label><span className="text-[11px] text-slate-400">{form.description.length}/1000</span></div><textarea className="field min-h-32 resize-y leading-6" maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="状況、困っている点、思いついた解決策など…" /></div>
            <div><label className="mb-2 block text-xs font-bold text-slate-600">カテゴリー</label><div className="grid grid-cols-2 gap-2">{categories.map(c=><button type="button" key={c.value} onClick={()=>setForm({...form,category:c.value})} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${form.category===c.value ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-600"}`}>{c.label}</button>)}</div></div>
            <div><label className="mb-2 block text-xs font-bold text-slate-600">優先度</label><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>setForm({...form,priority:"normal"})} className={`rounded-lg py-2 text-xs font-semibold ${form.priority==="normal"?"bg-white text-slate-800 shadow-sm":"text-slate-500"}`}>通常</button><button type="button" onClick={()=>setForm({...form,priority:"high"})} className={`rounded-lg py-2 text-xs font-semibold ${form.priority==="high"?"bg-white text-rose-600 shadow-sm":"text-slate-500"}`}>高</button></div></div>
            <ScheduleFields value={form} onChange={setForm} />
            <label className={`flex items-start gap-3 rounded-2xl border p-3.5 ${form.scheduleDate ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50 opacity-60"}`}><input type="checkbox" className="mt-0.5" checked={!!form.syncToGoogle} disabled={!form.scheduleDate} onChange={e=>setForm({...form,syncToGoogle:e.target.checked})}/><span><span className="block text-xs font-bold text-slate-700">Google Calendarへ反映</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">日付のある予定だけ選択できます。接続していない場合もWork Boardには保存されます。</span></span></label>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200"><Icon name="plus" className="h-4 w-4" />メモを登録</button>
          </form></aside>
        <section className="min-w-0"><div className="panel rounded-[24px] p-4 sm:p-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative flex-1"><Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input id="memo-search" value={query} onChange={e=>setQuery(e.target.value)} className="field !pl-10" placeholder="メモを検索…"/></div><div className="flex flex-wrap gap-2"><select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="field !w-auto !py-2.5 text-xs font-semibold"><option value="active">対応中</option><option value="done">完了</option><option value="all">すべて</option></select><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="field !w-auto !py-2.5 text-xs font-semibold"><option value="new">新しい順</option><option value="old">古い順</option><option value="priority">優先度順</option><option value="schedule">日付が近い順</option></select><div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1"><button onClick={()=>setView("cards")} className={`rounded-lg p-2 ${view==="cards"?"bg-white text-indigo-600 shadow-sm":"text-slate-400"}`}><Icon name="grid" className="h-4 w-4"/></button><button onClick={()=>setView("compact")} className={`rounded-lg p-2 ${view==="compact"?"bg-white text-indigo-600 shadow-sm":"text-slate-400"}`}><Icon name="list" className="h-4 w-4"/></button></div></div></div><div className="scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">{[{value:"all",label:"すべて"},...categories].map(c=><button key={c.value} onClick={()=>setCategory(c.value as typeof category)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ${category===c.value?"bg-slate-900 text-white":"bg-slate-100 text-slate-500"}`}>{c.label}</button>)}</div></div>
          <div className="mb-3 mt-5 px-1 text-sm font-bold text-slate-700">メモ一覧 <span className="ml-1 font-medium text-slate-400">{filtered.length}件</span></div>
          {filtered.length===0 ? <div className="panel flex min-h-72 flex-col items-center justify-center rounded-[24px] p-8 text-center"><Icon name="inbox" className="mb-4 h-8 w-8 text-slate-400"/><h3 className="font-bold text-slate-800">該当するメモはありません</h3></div> : <div className={view==="cards"?"grid gap-3 xl:grid-cols-2":"space-y-2"}>{filtered.map(m=><MemoCard key={m.id} memo={m} compact={view==="compact"} onEdit={()=>setEditing({...m})} onDelete={()=>removeMemo(m)} onPatch={patch=>patchMemo(m.id,patch)} onSync={()=>syncMemo(m)} />)}</div>}
        </section>
      </div>
    </div>
    {editing&&<EditModal memo={editing} onChange={setEditing} onCancel={()=>setEditing(null)} onSubmit={updateMemo} />}
    {notice&&<div className="animate-pop fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl">{notice}</div>}
  </main>;
}

function ScheduleFields({ value, onChange }: { value: Form | Memo; onChange: (next: any) => void }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5"><div className="mb-3 flex items-center justify-between"><label className="text-xs font-bold text-slate-600">日付・時間 <span className="font-normal text-slate-400">（任意）</span></label>{value.scheduleDate&&<button type="button" onClick={()=>onChange({...value,scheduleDate:"",startTime:"",endTime:"",allDay:false,syncToGoogle:false})} className="text-[11px] font-semibold text-rose-600">日付をクリア</button>}</div><div className="grid grid-cols-2 gap-2"><select className="field !py-2.5 text-xs" value={value.scheduleType||"deadline"} onChange={e=>onChange({...value,scheduleType:e.target.value as ScheduleType})}><option value="deadline">期限</option><option value="event">実施日</option></select><input type="date" className="field !py-2.5 text-xs" value={value.scheduleDate||""} onChange={e=>onChange({...value,scheduleDate:e.target.value})}/></div>{value.scheduleDate&&<><label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!value.allDay} onChange={e=>onChange({...value,allDay:e.target.checked,startTime:e.target.checked?"":value.startTime,endTime:e.target.checked?"":value.endTime})}/>終日</label>{!value.allDay&&<div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><input type="time" className="field !py-2.5 text-xs" value={value.startTime||""} onChange={e=>onChange({...value,startTime:e.target.value})}/><span className="text-xs text-slate-400">〜</span><input type="time" className="field !py-2.5 text-xs" value={value.endTime||""} onChange={e=>onChange({...value,endTime:e.target.value})}/></div>}</>}</div>;
}

function EditModal({ memo, onChange, onCancel, onSubmit }: { memo: Memo; onChange:(memo:Memo)=>void; onCancel:()=>void; onSubmit:(event:FormEvent)=>void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 backdrop-blur-sm sm:items-center sm:p-5"><form onSubmit={onSubmit} className="w-full max-w-xl rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]"><div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-bold">メモを編集</h3><button type="button" onClick={onCancel}><Icon name="close"/></button></div><div className="space-y-4"><input autoFocus className="field" value={memo.title} onChange={e=>onChange({...memo,title:e.target.value})}/><textarea className="field min-h-32" value={memo.description} onChange={e=>onChange({...memo,description:e.target.value})}/><div className="grid grid-cols-2 gap-3"><select className="field" value={memo.category} onChange={e=>onChange({...memo,category:e.target.value as Category})}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select><select className="field" value={memo.priority} onChange={e=>onChange({...memo,priority:e.target.value as Priority})}><option value="normal">優先度：通常</option><option value="high">優先度：高</option></select></div><ScheduleFields value={memo} onChange={onChange}/>{memo.scheduleDate&&<label className="flex items-center gap-2 text-xs font-bold text-slate-700"><input type="checkbox" checked={!!memo.syncToGoogle} onChange={e=>onChange({...memo,syncToGoogle:e.target.checked,googleSyncStatus:e.target.checked ? memo.googleSyncStatus||"not-synced" : undefined})}/>Google Calendarへ反映</label>}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500">キャンセル</button><button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">変更を保存</button></div></form></div>;
}

function MemoCard({ memo, compact, onEdit, onDelete, onPatch, onSync }: { memo: Memo; compact: boolean; onEdit:()=>void; onDelete:()=>void; onPatch:(patch:Partial<Memo>)=>void; onSync:()=>void }) {
  const meta=categoryMeta(memo.category); const done=(memo.status||"active")==="done"; const sync=syncLabel(memo);
  const action=(label:string, icon:IconName, fn:()=>void, active=false)=><button type="button" aria-label={label} title={label} onClick={fn} className={`rounded-lg p-2 ${active?"bg-indigo-50 text-indigo-600":"text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}><Icon name={icon} className="h-4 w-4"/></button>;
  return <article className={`memo-card panel rounded-[20px] ${compact?"p-4":"p-5"} ${done?"opacity-65":""} ${memo.priority==="high"&&!done?"border-l-[3px] border-l-rose-500":""}`}><div className="flex gap-3"><button onClick={()=>onPatch({status:done?"active":"done"})} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${done?"border-emerald-500 bg-emerald-500 text-white":"border-slate-300 text-transparent"}`}><Icon name="check" className="h-3.5 w-3.5"/></button><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className={`font-bold leading-6 text-slate-900 ${done?"line-through":""}`}>{memo.title}</h3><div className="-mr-2 -mt-2 flex">{action("ピン留め","pin",()=>onPatch({pinned:!memo.pinned}),memo.pinned)}{memo.syncToGoogle&&action("再同期","refresh",onSync)}{action("編集","edit",onEdit)}{action("削除","trash",onDelete)}</div></div>{!compact&&<p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{memo.description||"詳細メモなし"}</p>}<div className={`${compact?"mt-2":"mt-4"} flex flex-wrap items-center gap-2`}><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${meta.colour}`}>{meta.label}</span>{memo.scheduleDate&&<span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${scheduleTone(memo)}`}>{formatSchedule(memo)}</span>}{sync&&<span title={memo.googleSyncError} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${sync[1]}`}>{sync[0]}</span>}{memo.googleEventUrl&&<a href={memo.googleEventUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600"><Icon name="link" className="mr-1 inline h-3 w-3"/>Googleで開く</a>}<span className="ml-auto flex items-center gap-1 text-[10px] text-slate-400"><Icon name="clock" className="h-3 w-3"/>{formatDate(memo.updatedAt||memo.createdAt)}</span></div></div></div></article>;
}
