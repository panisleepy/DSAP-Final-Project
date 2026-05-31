# Murmurland（X-Clone 社群平台）

## 🔗 專案資源連結

| 項目 | 說明 |
|------|------|
| **線上 Demo** | https://murmurland.vercel.app |
| **Demo 影片** | https://youtu.be/pn7jp-Vxd3U |
| **Benchmark 測試頁（本機）** | http://localhost:3000/admin/benchmark |

---

## Proposal Report

### 動機與目標

微型部落格與即時動態已成為資訊傳播與社群互動的主要載體。本專題 Murmurland 旨在以全端 Web 應用實作一套可運作之類 Twitter（X）平台：支援發文、留言、社交關係、主題標籤與即時通知。

**具體目標：**

- 打造一個完整的現代前後端架構（Next.js App Router + MongoDB）。
- 將「討論串與留言」建模為階層式資料，實作遞迴留言與分層顯示的 UI。
- 將「追蹤關係」建模為有向圖 (Directed Graph)，並用它來產生個人的動態時報。
- 串接 Pusher 達成即時互動，練習事件驅動 (Event-driven) 與非同步的資料處理。

### 競品比較

| 比較維度 | Murmurland (本專題) | Dcard | Threads |
| :--- | :--- | :--- | :--- |
| **核心定位** | 專注於技術實證與輕量化交流的微社群 | 綜合型校園匿名論壇 | 依附於 IG 的即時動態微網誌 |
| **目標受眾** | 專題展示、重視流暢體驗的小型社群 | 全台大專院校學生 | 一般大眾、KOL 粉絲 |
| **身分機制** | **Google OAuth 實名/綁定驗證** | 校系信箱匿名/半匿名驗證 | Instagram 帳號連動 |
| **效能透明度** | **高** (主打演算法效能對比與架構展示) | 低 (商業機密，不公開) | 低 (商業機密，不公開) |
| **資訊乘載量** | 輕量、短文字「Murmur」為主 | 中長篇圖文、深度討論 | 短文字、圖片、影片 |
| **專題亮點區隔** | 不盲目堆疊功能，**著重探討留言樹在不同資料結構與演算法下的效能與語意差異**，具備學術與工程實證價值。 | 具備高度商業化與成熟的社群生態圈，功能龐大複雜。 | 擁有極高的併發處理能力與推薦演算法，依賴 Meta 龐大資源。 |

### 預期功能

| 類別 | 預期功能 |
| ----------- | --------------------------------------------------------------------------- |
| **內容與討論** | 發表貼文（含圖片）、貼文執行緒（`parentPostId`／`rootPostId`）、留言與巢狀回覆（`parentCommentId`）、刪除。 |
| **社交圖譜** | 追蹤 / 取消追蹤、查看粉絲與追蹤中清單、編輯個人檔案。 |
| **動態與探索** | 首頁與追蹤中的動態時報、轉發 (Repost) 內容混入排序、Hashtag 主題專屬頁面、`@mention` 標記與跳通知。 |
| **即時與通知** | Pusher 廣播（貼文／留言／讚／轉傳／通知頻道）、通知中心與未讀狀態。 |
| **帳號與基礎建設** | NextAuth、草稿、圖片上傳（Cloudinary）、環境變數與部署設定。 |

### 使用技術

- **前端：** Next.js（App Router）、React、Tailwind CSS、SWR、TypeScript
- **後端：** Next.js API Routes（`app/api/`）
- **資料層：** MongoDB Atlas、Prisma ORM（schema 與查詢）、MongoDB 原生驅動（部分寫入與原子操作）
- **即時：** Pusher（伺服器 trigger／客戶端 subscribe）
- **驗證與媒體：** NextAuth、Cloudinary

### Prototype 預計可驗證內容

1. **核心身分認證流程 (Authentication Flow)**
   * **驗證目標**：確保使用者能安全、穩定地進入系統。
   * **具體指標**：成功串接 OAuth 2.0，展示完整的 Google 第三方登入機制，並能正確攔截未授權的路由存取。
2. **非同步內容發布與即時互動 (Async Content & Real-time Interaction)**
   * **驗證目標**：驗證社群平台最核心的資料流轉能力。
   * **具體指標**：使用者能成功發布貼文與留言，並驗證資料庫 (MongoDB) 讀寫延遲在合理範圍內。
3. **資料庫檢索與效能實測 (Empirical Performance Demo)**
   * **驗證目標**：證明系統架構具備處理大量資料的潛力。
   * **具體指標**：在注入大量巢狀留言測試資料的情境下，實際展示不同留言展平演算法的伺服器端運算時間與輸出語意差異。

---

## Prototype Report

### 目前進度

