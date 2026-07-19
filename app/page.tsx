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
type DateFilter = "all" | "overdue" | "today" | "week" | "unscheduled";
type Screen = "board" | "trash";

type Memo = {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
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
type IconName = "spark" | "plus" | "search" | "pin" | "check" | "edit" | "trash" | "close" | "list" | "grid" | "inbox" | "clock" | "calendar" | "refresh" | "link" | "download" | "upload" | "undo";

const STORAGE_KEY = "tanaka-memo-items";
const initialForm: Form = { title: "", description: "", category: "idea", priority: "normal", scheduleType: "deadline", scheduleDate: "", startTime: "", endTime: "", allDay: false, syncToGoogle: false };
const categories: { value: Category; label: string; colour: string }[] = [
  { value: "idea", label: "アイデア", colour: "bg-violet-50 text-violet-700 ring-violet-200" },
  { value: "feature", label: "機能追加", colour: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "improvement", label: "改善", colour: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "bug", label: "不具合", colour: "bg-rose-50 text-rose-700 ring-rose-200" },
];
const dateFilters: { value: DateFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "overdue", label: "期限切れ" },
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "unscheduled", label: "日付なし" },
];

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    spark: <path d="m12 3-1.2 4.1L7 8.5l3.8 1.4L12 14l1.2-4.1L17 8.5l-3.8-1.4L12 3Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    pin: <path d="m14 4 6 6-3 1-4 4-1 5-6-6 5-1 4-4 1-3-2-2ZM6 18l-3 3" />,
    check: <path d="m5 12 4 4L19 6" />,
    edit: <path d="M4 20l4.5-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z"/>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    inbox: <><path d="M4 5h16l2 10v4H2v-4L4 5Z"/><path d="M2 15h6l2 2h4l2-2h6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/></>,
    link: <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    upload: <><path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/></>,
    undo: <><path d="M9 7 4 12l5 5"/><path d="M20 17a8 8 0 0 0-11-5H4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill={name === "spark" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

