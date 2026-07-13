"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MemoCategory = "idea" | "feature" | "improvement" | "bug";
type MemoPriority = "normal" | "high";

type TanakaMemo = {
  id: string;
  title: string;
  description: string;
  category: MemoCategory;
  priority: MemoPriority;
  createdAt: string;
};

const STORAGE_KEY = "tanaka-memo-items";

const categoryLabels: Record<MemoCategory, string> = {
  idea: "アイデア",
  feature: "機能追加",
  improvement: "改善",
  bug: "不具合",
};

const priorityLabels: Record<MemoPriority, string> = {
  normal: "通常",
  high: "高",
};

const initialForm = {
  title: "",
  description: "",
  category: "idea" as MemoCategory,
  priority: "normal" as MemoPriority,
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isTanakaMemo(value: unknown): value is TanakaMemo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const memo = value as Partial<TanakaMemo>;
  return (
    typeof memo.id === "string" &&
    typeof memo.title === "string" &&
    typeof memo.description === "string" &&
    memo.category !== undefined &&
    ["idea", "feature", "improvement", "bug"].includes(memo.category) &&
    memo.priority !== undefined &&
    ["normal", "high"].includes(memo.priority) &&
    typeof memo.createdAt === "string"
  );
}

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [memos, setMemos] = useState<TanakaMemo[]>([]);
  const [error, setError] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMemos(parsed.filter(isTanakaMemo));
        }
      } catch {
        setMemos([]);
      }
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
    }
  }, [isLoaded, memos]);

  const highPriorityCount = useMemo(
    () => memos.filter((memo) => memo.priority === "high").length,
    [memos],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = form.title.trim();
    const description = form.description.trim();

    if (!title) {
      setError("タイトルを入力してください。");
      return;
    }

    const newMemo: TanakaMemo = {
      id: createId(),
      title,
      description,
      category: form.category,
      priority: form.priority,
      createdAt: new Date().toISOString(),
    };

    setMemos((current) => [newMemo, ...current]);
    setForm(initialForm);
    setError("");
  };

  const handleDelete = (memo: TanakaMemo) => {
    const shouldDelete = window.confirm(`「${memo.title}」を削除しますか？`);

    if (shouldDelete) {
      setMemos((current) => current.filter((item) => item.id !== memo.id));
    }
  };

  return (
    <main className="min-h-screen bg-blue-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100 sm:p-8">
          <p className="text-sm font-semibold text-blue-700">個人用ワークメモ</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">田中メモ</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                仕事中に気づいた不便、改善案、不具合、開発アイデアをその場で記録します。
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-blue-100">
              登録済み <span className="font-semibold text-blue-700">{memos.length}</span> 件
              <span className="mx-2 text-slate-300">/</span>
              高優先度 <span className="font-semibold text-red-700">{highPriorityCount}</span> 件
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h2 className="text-xl font-semibold text-slate-900">新しいメモを登録</h2>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                  タイトル <span className="text-red-600">必須</span>
                </label>
                <input
                  id="title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="例：申請書の確認作業を短縮したい"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">
                  詳細メモ
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={6}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="状況、困っている点、思いついた改善案などを記録します。"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-slate-700">
                    カテゴリー
                  </label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, category: event.target.value as MemoCategory }))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="idea">idea</option>
                    <option value="feature">feature</option>
                    <option value="improvement">improvement</option>
                    <option value="bug">bug</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-slate-700">
                    優先度
                  </label>
                  <select
                    id="priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: event.target.value as MemoPriority }))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="normal">通常</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>

              {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
              >
                登録する
              </button>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-blue-100">
            <h2 className="text-xl font-semibold text-slate-900">登録済みメモ一覧</h2>
            <div className="mt-6 space-y-4">
              {memos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 px-4 py-10 text-center text-slate-600">
                  まだメモはありません
                </div>
              ) : (
                memos.map((memo) => (
                  <article
                    key={memo.id}
                    className={`rounded-xl border p-4 shadow-sm ${
                      memo.priority === "high" ? "border-red-200 bg-red-50" : "border-blue-100 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold leading-7 text-slate-900">{memo.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">
                            {categoryLabels[memo.category]} / {memo.category}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 ${
                              memo.priority === "high" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            優先度：{priorityLabels[memo.priority]}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(memo)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        削除
                      </button>
                    </div>
                    {memo.description ? (
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{memo.description}</p>
                    ) : (
                      <p className="mt-4 text-sm text-slate-400">詳細メモはありません</p>
                    )}
                    <p className="mt-4 text-xs text-slate-500">登録日時：{formatCreatedAt(memo.createdAt)}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