- **核心功能已可操作**：完成 Google OAuth 登入、首頁動態時報、發文、留言、按讚、轉發、通知與個人頁。
- **資料模型已落地**：貼文採 `rootPostId` / `parentPostId`，留言採 `parentCommentId` / `rootPostId`，可支援 thread 與巢狀回覆。
- **遞迴留言流程已可 demo**：從貼文頁點進某則留言後，能 route 到該留言頁，並可繼續往下一層留言鑽取。
- **留言串顯示邏輯已修正**：貼文頁留言改為「樹狀展平順序（DFS preorder）」，順序由原本可能的 `A, B, A-1`，修正為 `A, A-1, B`，更接近 Twitter 的閱讀感受。
- **即時互動基礎完成**：透過 Pusher 觸發 `comment:created` 等事件，前端可自動 revalidate 更新畫面。
- **部署與展示完成**：已上線 Vercel，Demo 影片已錄製完成。

### 遇到的困難

* **留言排序與使用者心智模型不一致（已部分修復）**：最初 API 僅依賴時間排序，導致子留言會跑到其他主留言的下方。目前改為先建構父子關係 (Parent-children)，再透過深度優先搜尋 (DFS) 展平，讓回覆能緊跟在其父留言下方。
* **路由語意與返回行為複雜**：不同深度的留言頁面交錯切換時，瀏覽器的返回上一頁 (Back) 行為容易混亂。特別是當使用者從外部連結直接進入深層留言時，因缺乏歷史紀錄，返回路徑常不符合預期。
* **互動數據同步成本高**：留言新增、刪除、讚數與轉發數需要跨多個頁面（貼文頁、留言頁、通知中心）同步更新，前端的快取與狀態管理容易出現短暫的資料不一致。
* **效能與查詢策略的瓶頸**：當留言層數與數量增加時，若每層都即時向資料庫查詢父子節點，API 請求次數與網路傳輸量 (Payload) 會急遽上升，需要設計更精確的查詢與快取策略。
* **邊界情境 (Edge Cases) 尚未完全覆蓋**：例如父留言已刪除但子留言還在的狀況、深層連結失效 (404) 的錯誤提示文案等，仍需補齊。

### 下一步計畫

* **明確定義遞迴留言體驗（本週優先）**：在「單層逐層深入」與「全樹狀展開」之間擇一作為主要方案，並補上麵包屑導覽 (Breadcrumb) 或快速返回根貼文的按鈕，降低使用者的迷航感。
* **補強路由與資料同步機制**：統一留言相關頁面的前端快取更新策略，並補齊從深層連結進入時的預設導覽 (Fallback) 路徑。
* **補測試與壓力驗證**：新增留言深度、刪除與跳轉的整合測試，並注入大量測試資料，評估不同資料庫查詢策略在延遲時間上的實際差異。

---

## Final Report

### 專案說明

#### 專題概述

Murmurland 是以 Next.js 打造的類 Twitter 社群平台，已完成可對外 Demo 的完整流程：Google 登入、動態時報、發文（含圖片）、巢狀留言、按讚、轉發、追蹤、通知與個人頁，並部署於 Vercel。

本專題的 **DSA 核心** 放在「留言樹」：討論串在邏輯上是一棵**一般多叉樹**，每則留言透過 `parentCommentId` 指向父留言。我們實作了兩種把樹「展平成 UI 可讀列表」的策略，並在 **N = 4,000** 筆、最深十幾層的測試資料下，以 Benchmark 頁實測伺服器端運算時間與輸出語意，最後說明為何產品採用 **Map + Stack DFS（方案 B）**，而非單純時間排序（方案 A）。

#### 完成成果摘要

| 類別 | 完成內容 |
|------|----------|
| **產品功能** | OAuth 登入、首頁／追蹤中時報、發文、巢狀留言、按讚、轉發、Hashtag、`@mention`、通知、個人頁 |
| **資料建模** | Post thread（`parentPostId` / `rootPostId`）、Comment 樹（`parentCommentId`）、Follow 有向圖、Like 關聯 |
| **留言展平** | 產品 API 預設 **Map 鄰接表 + Stack DFS 前序走訪**，子留言緊接父留言 |
| **效能實驗** | `/admin/benchmark`：方案 A/B 對照、計時看板、語意預覽、深度分布統計 |
| **測試資料** | `npm run db:seed` 注入 4,000 筆隨機 parent 生長的留言樹 |
| **部署展示** | Vercel 線上 Demo + 錄影 |

#### 系統架構

```
┌──────────────────────────────────────────────────────────┐
│  Browser — React 頁面（首頁、貼文、留言、Benchmark UI）     │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTP / fetch / SWR
┌────────────────────────────▼─────────────────────────────┐
│  Next.js App Router                                       │
│  ├── app/          前端頁面                               │
│  └── app/api/**    API Routes（後端邏輯）                  │
│  └── lib/          演算法、動態時報、工具                  │
└────────────────────────────┬─────────────────────────────┘
                             │ Prisma / MongoDB Driver
┌────────────────────────────▼─────────────────────────────┐
│  MongoDB Atlas                                            │
│  Post · Comment · Like · Follow · User · Notification…    │
└──────────────────────────────────────────────────────────┘

     Pusher（即時事件）          Cloudinary（圖片）
     NextAuth（Google OAuth）
```

