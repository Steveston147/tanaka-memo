"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "onestop-program-manager-items";

type ProgramStatus =
  | "inquiry"
  | "planning"
  | "estimating"
  | "agreed"
  | "recruiting"
  | "preparing"
  | "running"
  | "completed"
  | "cancelled";

type ProgramItem = {
  id: string;
  programId: string;
  name: string;
  institution: string;
  startDate: string;
  endDate: string;
  participants: string;
  owner: string;
  campus: string;
  accommodation: string;
  status: ProgramStatus;
  nextAction: string;
  nextActionDue: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type ProgramForm = Omit<ProgramItem, "id" | "createdAt" | "updatedAt">;

const emptyForm: ProgramForm = {
  programId: "",
  name: "",
  institution: "",
  startDate: "",
  endDate: "",
  participants: "",
  owner: "",
  campus: "",
  accommodation: "",
  status: "planning",
  nextAction: "",
  nextActionDue: "",
  notes: "",
};

const statusOptions: { value: ProgramStatus; label: string }[] = [
  { value: "inquiry", label: "問い合わせ" },
  { value: "planning", label: "企画中" },
  { value: "estimating", label: "見積中" },
  { value: "agreed", label: "合意済み" },
  { value: "recruiting", label: "募集中" },
  { value: "preparing", label: "実施準備" },
  { value: "running", label: "実施中" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "中止" },
];

const statusLabel = (status: ProgramStatus) =>
  statusOptions.find((option) => option.value === status)?.label ?? status;

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const validProgram = (value: unknown): value is ProgramItem => {
  const item = value as Partial<ProgramItem>;
  return !!item && typeof item.id === "string" && typeof item.programId === "string" && typeof item.name === "string";
};

const text = (value: unknown) => (value == null ? "" : String(value).trim());

const normaliseStatus = (value: unknown): ProgramStatus => {
  const raw = text(value).toLowerCase();
  const exact = statusOptions.find((option) => option.value === raw || option.label === text(value));
  return exact?.value ?? "planning";
};

const excelDate = (value: unknown) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
};

const pick = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return "";
};