function createId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function validMemo(value: unknown): value is Memo { const m = value as Partial<Memo>; return !!m && typeof m.id === "string" && typeof m.title === "string" && typeof m.description === "string" && ["idea","feature","improvement","bug"].includes(m.category || "") && ["normal","high"].includes(m.priority || "") && typeof m.createdAt === "string"; }
function localDateKey(date: Date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0"); const d = String(date.getDate()).padStart(2, "0"); return `${y}-${m}-${d}`; }
function isActive(memo: Memo) { return !memo.deletedAt && (memo.status || "active") === "active"; }
function matchesDateFilter(memo: Memo, filter: DateFilter) {
  if (filter === "all") return true;
  if (filter === "unscheduled") return !memo.scheduleDate;
  if (!memo.scheduleDate) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const memoDate = new Date(`${memo.scheduleDate}T00:00:00`);
  if (filter === "overdue") return isActive(memo) && memoDate < today;
  if (filter === "today") return memo.scheduleDate === localDateKey(today);
  const end = new Date(today); end.setDate(today.getDate() + 6);
  return memoDate >= today && memoDate <= end;
}
function categoryMeta(value: Category) { return categories.find(c => c.value === value)!; }
function scheduleTimestamp(memo: Memo) { return memo.scheduleDate ? +new Date(`${memo.scheduleDate}T${memo.allDay || !memo.startTime ? "23:59" : memo.startTime}:00`) : Number.POSITIVE_INFINITY; }
function formatSchedule(memo: Memo) { if (!memo.scheduleDate) return ""; const date = new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${memo.scheduleDate}T00:00:00`)); const time = memo.allDay ? "終日" : [memo.startTime, memo.endTime].filter(Boolean).join("〜"); return `${memo.scheduleType === "event" ? "実施" : "期限"}：${date}${time ? ` ${time}` : ""}`; }
function scheduleTone(memo: Memo) { if (!memo.scheduleDate || !isActive(memo)) return "bg-slate-50 text-slate-600 ring-slate-200"; const today = new Date(); today.setHours(0,0,0,0); const days = Math.round((new Date(`${memo.scheduleDate}T00:00:00`).getTime() - today.getTime()) / 86400000); if (days < 0) return "bg-rose-50 text-rose-700 ring-rose-200"; if (days <= 1) return "bg-amber-50 text-amber-700 ring-amber-200"; return "bg-indigo-50 text-indigo-700 ring-indigo-200"; }

export default function Home() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [form, setForm] = useState<Form>(initialForm);
  const [editing, setEditing] = useState<Memo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [status, setStatus] = useState<"all" | Status>("active");
  const [sort, setSort] = useState<"new" | "old" | "priority" | "schedule">("new");
  const [view, setView] = useState<"cards" | "compact">("cards");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [screen, setScreen] = useState<Screen>("board");
  const [notice, setNotice] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const googleConfigured = isGoogleCalendarConfigured();

  useEffect(() => { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); if (Array.isArray(parsed)) setMemos(parsed.filter(validMemo)); } catch {} setGoogleConnected(isGoogleCalendarConnected()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(memos)); }, [loaded, memos]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2800); };
  const patchMemo = (id: string, patch: Partial<Memo>) => setMemos(current => current.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m));
  const connectGoogle = async () => { setGoogleBusy(true); try { await connectGoogleCalendar(); setGoogleConnected(true); flash("Google Calendarに接続しました"); } catch (error) { flash(error instanceof Error ? error.message : "接続できませんでした"); } finally { setGoogleBusy(false); } };
  const disconnectGoogle = () => { disconnectGoogleCalendar(); setGoogleConnected(false); flash("Google Calendarとの接続を解除しました"); };
  const syncMemo = async (memo: Memo) => { if (!memo.scheduleDate) return patchMemo(memo.id, { googleSyncStatus: "error", googleSyncError: "日付が必要です" }); if (!isGoogleCalendarConnected()) return flash("Google Calendarに接続してください"); patchMemo(memo.id, { googleSyncStatus: "pending", googleSyncError: undefined }); try { const result = memo.googleEventId ? await updateGoogleCalendarEvent(memo.googleEventId, memo) : await createGoogleCalendarEvent(memo); patchMemo(memo.id, { googleEventId: result.id, googleEventUrl: result.htmlLink, googleSyncStatus: "synced", googleSyncError: undefined, googleLastSyncedAt: new Date().toISOString() }); flash("Google Calendarへ反映しました"); } catch (error) { patchMemo(memo.id, { googleSyncStatus: "error", googleSyncError: error instanceof Error ? error.message : "同期に失敗しました" }); } };
  const saveMemo = async (event: FormEvent) => { event.preventDefault(); const title = form.title.trim(); if (!title) return titleRef.current?.focus(); const memo: Memo = { ...form, title, description: form.description.trim(), id: createId(), createdAt: new Date().toISOString(), status: "active", pinned: false, googleSyncStatus: form.syncToGoogle ? "not-synced" : undefined }; setMemos(current => [memo, ...current]); setForm(initialForm); flash("メモを保存しました"); if (memo.syncToGoogle) await syncMemo(memo); };
  const updateMemo = async (event: FormEvent) => { event.preventDefault(); if (!editing?.title.trim()) return; const next = { ...editing, title: editing.title.trim(), description: editing.description.trim(), updatedAt: new Date().toISOString() }; setMemos(current => current.map(m => m.id === next.id ? next : m)); setEditing(null); flash("変更を保存しました"); if (next.syncToGoogle) await syncMemo(next); };
  const moveToTrash = (memo: Memo) => { if (!confirm(`「${memo.title}」をゴミ箱へ移動しますか？\nあとから元に戻せます。`)) return; patchMemo(memo.id, { deletedAt: new Date().toISOString() }); flash("ゴミ箱へ移動しました"); };
  const restoreMemo = (memo: Memo) => { patchMemo(memo.id, { deletedAt: undefined }); flash("メモを元に戻しました"); };
  const permanentlyDelete = async (memo: Memo) => { if (!confirm(`「${memo.title}」を完全に削除しますか？\nこの操作は取り消せません。`)) return; if (memo.googleEventId && confirm("Google Calendarの予定も削除しますか？")) { try { await deleteGoogleCalendarEvent(memo.googleEventId); } catch { return flash("Google Calendar側の削除に失敗しました"); } } setMemos(current => current.filter(m => m.id !== memo.id)); flash("完全に削除しました"); };
  const emptyTrash = () => { const count = memos.filter(m => m.deletedAt).length; if (!count || !confirm(`ゴミ箱の${count}件をすべて完全に削除しますか？`)) return; setMemos(current => current.filter(m => !m.deletedAt)); flash("ゴミ箱を空にしました"); };
  const exportBackup = () => { const blob = new Blob([JSON.stringify(memos, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `work-board-${localDateKey(new Date())}.json`; a.click(); URL.revokeObjectURL(url); flash("バックアップを書き出しました"); };
  const readBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return null; const parsed: unknown = JSON.parse(await file.text()); if (!Array.isArray(parsed)) throw new Error(); const imported = parsed.filter(validMemo); if (!imported.length && parsed.length) throw new Error(); return imported; };
  const importMemos = async (event: React.ChangeEvent<HTMLInputElement>) => { try { const imported = await readBackupFile(event); if (!imported) return; const ids = new Set(memos.map(m => m.id)); const added = imported.filter(m => !ids.has(m.id)).length; if (!confirm(`${imported.length}件を追加・更新します。\n新規 ${added}件・更新 ${imported.length - added}件`)) return; setMemos(current => { const byId = new Map(imported.map(m => [m.id, m])); const merged = current.map(m => byId.get(m.id) ?? m); const currentIds = new Set(current.map(m => m.id)); return [...imported.filter(m => !currentIds.has(m.id)), ...merged]; }); flash("追加・更新が完了しました"); } catch { flash("正しいバックアップファイルではありません"); } };
  const restoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => { try { const imported = await readBackupFile(event); if (!imported) return; if (!confirm(`${imported.length}件を全復元します。\n現在のデータはすべて置き換えられます。`)) return; setMemos(imported); flash("全復元が完了しました"); } catch { flash("正しいバックアップファイルではありません"); } };

  const liveMemos = memos.filter(m => !m.deletedAt);
  const trashMemos = memos.filter(m => !!m.deletedAt).sort((a,b) => +(new Date(b.deletedAt!)) - +(new Date(a.deletedAt!)));
  const active = liveMemos.filter(isActive).length;
  const high = liveMemos.filter(m => isActive(m) && m.priority === "high").length;
  const overdue = liveMemos.filter(m => matchesDateFilter(m, "overdue")).length;
  const today = liveMemos.filter(m => isActive(m) && matchesDateFilter(m, "today")).length;
  const week = liveMemos.filter(m => isActive(m) && matchesDateFilter(m, "week")).length;
  const syncErrors = liveMemos.filter(m => m.googleSyncStatus === "error").length;
  const filtered = useMemo(() => liveMemos.filter(m => { const q = query.trim().toLowerCase(); return (!q || `${m.title} ${m.description}`.toLowerCase().includes(q)) && (category === "all" || m.category === category) && (status === "all" || (m.status || "active") === status) && matchesDateFilter(m, dateFilter); }).sort((a,b) => { if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1; if (sort === "priority" && a.priority !== b.priority) return a.priority === "high" ? -1 : 1; if (sort === "schedule") return scheduleTimestamp(a) - scheduleTimestamp(b); return sort === "old" ? +new Date(a.createdAt) - +new Date(b.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt); }), [liveMemos, query, category, status, sort, dateFilter]);
  const chooseDashboard = (filter: DateFilter) => { setScreen("board"); setStatus("active"); setDateFilter(filter); window.setTimeout(() => document.getElementById("memo-list")?.scrollIntoView({ behavior: "smooth" }), 20); };

  return <main className="app-shell min-h-screen pb-20">
    <header className="glass sticky top-0 z-30 border-b border-slate-200/80"><div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-3 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-200"><Icon name="spark" /></div><div><h1 className="text-[17px] font-bold tracking-tight text-slate-900">Work Board</h1><p className="text-[10px] font-semibold leading-4 tracking-wide text-slate-500">Ritsumeikan Study Abroad Centre</p><p className="text-[9px] font-medium tracking-[.14em] text-slate-400">IDEAS INTO ACTION</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><button onClick={exportBackup} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">保存</button><button onClick={()=>importRef.current?.click()} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">追加・更新</button><input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={importMemos}/><button onClick={()=>restoreRef.current?.click()} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-600 ring-1 ring-rose-200">全復元</button><input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={restoreBackup}/>{googleConfigured ? googleConnected ? <button onClick={disconnectGoogle} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">Google接続済み</button> : <button onClick={connectGoogle} disabled={googleBusy} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{googleBusy ? "接続中" : "Google接続"}</button> : <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-200">Google設定待ち</span>}</div>
    </div></header>

    <div className="mx-auto max-w-[1480px] px-4 pt-6 sm:px-7 sm:pt-9">
      <section className="mb-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-semibold text-indigo-600">DAILY OVERVIEW</p><h2 className="text-3xl font-bold tracking-[-.035em] text-slate-950 sm:text-4xl">今日やることを、迷わず。</h2><p className="mt-2 text-sm leading-6 text-slate-500">開いた瞬間に、今日・期限切れ・今週の状況を確認できます。</p></div><div className="flex rounded-xl bg-slate-100 p-1"><button onClick={()=>setScreen("board")} className={`rounded-lg px-4 py-2 text-xs font-bold ${screen === "board" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>Work Board</button><button onClick={()=>setScreen("trash")} className={`rounded-lg px-4 py-2 text-xs font-bold ${screen === "trash" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500"}`}>ゴミ箱 {trashMemos.length}</button></div></div></section>

      {screen === "board" ? <>
        <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[{label:"今日",count:today,filter:"today" as DateFilter,tone:"text-blue-700 bg-blue-50"},{label:"期限切れ",count:overdue,filter:"overdue" as DateFilter,tone:"text-rose-700 bg-rose-50"},{label:"今週",count:week,filter:"week" as DateFilter,tone:"text-indigo-700 bg-indigo-50"},{label:"対応中",count:active,filter:"all" as DateFilter,tone:"text-slate-800 bg-white"}].map(item=><button key={item.label} onClick={()=>chooseDashboard(item.filter)} className={`rounded-2xl p-4 text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md ${item.tone}`}><p className="text-xs font-bold opacity-70">{item.label}</p><p className="mt-1 text-3xl font-bold">{item.count}</p></button>)}
          <button onClick={()=>{setStatus("active");setDateFilter("all");setSort("priority");}} className="rounded-2xl bg-amber-50 p-4 text-left text-amber-800 ring-1 ring-amber-200"><p className="text-xs font-bold opacity-70">優先度 高</p><p className="mt-1 text-3xl font-bold">{high}</p></button>
          <div className={`rounded-2xl p-4 ring-1 ${syncErrors ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}><p className="text-xs font-bold opacity-70">Google同期エラー</p><p className="mt-1 text-3xl font-bold">{syncErrors}</p></div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="panel rounded-[24px] p-5 lg:sticky lg:top-28 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><Icon name="plus" /></span><div><h3 className="font-bold text-slate-900">新しいメモ</h3><p className="text-xs text-slate-400">思いついた瞬間に記録</p></div></div>
            <form onSubmit={saveMemo} className="space-y-4"><input ref={titleRef} className="field" value={form.title} maxLength={100} onChange={e=>setForm({...form,title:e.target.value})} placeholder="タイトル"/><textarea className="field min-h-28 resize-y leading-6" value={form.description} maxLength={1000} onChange={e=>setForm({...form,description:e.target.value})} placeholder="詳細メモ"/><div className="grid grid-cols-2 gap-2">{categories.map(c=><button type="button" key={c.value} onClick={()=>setForm({...form,category:c.value})} className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${form.category===c.value ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-600"}`}>{c.label}</button>)}</div><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>setForm({...form,priority:"normal"})} className={`rounded-lg py-2 text-xs font-semibold ${form.priority==="normal"?"bg-white shadow-sm":"text-slate-500"}`}>通常</button><button type="button" onClick={()=>setForm({...form,priority:"high"})} className={`rounded-lg py-2 text-xs font-semibold ${form.priority==="high"?"bg-white text-rose-600 shadow-sm":"text-slate-500"}`}>高</button></div><div className="grid grid-cols-2 gap-2"><select className="field" value={form.scheduleType} onChange={e=>setForm({...form,scheduleType:e.target.value as ScheduleType})}><option value="deadline">期限</option><option value="event">予定</option></select><input className="field" type="date" value={form.scheduleDate} onChange={e=>setForm({...form,scheduleDate:e.target.value})}/></div><div className="grid grid-cols-2 gap-2"><input className="field" type="time" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/><input className="field" type="time" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={!!form.syncToGoogle} disabled={!form.scheduleDate} onChange={e=>setForm({...form,syncToGoogle:e.target.checked})}/>Google Calendarへ反映</label><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3.5 text-sm font-bold text-white"><Icon name="plus" className="h-4 w-4"/>メモを登録</button></form>
          </aside>

          <section id="memo-list" className="min-w-0"><div className="panel rounded-[24px] p-4 sm:p-5"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="relative flex-1"><Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="field !pl-10" placeholder="メモを検索…"/></div><div className="flex flex-wrap gap-2"><select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="field !w-auto text-xs font-semibold"><option value="active">対応中</option><option value="done">完了</option><option value="all">すべて</option></select><select value={sort} onChange={e=>setSort(e.target.value as typeof sort)} className="field !w-auto text-xs font-semibold"><option value="new">新しい順</option><option value="old">古い順</option><option value="priority">優先度順</option><option value="schedule">日付順</option></select><div className="flex rounded-xl bg-slate-100 p-1"><button onClick={()=>setView("cards")} className={`rounded-lg p-2 ${view==="cards"?"bg-white text-indigo-600 shadow-sm":"text-slate-400"}`}><Icon name="grid" className="h-4 w-4"/></button><button onClick={()=>setView("compact")} className={`rounded-lg p-2 ${view==="compact"?"bg-white text-indigo-600 shadow-sm":"text-slate-400"}`}><Icon name="list" className="h-4 w-4"/></button></div></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{[{value:"all",label:"すべて"},...categories].map(c=><button key={c.value} onClick={()=>setCategory(c.value as typeof category)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ${category===c.value?"bg-slate-900 text-white":"bg-slate-100 text-slate-500"}`}>{c.label}</button>)}</div><div className="mt-3 flex gap-2 overflow-x-auto border-t border-slate-100 pt-3">{dateFilters.map(item=><button key={item.value} onClick={()=>setDateFilter(item.value)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ${dateFilter===item.value ? item.value==="overdue" ? "bg-rose-600 text-white" : "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{item.label}</button>)}</div></div>
            <div className={`${view === "cards" ? "mt-4 grid gap-4 xl:grid-cols-2" : "mt-4 space-y-3"}`}>{filtered.length ? filtered.map(memo=><article key={memo.id} className="panel rounded-2xl p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-2 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${categoryMeta(memo.category).colour}`}>{categoryMeta(memo.category).label}</span>{memo.priority === "high" && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">優先度 高</span>}{memo.scheduleDate && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${scheduleTone(memo)}`}>{formatSchedule(memo)}</span>}</div><h3 className="break-words text-base font-bold text-slate-900">{memo.title}</h3>{memo.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{memo.description}</p>}</div><button onClick={()=>patchMemo(memo.id,{pinned:!memo.pinned})} className={`shrink-0 rounded-lg p-2 ${memo.pinned?"bg-amber-50 text-amber-600":"text-slate-300"}`}><Icon name="pin" className="h-4 w-4"/></button></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3"><button onClick={()=>patchMemo(memo.id,{status:(memo.status||"active")==="active"?"done":"active"})} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{(memo.status||"active")==="active"?"完了":"対応中へ"}</button><button onClick={()=>setEditing(memo)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">編集</button>{memo.syncToGoogle && <button onClick={()=>syncMemo(memo)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Google再同期</button>}<button onClick={()=>moveToTrash(memo)} className="ml-auto rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">ゴミ箱へ</button></div></article>) : <div className="panel rounded-2xl py-16 text-center"><Icon name="inbox" className="mx-auto h-9 w-9 text-slate-300"/><p className="mt-3 font-bold text-slate-600">該当するメモはありません</p><p className="mt-1 text-sm text-slate-400">条件を変えるか、新しいメモを登録してください。</p></div>}</div>
          </section>
        </div>
      </> : <section className="panel rounded-[24px] p-4 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-900">ゴミ箱</h3><p className="mt-1 text-sm text-slate-500">ここにあるメモは元に戻せます。完全削除するまでデータは残ります。</p></div>{trashMemos.length > 0 && <button onClick={emptyTrash} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200">ゴミ箱を空にする</button>}</div><div className="space-y-3">{trashMemos.length ? trashMemos.map(memo=><article key={memo.id} className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-bold text-slate-900">{memo.title}</h4><p className="mt-1 line-clamp-2 text-sm text-slate-500">{memo.description || "詳細なし"}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>restoreMemo(memo)} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><Icon name="undo" className="h-4 w-4"/>元に戻す</button><button onClick={()=>permanentlyDelete(memo)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">完全に削除</button></div></article>) : <div className="py-20 text-center"><Icon name="trash" className="mx-auto h-10 w-10 text-slate-300"/><p className="mt-3 font-bold text-slate-600">ゴミ箱は空です</p></div>}</div></section>}
    </div>

    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4"><form onSubmit={updateMemo} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">メモを編集</h3><button type="button" onClick={()=>setEditing(null)} className="rounded-lg p-2 text-slate-500"><Icon name="close"/></button></div><div className="space-y-4"><input className="field" value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/><textarea className="field min-h-36" value={editing.description} onChange={e=>setEditing({...editing,description:e.target.value})}/><div className="grid grid-cols-2 gap-2"><input className="field" type="date" value={editing.scheduleDate || ""} onChange={e=>setEditing({...editing,scheduleDate:e.target.value})}/><select className="field" value={editing.priority} onChange={e=>setEditing({...editing,priority:e.target.value as Priority})}><option value="normal">通常</option><option value="high">優先度 高</option></select></div><button className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">変更を保存</button></div></form></div>}
    {notice && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{notice}</div>}
  </main>;
}