資料存放在 **MongoDB 雲端**，不在專案資料夾；`prisma/schema.prisma` 定義各 Collection 的文件結構。

#### 留言樹如何儲存（NoSQL + 鄰接表）

MongoDB 採 **Document** 存法：每則留言是一筆獨立文件，**不**把整棵樹嵌套在一個 JSON 裡。

| 欄位 | 意義 |
|------|------|
| `_id` | 留言唯一 ID |
| `postId` | 所屬貼文 |
| `parentCommentId` | 父留言 ID；`null` 表示第一層根留言 |
| `content`, `authorId`, `createdAt` | 內容、作者、時間 |

**鄰接表存法（Adjacency List）**：每筆只記「直接父節點是誰」。新增回覆只需 `insertOne` 一筆並填 `parentCommentId`，無需改動其他留言。

**讀取時**才在記憶體重建樹狀結構：

```
findMany 撈回 N 筆扁平 Comment
    → Map 建 parent → children[]
    → Stack DFS（push / pop）前序走訪
    → 展平陣列 + depth，交給 React 依 depth 縮排渲染
```

#### 資料結構與 DSA 對應

| 資料結構 | 儲存層（MongoDB） | 運算層（Node.js 記憶體） | 用途 |
|----------|-------------------|-------------------------|------|
| **Tree（多叉樹）** | `parentCommentId` | Map + DFS 展平 | 討論串父子關係 |
| **Adjacency List** | 每筆 Comment 的 parent 指標 | `Map<parentId, children[]>` | 建樹 |
| **Stack** | — | DFS 迭代 `push`/`pop` | 走訪順序 |
| **Array + Sort** | — | 方案 A 全表 sort；Timeline merge sort | 時間排序 |
| **Directed Graph** | Follow 文件（follower → following） | 查鄰居 ID 篩貼文 | 追蹤中動態 |
| **Set** | — | `likedIds.has(postId)` | 快速判斷是否已按讚 |

> **說明**：Map、Stack、Set 存在程式執行時的記憶體中；MongoDB 持久化的是 Document 與 ID 指標。

#### Benchmark 實驗設計

**實驗問題**：在固定資料量與固定 DB 查詢下，兩種留言展平策略的伺服器端運算成本與輸出品質有何差異？

| 項目 | 設定 |
|------|------|
| 測試貼文 ID | `85e110db17700e77582a81f1` |
| 留言筆數 | 4,000（10 根留言 + 3,990 則隨機選 parent） |
| 控制變因 | 同一貼文、同一 `findMany`、同一環境 |
| 自變數 | `?algo=baseline` vs `?algo=optimized` |
| 依變數 | `executionTimeMs`（主）、`dbFetchTimeMs`、`depthDistribution` |
| 量測方式 | API 內 `performance.now()` 分開計 DB 與演算法兩段 |
| Warm-up | 每方案前 1～2 次不計，第 3 次起記錄 |

**不包含**：瀏覽器渲染 4,000 個 DOM 的時間（Benchmark 頁僅預覽前 20 筆）。

#### 方案 A vs 方案 B

| | 方案 A（Baseline） | 方案 B（Optimized，產品採用） |
|--|-------------------|------------------------------|
| **資料結構** | 扁平 Array | Map（鄰接表）+ Stack + 輸出 Array |
| **演算法** | `Array.sort` 依 `createdAt` | 建表 O(n) + 各層兄弟排序 + DFS O(n) |
| **複雜度** | 約 O(n log n) | 約 O(n)～O(n log n) |
| **depth** | 全部視為 0 | 正確標記 0, 1, 2, … |
| **輸出順序** | 可能 `A, B, A-1` | `A, A-1, B`（Twitter 式 thread） |
| **語意** | 子留言可能脫離父留言上下文 | 子留言緊接父留言 |
| **executionTimeMs** | 有時略低（V8 sort 高度優化） | 可能略高，但語意正確 |

**Trade-off 結論**：方案 A 適合作為「未建樹、僅排序」的對照基線；方案 B 多付出 Map 配置與 DFS 走訪的常數成本，換取**正確的討論串 Context 與 UX**。這是效能與業務邏輯的 engineering 決策，而非單純追求最小毫秒數。

#### 主要程式位置

