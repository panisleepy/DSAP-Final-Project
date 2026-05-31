# Murmurland（X-Clone 社群平台）

| 項目 | 說明 |
|------|------|
| **線上 Demo** | https://murmurland.vercel.app |
| **Demo 影片** | https://www.youtube.com/watch?v=PwJ97Ofu4Uc |
| **技術棧** | Next.js App Router · React · Tailwind CSS · MongoDB · Prisma · Pusher · NextAuth |

Murmurland 是以 Next.js 打造的類 Twitter 社群平台，支援發文、巢狀留言、按讚、轉發、追蹤與即時通知。期末 DSA 主軸為 **留言樹** 的資料結構建模，以及 **Baseline 排序 vs Map+DFS 展平** 的效能對照實驗。

---

## Final Report

### 專案說明

#### 動機與目標

微型部落格已是資訊傳播與社群互動的主要載體。本專題實作可運作的類 Twitter 平台，並以「討論串留言」為核心，探討**階層式資料**在 NoSQL 中的存法，以及讀取時不同演算法策略的效能與語意差異。

**具體目標：**

- 以 Next.js App Router + MongoDB 完成全端社群平台。
- 將留言建模為**一般多叉樹**（`parentCommentId`），並以 DFS 展平成 UI 可讀順序。
- 將追蹤關係建模為**有向圖**（Follow 邊），支援「追蹤中」動態時報。
- 建立 Benchmark 實驗：在 N=4,000 筆巢狀留言下，對照 **Array.sort** 與 **Map + Stack DFS** 兩種展平策略。

#### 已完成功能

- Google OAuth 登入、首頁動態時報、發文（含圖片）、巢狀留言、按讚、轉發、通知、個人頁
- 留言串以 **Map 鄰接表 + Stack DFS** 展平（子留言緊接父留言）
- Pusher 即時事件（新留言、按讚等）
- DSA Benchmark 頁：`/admin/benchmark`（方案 A/B 對照、計時、深度分布）
- 部署於 Vercel

#### 資料結構與 DSA 重點

| 概念 | 在本專題的體現 |
|------|----------------|
| **Tree（多叉樹）** | 留言 `parentCommentId` 指向父節點 |
| **Adjacency List（鄰接表）** | MongoDB 每筆 Comment 只存 parent 指標；讀取後以 `Map<parentId, children[]>` 重建 |
| **Stack + DFS** | `lib/comment-algorithms.ts` 迭代 DFS，`push`/`pop` 展平留言串 |
| **Array + Sort** | 方案 A baseline：全表依 `createdAt` 排序 |
| **Directed Graph** | `Follow`：`followerId → followingId` |
| **Set** | 動態時報載入時，以 `Set` 快速判斷使用者是否已按讚 |

**留言存法（NoSQL）：** 每則留言為 MongoDB 一筆 Document，不嵌套整棵樹；新增回覆只需 `insertOne` 並填 `parentCommentId`。

**Benchmark 對照：**

| | 方案 A（Baseline） | 方案 B（Optimized，產品採用） |
|--|-------------------|------------------------------|
| 做法 | `Array.sort` 依時間 | Map 建樹 + Stack DFS |
| 輸出 | 可能 `A, B, A-1` | `A, A-1, B`（正確 thread） |
| 結論 | 實驗對照基線 | **Trade-off**：可接受的運算成本，換正確 Context |

#### 主要程式位置

| 用途 | 路徑 |
|------|------|
| 留言演算法 A/B | `lib/comment-algorithms.ts` |
| 留言 API + 計時 | `app/api/posts/[id]/comments/route.ts` |
| Benchmark UI | `app/admin/benchmark/page.tsx` |
| 測試資料 seed | `prisma/seed.ts` |
| Schema | `prisma/schema.prisma` |
| 動態時報 + Set | `lib/timeline.ts` |

---

### 使用方式

#### 環境需求

- Node.js 18+
- MongoDB Atlas（或本機 MongoDB）
- （選用）Pusher、Cloudinary、Google OAuth 憑證

#### 本機啟動

```bash
npm install
cp env.example .env.local   # 填入 DATABASE_URL、NextAuth、Google OAuth 等
npm run db:push             # 同步 Prisma schema
npm run db:seed             # 注入 Benchmark 測試留言（約 4,000 筆）
npm run dev
```

瀏覽器開啟 http://localhost:3000

#### Benchmark 實驗

1. 開啟 http://localhost:3000/admin/benchmark
2. 方案 A/B 各先點 1～2 次 **warm-up**（不計成績）
3. 從第 3 次起記錄 **伺服器純運算 ms**（`executionTimeMs`）與 **DB ms**（`dbFetchTimeMs`）
4. 魔王貼文 ID：`85e110db17700e77582a81f1`
5. API：`GET /api/posts/{postId}/comments?algo=baseline` 或 `?algo=optimized`

#### 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式 |
| `npm run build` | 正式建置 |
| `npm run start` | 正式模式啟動 |
| `npm run db:seed` | 重置 Benchmark 測試留言 |
| `npm run lint` | Lint 檢查 |

#### 部署

於 Vercel（或其他平台）設定與 `.env.local` 相同的環境變數，部署後即可使用線上 Demo。

---

### 與課程的關聯總結

本專題將 DSAP 課程中的 **Tree、Graph、Sorting、Stack、Hash Map（JavaScript Map/Set）** 落實在真實 Web 場景：

1. **Tree + 鄰接表**：留言以 `parentCommentId` 存父子關係；讀取時重建樹並 DFS 展平，解決「子留言應緊接父留言」的業務需求。
2. **演算法分析**：Benchmark 在固定 `findMany` 下比較 O(n log n) 排序與 O(n) 建表 + DFS，以 `performance.now()` 實測 `executionTimeMs`。
3. **工程 Trade-off**：實驗顯示純排序可能更快，但破壞討論串語意；產品選擇 Map+DFS，體現**效能與業務邏輯的權衡**。
4. **Graph**：追蹤關係以有向邊建模，支援動態時報的鄰居查詢。
5. **Set**：時報渲染時 O(1) 判斷按讚狀態，降低重複線性搜尋成本。

---

## 系統架構

```
Browser (Next.js React)
        │
        ▼
Next.js API Routes (app/api/**)
        │
        ├── MongoDB Atlas (Post, Comment, Like, Follow, User…)
        ├── Pusher (即時事件)
        └── Cloudinary (圖片)
```

---

## 遇到的困難

- **留言排序與 UX**：最初僅時間排序，子留言會脫離父留言；改以 Map+DFS 展平後改善。
- **深層留言路由**：多層留言頁切換時，瀏覽器返回行為需額外處理。
- **快取同步**：留言、按讚數需跨頁面一致，前端 SWR / revalidate 需配合 Pusher 事件。
- **本機開發環境**：Next.js cache、OAuth 憑證與單一 dev server 需正確設定，避免 API 404 或登入失敗。

---

## 聯絡資訊

- GitHub: @panisleepy
- Email: panisleepy@gmail.com
