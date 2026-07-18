"use client";

import { ChangeEvent, useRef, useState } from "react";

const STORAGE_KEY = "tanaka-memo-items";
const BACKUP_APP = "OneStop";
const BACKUP_FORMAT_VERSION = 1;

type MemoData = {
  id: string;
  title: string;
  description: string;
  category: "idea" | "feature" | "improvement" | "bug";
  priority: "normal" | "high";
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
};

type BackupFile = {
  app: typeof BACKUP_APP;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  storageKey: typeof STORAGE_KEY;
  items: MemoData[];
};

type ImportPreview = {
  fileName: string;
  exportedAt: string;
  items: MemoData[];
  merged: MemoData[];
  total: number;
  added: number;
  updated: number;
  unchanged: number;
};

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isValidMemo(value: unknown): value is MemoData {
  if (!value || typeof value !== "object") return false;
  const memo = value as Partial<MemoData>;
  return (
    typeof memo.id === "string" && memo.id.length > 0 &&
    typeof memo.title === "string" &&
    typeof memo.description === "string" &&
    ["idea", "feature", "improvement", "bug"].includes(memo.category || "") &&
    ["normal", "high"].includes(memo.priority || "") &&
    isValidDate(memo.createdAt) &&
    (memo.updatedAt === undefined || isValidDate(memo.updatedAt))
  );
}

function readCurrentItems(): MemoData[] {
  const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(parsed)) throw new Error("現在のWork Boardデータを読み込めませんでした。");
  return parsed.filter(isValidMemo);
}

function effectiveTimestamp(memo: MemoData): number {
  return Date.parse(memo.updatedAt || memo.createdAt);
}

function sameMemo(left: MemoData, right: MemoData): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeItems(current: MemoData[], imported: MemoData[]) {
  const byId = new Map(current.map(item => [item.id, item]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const incoming of imported) {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      added += 1;
      continue;
    }

    if (sameMemo(existing, incoming)) {
      unchanged += 1;
      continue;
    }

    if (effectiveTimestamp(incoming) >= effectiveTimestamp(existing)) {
      byId.set(incoming.id, incoming);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  const currentOrder = current.map(item => item.id);
  const importedNewIds = imported.filter(item => !currentOrder.includes(item.id)).map(item => item.id);
  const order = [...importedNewIds, ...currentOrder];
  const merged = order.map(id => byId.get(id)).filter((item): item is MemoData => Boolean(item));

  return { merged, added, updated, unchanged };
}

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fileTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function BackupRestore() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const exportBackup = () => {
    try {
      const now = new Date();
      const backup: BackupFile = {
        app: BACKUP_APP,
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: now.toISOString(),
        storageKey: STORAGE_KEY,
        items: readCurrentItems(),
      };
      downloadJson(`onestop-backup-${fileTimestamp(now)}.json`, backup);
      setError("");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Exportに失敗しました。");
      setOpen(true);
    }
  };

  const chooseImportFile = () => {
    setError("");
    setPreview(null);
    fileRef.current?.click();
  };

  const readImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError("");
    setPreview(null);

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object") throw new Error("OneStopのバックアップファイルではありません。");
      const backup = parsed as Partial<BackupFile>;
      if (backup.app !== BACKUP_APP) throw new Error("OneStopのバックアップファイルではありません。");
      if (backup.formatVersion !== BACKUP_FORMAT_VERSION) throw new Error(`未対応のバックアップ形式です（version: ${String(backup.formatVersion ?? "不明")}）。`);
      if (backup.storageKey !== STORAGE_KEY) throw new Error("このWork Boardとは異なる保存領域のバックアップです。");
      if (!isValidDate(backup.exportedAt)) throw new Error("バックアップ日時が正しくありません。");
      if (!Array.isArray(backup.items)) throw new Error("バックアップ内のデータ一覧が正しくありません。");

      const invalidCount = backup.items.filter(item => !isValidMemo(item)).length;
      if (invalidCount > 0) throw new Error(`不正なメモが${invalidCount}件あるため、Importを中止しました。`);

      const items = backup.items as MemoData[];
      const current = readCurrentItems();
      const result = mergeItems(current, items);
      setPreview({
        fileName: file.name,
        exportedAt: backup.exportedAt,
        items,
        merged: result.merged,
        total: items.length,
        added: result.added,
        updated: result.updated,
        unchanged: result.unchanged,
      });
      setOpen(true);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Importファイルを読み込めませんでした。");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const runImport = () => {
    if (!preview) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preview.merged));
      alert(`Importが完了しました。\n\n追加：${preview.added}件\n更新：${preview.updated}件\n変更なし：${preview.unchanged}件\n\nGoogle Calendarへの同期は実行していません。`);
      window.location.reload();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Importに失敗しました。");
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={readImportFile} />
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
        <button type="button" onClick={exportBackup} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">Export</button>
        <button type="button" onClick={chooseImportFile} disabled={busy} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "確認中" : "Import"}</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="w-full max-w-lg rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-indigo-600">BACKUP / RESTORE</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Import内容の確認</h2>
              </div>
              <button type="button" onClick={() => { setOpen(false); setPreview(null); setError(""); }} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-700 ring-1 ring-rose-200">{error}</div>
            ) : preview ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  <p className="font-bold text-slate-800">{preview.fileName}</p>
                  <p className="mt-1 text-xs">バックアップ日時：{formatDate(preview.exportedAt)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[["総件数", preview.total], ["新規追加", preview.added], ["更新", preview.updated], ["変更なし", preview.unchanged]].map(([label, count]) => (
                    <div key={String(label)} className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-200">
                      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-5 text-slate-500">同じIDは新しい更新日時を優先し、新規IDは追加します。現在のデータだけにあるメモは削除しません。Google Calendar APIは呼び出しません。</p>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setOpen(false); setPreview(null); setError(""); }} className="rounded-xl px-4 py-3 text-sm font-bold text-slate-500">キャンセル</button>
              {preview && !error && <button type="button" onClick={runImport} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Importを実行</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