| 用途 | 路徑 |
|------|------|
| 方案 A / B 演算法 | `lib/comment-algorithms.ts` |
| 留言 API + Benchmark 計時 | `app/api/posts/[id]/comments/route.ts` |
| Benchmark 控制台 UI | `app/admin/benchmark/page.tsx` |
| 測試資料 seed | `prisma/seed.ts` |
| 常數（4000 筆、post id） | `lib/benchmark.ts` |
| MongoDB Schema | `prisma/schema.prisma` |
| 動態時報 merge + Set | `lib/timeline.ts` |
| 追蹤（有向圖加邊／刪邊） | `app/api/users/[alias]/follow/route.ts` |
| 按讚 insert / delete | `app/api/posts/[id]/like/route.ts` |

#### 與課程（DSAP）的關聯

1. **Tree**：留言 `parentCommentId` 形成一般多叉樹；需求是閱讀順序，非 BST 式 key 搜尋。
2. **Graph**：Follow 以有向邊建模，支援「追蹤中」動態的鄰居查詢。
3. **Adjacency List + DFS**：NoSQL 扁平存、記憶體建 Map、Stack 前序展平——完整示範「持久化結構」與「運算結構」的分工。
4. **Sorting**：方案 A 與 Timeline 的 merge sort，對照樹走訪與純排序的差異。
5. **Set**：時報渲染 O(1) 查詢按讚狀態，避免對每張卡線性掃描。
6. **演算法分析 + 實證**：控制 DB 查詢一致，以 `executionTimeMs` 比較常數因子與語意，並討論 Trade-off。

#### 已知限制與後續方向

- 深層留言頁的瀏覽器返回行為仍可能不符合使用者預期，尚缺麵包屑或統一 Fallback 導覽。
- 父留言刪除後子留言的顯示策略（soft delete 過濾）尚未完整處理所有 edge case。
- Benchmark 量測為單次 `findMany` 後的記憶體演算法，未涵蓋分頁、快取、CDN 等 production 優化。
- 4000 筆一次展平在真實貼文頁仍可能因 DOM 數量影響體感；產品 UI 可進一步做虛擬列表或分頁載入。

---

### 使用方式

#### 環境需求

- Node.js 18+
- MongoDB Atlas（或本機 MongoDB）
- Google OAuth 憑證（NextAuth）
- （選用）Pusher、Cloudinary

#### 環境變數

複製 `env.example` 為 `.env.local`，至少填入：

| 變數 | 用途 |
|------|------|
| `DATABASE_URL` | MongoDB 連線 |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | 登入 session |
| `GOOGLE_ID` / `GOOGLE_SECRET` | Google OAuth |
| `PUSHER_*` | 即時事件（選用） |
| `CLOUDINARY_*` | 圖片上傳（選用） |

#### 本機啟動

```bash
npm install
cp env.example .env.local
npm run db:push      # 同步 Prisma schema 至 MongoDB
npm run db:seed      # 注入 Benchmark 測試留言（約 4,000 筆）
npm run dev          # 請只開一個 dev server
```

- 一般使用：http://localhost:3000
- Benchmark：http://localhost:3000/admin/benchmark（**不需登入**）

#### Benchmark 實驗步驟

1. 確認 `npm run db:seed` 已成功，總筆數顯示 **4000**
2. 開啟 `/admin/benchmark`
3. **Warm-up**：方案 A、B 各點 1～2 次，不計成績（排除冷啟動／JIT 影響）
4. 從第 3 次起記錄看板上的 **伺服器純運算 ms**（`executionTimeMs`）與 **DB ms**（`dbFetchTimeMs`）
5. 對照預覽區：A 無縮排且可能有「上下文斷裂」；B 有 depth 階層縮排與深度分布表
6. 亦可直接呼叫 API：
   ```
   GET /api/posts/85e110db17700e77582a81f1/comments?algo=baseline
   GET /api/posts/85e110db17700e77582a81f1/comments?algo=optimized
   ```

#### 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式 |
| `npm run build` | 正式建置 |
| `npm run start` | 正式模式啟動 |
| `npm run db:push` | 推送 Prisma schema |
| `npm run db:seed` | 重置 Benchmark 測試留言 |
| `npm run lint` | Lint 檢查 |

#### 部署（Vercel）

1. 連接 GitHub repo，選 `main` 分支
2. 於 Vercel 後台設定與 `.env.local` 相同的環境變數
3. Google OAuth 須加入 production callback URL
4. 部署完成後使用 https://murmurland.vercel.app 驗收

#### 常見問題

| 問題 | 建議處理 |
|------|----------|
| Benchmark 總筆數為 0 | 執行 `npm run db:seed` |
| API 404 / Failed to load | 關閉多餘 `npm run dev`，刪除 `.next` 後重開 |
| 本機 Google 登入失敗 | 確認 `GOOGLE_SECRET` 與 Google Console redirect URI 含 `localhost:3000` |
| `Unable to acquire lock` | 只保留一個 dev server |

---

## 聯絡資訊

- GitHub: @panisleepy
- Email: panisleepy@gmail.com
