"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { BENCHMARK_POST_ID, BENCHMARK_POST_SLUG } from "@/lib/benchmark";
import type { CommentAlgo } from "@/lib/comment-algorithms";

type PreviewComment = {
  id: string;
  content: string;
  depth: number;
  parentCommentId: string | null;
  author: { alias: string };
};

type DepthDistributionEntry = {
  depth: number;
  count: number;
};

type BenchmarkResponse = {
  data: PreviewComment[];
  algorithm: CommentAlgo;
  executionTimeMs: number;
  dbFetchTimeMs: number;
  totalCount: number;
  depthDistribution?: {
    maxDepth: number;
    distribution: DepthDistributionEntry[];
  };
};

const PREVIEW_COUNT = 20;

const ALGO_LABELS: Record<CommentAlgo, string> = {
  baseline: "方案 A：扁平排序 (Baseline)",
  optimized: "方案 B：Map + DFS 優化 (Optimized)",
};

const SEMANTIC_HINTS: Record<CommentAlgo, string> = {
  baseline: "僅依時間扁平排序：無層級縮排，子留言可能脫離父留言上下文。",
  optimized: "Map 鄰接表 + DFS：子留言緊接父留言，depth 驅動階層縮排（產品實際採用）。",
};

function countParentOrderViolations(items: PreviewComment[]): number {
  const indexById = new Map(items.map((item, index) => [item.id, index]));
  let violations = 0;
  items.forEach((item, index) => {
    if (!item.parentCommentId) return;
    const parentIndex = indexById.get(item.parentCommentId);
    if (parentIndex === undefined || parentIndex > index) {
      violations += 1;
    }
  });
  return violations;
}