export default function ProgramManagerPage() {
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [form, setForm] = useState<ProgramForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProgramStatus>("all");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(parsed)) setItems(parsed.filter(validProgram));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => !q || `${item.programId} ${item.name} ${item.institution} ${item.owner} ${item.nextAction}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (!a.nextActionDue && b.nextActionDue) return 1;
        if (a.nextActionDue && !b.nextActionDue) return -1;
        return a.nextActionDue.localeCompare(b.nextActionDue) || a.name.localeCompare(b.name, "ja");
      });
  }, [items, query, statusFilter]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const programId = form.programId.trim();
    const name = form.name.trim();
    if (!programId || !name) return flash("Program IDとプログラム名を入力してください");
    const duplicate = items.find((item) => item.programId.toLowerCase() === programId.toLowerCase() && item.id !== editingId);
    if (duplicate) return flash("同じProgram IDがすでに使われています");
    const now = new Date().toISOString();
    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? { ...item, ...form, programId, name, updatedAt: now } : item));
      flash("プログラム情報を更新しました");
    } else {
      setItems((current) => [{ ...form, programId, name, id: createId(), createdAt: now, updatedAt: now }, ...current]);
      flash("プログラムを登録しました");
    }
    setEditingId(null);
    setForm(emptyForm);
  };

  const edit = (item: ProgramItem) => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...next } = item;
    setForm(next);
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = (item: ProgramItem) => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return;
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    flash("削除しました");
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = items.map((item) => ({
      "Program ID": item.programId,
      "プログラム名": item.name,
      "大学・団体名": item.institution,
      "開始日": item.startDate,
      "終了日": item.endDate,
      "参加人数": item.participants,
      "担当者": item.owner,
      "キャンパス": item.campus,
      "宿舎": item.accommodation,
      "進捗": statusLabel(item.status),
      "次のアクション": item.nextAction,
      "期限": item.nextActionDue,
      "備考": item.notes,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 18 }, { wch: 28 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 34 }, { wch: 12 }, { wch: 45 },
    ];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "進捗一覧");
    XLSX.writeFile(book, `program-progress-${todayKey()}.xlsx`);
    flash("Excelを出力しました");
  };

  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const firstSheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
      const now = new Date().toISOString();
      const imported = rows.map((row) => ({
        id: createId(),
        programId: text(pick(row, ["Program ID", "プログラムID", "ID"])),
        name: text(pick(row, ["プログラム名", "Program Name", "Program"])),
        institution: text(pick(row, ["大学・団体名", "大学名", "Institution"])),
        startDate: excelDate(pick(row, ["開始日", "Start Date"])),
        endDate: excelDate(pick(row, ["終了日", "End Date"])),
        participants: text(pick(row, ["参加人数", "人数", "Participants"])),
        owner: text(pick(row, ["担当者", "担当", "Owner"])),
        campus: text(pick(row, ["キャンパス", "Campus"])),
        accommodation: text(pick(row, ["宿舎", "Accommodation"])),
        status: normaliseStatus(pick(row, ["進捗", "ステータス", "Status"])),
        nextAction: text(pick(row, ["次のアクション", "次の対応", "Next Action"])),
        nextActionDue: excelDate(pick(row, ["期限", "次の期限", "Due Date"])),
        notes: text(pick(row, ["備考", "メモ", "Notes"])),
        createdAt: now,
        updatedAt: now,
      })).filter((item) => item.programId && item.name);

      if (!imported.length) return flash("Program IDとプログラム名を含む行が見つかりませんでした");
      const currentByProgramId = new Map(items.map((item) => [item.programId.toLowerCase(), item]));
      const updateCount = imported.filter((item) => currentByProgramId.has(item.programId.toLowerCase())).length;
      const addCount = imported.length - updateCount;
      if (!confirm(`${imported.length}件を取り込みます。\n新規 ${addCount}件・更新 ${updateCount}件\n\nProgram IDが一致するデータは更新されます。`)) return;

      setItems((current) => {
        const merged = new Map(current.map((item) => [item.programId.toLowerCase(), item]));
        for (const incoming of imported) {
          const key = incoming.programId.toLowerCase();
          const existing = merged.get(key);
          merged.set(key, existing ? { ...existing, ...incoming, id: existing.id, createdAt: existing.createdAt } : incoming);
        }
        return Array.from(merged.values());
      });
      flash(`Excelから${imported.length}件を取り込みました`);
    } catch {
      flash("Excelファイルを読み込めませんでした");
    }
  };

  const activeCount = items.filter((item) => !["completed", "cancelled"].includes(item.status)).length;
  const dueCount = items.filter((item) => item.nextActionDue && item.nextActionDue <= todayKey() && !["completed", "cancelled"].includes(item.status)).length;

  return (
    <main className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <div>
            <p className="text-[10px] font-bold tracking-[.16em] text-indigo-600">ONESTOP</p>
            <h1 className="text-lg font-bold">Program Manager</h1>
            <p className="text-[10px] font-semibold text-slate-500">Ritsumeikan Study Abroad Centre</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">Work Board</Link>
            <button onClick={() => fileRef.current?.click()} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">Excel取込</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importExcel} />
            <button onClick={exportExcel} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Excel出力</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 pt-7 sm:px-7">
        <section className="mb-7">
          <p className="text-sm font-bold text-indigo-600">PROGRAM OVERVIEW</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">プログラム全体を、一か所で。</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Program IDを軸に、担当・進捗・次のアクションを管理します。Excelは取り込みと共有用の出力に使えます。</p>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs font-bold text-slate-500">登録数</p><p className="mt-1 text-3xl font-bold">{items.length}</p></div>
          <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-800 ring-1 ring-indigo-200"><p className="text-xs font-bold">進行中</p><p className="mt-1 text-3xl font-bold">{activeCount}</p></div>
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200"><p className="text-xs font-bold">期限到来</p><p className="mt-1 text-3xl font-bold">{dueCount}</p></div>
          <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200"><p className="text-xs font-bold">完了</p><p className="mt-1 text-3xl font-bold">{items.filter((item) => item.status === "completed").length}</p></div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24 sm:p-6">
            <div className="mb-5">
              <h3 className="font-bold">{editingId ? "プログラムを編集" : "新しいプログラム"}</h3>
              <p className="mt-1 text-xs text-slate-500">Program IDはExcel連携の照合キーです。</p>
            </div>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input className="field" placeholder="Program ID *" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })} />
                <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProgramStatus })}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              </div>
              <input className="field" placeholder="プログラム名 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="field" placeholder="大学・団体名" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
              <div className="grid grid-cols-2 gap-2"><input className="field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /><input className="field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="参加人数" value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} /><input className="field" placeholder="担当者" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="キャンパス" value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })} /><input className="field" placeholder="宿舎" value={form.accommodation} onChange={(e) => setForm({ ...form, accommodation: e.target.value })} /></div>
              <textarea className="field min-h-20" placeholder="次のアクション" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
              <input className="field" type="date" value={form.nextActionDue} onChange={(e) => setForm({ ...form, nextActionDue: e.target.value })} />
              <textarea className="field min-h-24" placeholder="備考・履歴" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <div className="flex gap-2">
                {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200">キャンセル</button>}
                <button className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">{editingId ? "更新" : "登録"}</button>
              </div>
            </form>
          </aside>

          <section className="min-w-0">
            <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input className="field flex-1" placeholder="Program ID・大学名・担当者・次のアクションを検索" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select className="field sm:!w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | ProgramStatus)}><option value="all">すべての進捗</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="font-bold text-slate-700">プログラムはまだありません</p><p className="mt-2 text-sm text-slate-500">左のフォームから登録するか、既存の進捗一覧Excelを取り込んでください。</p></div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => {
                  const due = item.nextActionDue && item.nextActionDue <= todayKey() && !["completed", "cancelled"].includes(item.status);
                  return <article key={item.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{item.programId}</span><span className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">{statusLabel(item.status)}</span>{due && <span className="rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">期限到来</span>}</div>
                        <h3 className="mt-2 text-xl font-bold">{item.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{item.institution || "大学・団体名未設定"}</p>
                      </div>
                      <div className="flex gap-2"><button onClick={() => edit(item)} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200">編集</button><button onClick={() => remove(item)} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-600 ring-1 ring-rose-200">削除</button></div>
                    </div>
                    <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div><p className="text-[11px] font-bold text-slate-400">期間</p><p className="mt-1 font-semibold">{item.startDate || "未定"}{item.endDate ? ` 〜 ${item.endDate}` : ""}</p></div>
                      <div><p className="text-[11px] font-bold text-slate-400">担当者</p><p className="mt-1 font-semibold">{item.owner || "未設定"}</p></div>
                      <div><p className="text-[11px] font-bold text-slate-400">人数</p><p className="mt-1 font-semibold">{item.participants || "未定"}</p></div>
                      <div><p className="text-[11px] font-bold text-slate-400">場所・宿舎</p><p className="mt-1 font-semibold">{[item.campus, item.accommodation].filter(Boolean).join(" / ") || "未設定"}</p></div>
                    </div>
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-indigo-700">次のアクション</p><p className={`text-xs font-bold ${due ? "text-rose-600" : "text-slate-500"}`}>{item.nextActionDue || "期限未設定"}</p></div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.nextAction || "次のアクションは未設定です。"}</p>
                    </div>
                    {item.notes && <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">備考・履歴を表示</summary><p className="mt-2 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{item.notes}</p></details>}
                  </article>;
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      {notice && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-xl">{notice}</div>}
    </main>
  );
}
