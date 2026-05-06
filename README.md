# Murmurland（X-Clone 社群平台）

## 🔗 專案資源連結
* **系統 Demo 網站**：[https://murmurland.vercel.app](https://murmurland.vercel.app)

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
| **專題亮點區隔** | 不盲目堆疊功能，**著重探討特定功能（如 Hashtag 檢索）在不同資料結構下的效能瓶頸與最佳化方案**，具備學術與工程實證價值。 | 具備高度商業化與成熟的社群生態圈，功能龐大複雜。 | 擁有極高的併發處理能力與推薦演算法，依賴 Meta 龐大資源。 |

---

### 預期功能


| 類別          | 預期功能                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| **內容與討論**   | 發表貼文（含圖片）、貼文執行緒（`parentPostId`／`rootPostId`）、留言與巢狀回覆（`parentCommentId`）、刪除。 |
| **社交圖譜**    | 追蹤 / 取消追蹤、查看粉絲與追蹤中清單、編輯個人檔案。                                                |
| **動態與探索**   | 首頁與追蹤中的動態時報、轉發 (Repost) 內容混入排序、Hashtag 主題專屬頁面、`@mention` 標記與跳通知。            |
| **即時與通知**   | Pusher 廣播（貼文／留言／讚／轉傳／通知頻道）、通知中心與未讀狀態。                                       |
| **帳號與基礎建設** | NextAuth、草稿、圖片上傳（Cloudinary）、環境變數與部署設定。                                     |


---

### 使用技術

- **前端：** Next.js（App Router）、React、Tailwind CSS、SWR、TypeScript  
- **後端：** Next.js API Routes（`app/api/`**）  
- **資料層：** MongoDB Atlas、Prisma ORM（schema 與查詢）、MongoDB 原生驅動（部分寫入與原子操作）  
- **即時：** Pusher（伺服器 trigger／客戶端 subscribe）  
- **驗證與媒體：** NextAuth、Cloudinary

---

### Prototype 預計可驗證內容


1. **核心身分認證流程 (Authentication Flow)**
   * **驗證目標**：確保使用者能安全、穩定地進入系統。
   * **具體指標**：成功串接 OAuth 2.0，展示完整的 Google 第三方登入機制，並能正確攔截未授權的路由存取。
2. **非同步內容發布與即時互動 (Async Content & Real-time Interaction)**
   * **驗證目標**：驗證社群平台最核心的資料流轉能力。
   * **具體指標**：使用者能成功發布貼文與留言，並驗證資料庫 (MongoDB) 讀寫延遲在合理範圍內。
3. **資料庫檢索與效能實測 (Empirical Performance Demo)**
   * **驗證目標**：證明系統架構具備處理大量資料的潛力。
   * **具體指標**：實際展示在注入測試資料的情境下，Hashtag 檢索與動態時報載入的效能表現。

---

## Prototype Report

### 目前進度

- **核心功能已可操作**：完成 Google OAuth 登入、首頁動態時報、發文、留言、按讚、轉發、通知與個人頁。
- **資料模型已落地**：貼文採 `rootPostId` / `parentPostId`，留言採 `parentCommentId` / `rootPostId`，可支援 thread 與巢狀回覆。
- **遞迴留言流程已可 demo**：從貼文頁點進某則留言後，能 route 到該留言頁，並可繼續往下一層留言鑽取。
- **留言串顯示邏輯已修正**：貼文頁留言改為「樹狀展平順序（DFS preorder）」，順序由原本可能的 `A, B, A-1`，修正為 `A, A-1, B`，更接近 Twitter 的閱讀感受。
- **即時互動基礎完成**：透過 Pusher 觸發 `comment:created` 等事件，前端可自動 revalidate 更新畫面。
- **部署與展示完成**：已上線 Vercel，可提供助教/同學直接驗證 Prototype。

#### Prototype Screenshots

![Prototype screenshot 1](./docs/images/prototype-1.png)
![Prototype screenshot 2](./docs/images/prototype-2.png)
![Prototype screenshot 3](./docs/images/prototype-3.png)

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

### 使用方式

### 與課程的關聯總結

---

## Git Commit 訊息規則（建議長期使用）

### 格式

`<type>(<scope>): <subject>`

- `type`：變更種類（必填）
- `scope`：影響範圍（選填，例如 `api`、`post`、`comment`、`auth`、`ui`、`infra`）
- `subject`：一句話描述，使用現在式、英文小寫開頭、不要句號

範例：

- `feat(api): add write rate limiting for posts and comments`
- `fix(comment): handle 429 response with user toast`
- `refactor(post): simplify timeline payload mapping`

### Type 對照表

- `feat`：新功能（對使用者可見）
- `fix`：修 bug（錯誤修正、行為修正）
- `refactor`：重構（不改功能行為）
- `perf`：效能優化
- `style`：格式調整（不影響邏輯，例如 lint/format）
- `docs`：文件調整（README、註解、說明）
- `test`：測試新增/修改
- `chore`：雜務（依賴更新、工具設定、CI）

### Subject 寫法準則

- 建議 50 字元內，聚焦「為什麼要改」而不是列出所有細節
- 一個 commit 只做一件事，避免混入無關變更
- 避免使用 `update`、`misc changes` 這類模糊詞

### Body（可選）

當修改較大時，可加上 commit body（空一行後開始）：

- 背景問題（為什麼）
- 主要改動（做了什麼）
- 風險與驗證方式（怎麼確認）

### 建議搭配的 Git 工作流

1. 開發前先 `git status` 確認工作區乾淨
2. 完成一個小目標就 commit 一次
3. commit 前先跑 `npm run lint`
4. push 前再檢查一次：`git log --oneline -n 5`