export default function BenchmarkPage() {
  const [algo, setAlgo] = useState<CommentAlgo>("optimized");
  const [result, setResult] = useState<BenchmarkResponse | null>(null);
  const [clientElapsedMs, setClientElapsedMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBenchmark = useCallback(async (nextAlgo: CommentAlgo) => {
    setAlgo(nextAlgo);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const startedAt = performance.now();
    try {
      const response = await fetch(
        `/api/posts/${BENCHMARK_POST_ID}/comments?algo=${nextAlgo}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error ?? `Request failed (${response.status})`);
      }
      const body = (await response.json()) as BenchmarkResponse;
      setResult(body);
      setClientElapsedMs(performance.now() - startedAt);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : "Benchmark failed");
      setClientElapsedMs(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const preview = result?.data.slice(0, PREVIEW_COUNT) ?? [];

  const previewStats = useMemo(() => {
    if (!result || preview.length === 0) return null;
    const maxDepth = Math.max(...preview.map((item) => item.depth));
    const violations = countParentOrderViolations(preview);
    return { maxDepth, violations };
  }, [preview, result]);

  const isParentOrderViolation = useCallback(
    (item: PreviewComment, index: number) => {
      if (!item.parentCommentId) return false;
      const parentIndex = preview.findIndex((entry) => entry.id === item.parentCommentId);
      return parentIndex === -1 || parentIndex > index;
    },
    [preview],
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brandBlue">DSA Benchmark Zone</p>
        <h1 className="text-3xl font-bold text-brandText">留言樹演算法效能對照</h1>
        <p className="text-sm text-gray-600">
          魔王貼文 slug：<code className="rounded bg-white/80 px-1">{BENCHMARK_POST_SLUG}</code> · ObjectId：{" "}
          <code className="rounded bg-white/80 px-1">{BENCHMARK_POST_ID}</code>
        </p>
        <p className="text-sm text-gray-500">
          請先執行 <code className="rounded bg-white/80 px-1">npm run db:seed</code> 產生約 4,000 筆巢狀留言。
        </p>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          錄影建議：方案 A/B 各先點 1～2 次作為<strong>預熱 (Warm-up)</strong>不計入成績，從第 3 次開始記錄毫秒數。
        </p>
        <Link href={`/post/${BENCHMARK_POST_ID}`} className="text-sm font-semibold text-brandBlue hover:underline">
          → 在一般貼文頁查看魔王串
        </Link>
      </header>

      <section className="murmur-card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-brandText">實驗控制台</h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(ALGO_LABELS) as CommentAlgo[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => runBenchmark(key)}
              disabled={isLoading}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                algo === key
                  ? "bg-gradient-to-r from-brandBlue to-brandPink text-white shadow"
                  : "border border-brandBlue/30 bg-white/80 text-brandText hover:bg-brandBlue/10"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {ALGO_LABELS[key]}
            </button>
          ))}
        </div>
        {isLoading && <p className="text-sm text-gray-500">載入中…</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>

      {result && (
        <section className="rounded-3xl border-2 border-brandPink/50 bg-gradient-to-br from-brandPink/20 via-white to-brandBlue/20 p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-brandText">效能計時器看板</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white/90 p-4">
              <dt className="text-xs uppercase text-gray-500">演算法</dt>
              <dd className="mt-1 text-lg font-semibold">{ALGO_LABELS[result.algorithm]}</dd>
            </div>
            <div className="rounded-2xl bg-white/90 p-4">
              <dt className="text-xs uppercase text-gray-500">伺服器純運算耗時</dt>
              <dd className="mt-1 text-3xl font-bold text-brandBlue">{result.executionTimeMs.toFixed(2)} ms</dd>
            </div>
            <div className="rounded-2xl bg-white/90 p-4">
              <dt className="text-xs uppercase text-gray-500">DB 查詢耗時</dt>
              <dd className="mt-1 text-2xl font-semibold text-brandText">{result.dbFetchTimeMs.toFixed(2)} ms</dd>
            </div>
            <div className="rounded-2xl bg-white/90 p-4">
              <dt className="text-xs uppercase text-gray-500">回傳總筆數</dt>
              <dd className="mt-1 text-3xl font-bold text-brandPink">{result.totalCount.toLocaleString()} 筆</dd>
            </div>
          </dl>
          {clientElapsedMs !== null && (
            <p className="mt-4 text-sm text-gray-600">
              端到端（含網路 + JSON 解析）：<strong>{clientElapsedMs.toFixed(2)} ms</strong>
            </p>
          )}
        </section>
      )}

      {result?.algorithm === "optimized" && result.depthDistribution && (
        <section className="murmur-card space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-brandText">留言深度分布（全 {result.totalCount.toLocaleString()} 筆）</h2>
            <p className="text-sm text-gray-600">
              由方案 B 的 Map+DFS 計算 <code className="rounded bg-white/80 px-1">depth</code>。
              第 1 層 = depth 0（無父留言），第 2 層 = depth 1，以此類推。最大深度：{" "}
              <strong>{result.depthDistribution.maxDepth}</strong>（第 {result.depthDistribution.maxDepth + 1} 層）。
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-brandBlue/20 bg-white/90">
            <table className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">層級</th>
                  <th className="px-4 py-2">depth</th>
                  <th className="px-4 py-2">筆數</th>
                  <th className="px-4 py-2">占比</th>
                </tr>
              </thead>
              <tbody>
                {result.depthDistribution.distribution.map((row) => {
                  const pct = (row.count / result.totalCount) * 100;
                  const barWidth = Math.max(4, Math.round(pct));
                  return (
                    <tr key={row.depth} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-2 font-medium">第 {row.depth + 1} 層</td>
                      <td className="px-4 py-2 font-mono text-gray-500">{row.depth}</td>
                      <td className="px-4 py-2 font-semibold">{row.count.toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 max-w-[140px] rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-brandBlue"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {preview.length > 0 && result && previewStats && (
        <section className="murmur-card space-y-4 p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-brandText">語意與 UI 對照預覽（前 {PREVIEW_COUNT} 筆）</h2>
            <p className="text-sm text-gray-600">{SEMANTIC_HINTS[result.algorithm]}</p>
          </div>

          <div
            className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-3 ${
              result.algorithm === "baseline"
                ? "border-red-200 bg-red-50/80"
                : "border-emerald-200 bg-emerald-50/80"
            }`}
          >
            <div>
              <p className="text-xs uppercase text-gray-500">最大 depth（預覽）</p>
              <p className="text-xl font-bold">{previewStats.maxDepth}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">父留言順序異常（預覽）</p>
              <p className="text-xl font-bold">{previewStats.violations}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">縮排策略</p>
              <p className="text-sm font-semibold">
                {result.algorithm === "baseline" ? "無（全部靠左）" : "依 depth 階層內縮"}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {preview.map((comment, index) => {
              const isOptimized = result.algorithm === "optimized";
              const depth = isOptimized ? comment.depth : 0;
              const violated = isParentOrderViolation(comment, index);

              return (
                <li
                  key={comment.id}
                  className={`rounded-xl border p-3 text-sm transition ${
                    violated
                      ? "border-red-300 bg-red-50/90"
                      : "border-white/70 bg-white/85"
                  } ${isOptimized ? "border-l-4 border-l-brandBlue" : ""}`}
                  style={{
                    marginLeft: `${Math.min(depth, 8) * 20}px`,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono">#{index + 1}</span>
                    <span>depth {comment.depth}</span>
                    {comment.parentCommentId && (
                      <span className="font-mono">parent …{comment.parentCommentId.slice(-6)}</span>
                    )}
                    {violated && (
                      <span className="rounded-full bg-red-200 px-2 py-0.5 font-semibold text-red-800">
                        上下文斷裂
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-brandText">@{comment.author.alias}</p>
                  <p className="mt-1 text-brandText">{comment.content}</p>
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-gray-500">
            方案 A：紅色標籤表示子留言出現在父留言之前，或父留言不在預覽窗口內，閱讀上下文 (Context) 被破壞。
            方案 B：子留言應緊接父留言且具階層縮排，符合 Twitter 式 thread。
          </p>
        </section>
      )}
    </main>
  );
}
