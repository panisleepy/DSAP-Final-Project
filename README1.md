## Murmurland

Murmurland 是一個以 Next.js 打造的社群平台，模擬 Twitter 風格的討論串體驗：使用者可以發表長篇貼文、附加圖片、即時互動，並透過遞迴式的回覆機制深入追蹤整個對話脈絡。

| 項目 | 說明 |
|---|---|
| **線上展示** | https://murmurland.vercel.app <br /> DEMO影片: https://www.youtube.com/watch?v=PwJ97Ofu4Uc <br /> 如果 deploy 失敗會盡快處理，抱歉造成評分同學的困擾了 |
| **技術棧** | Next.js App Router · React · Tailwind CSS · MongoDB · Pusher · NextAuth |

---

## 專案介紹

- Twitter 風格的主牆與貼文頁面，可無限層遞迴追蹤留言。
- 即時同步的社交互動：推播新貼文、回覆、按讚、轉傳等事件。
- 支援圖片上傳、提及使用者與主題標籤，強化討論與搜尋能力。
- 聚焦於穩健的身份驗證與通知系統，確保良好使用體驗。

---

## 安全機制與註冊流程

- **開放式註冊：** 目前不強制 `REG_KEY`，方便示範與快速體驗。若要轉為邀請制，可於環境變數中加入自訂 `REG_KEY` 檢查。
- **環境變數管理：** 所有敏感資訊皆透過 `.env` 管理。首次安裝時請將 `env.example` 複製為 `.env.local`，再填入 Mongo URI、Pusher、Cloudinary 等實際值。

> 正式部署時，請於平台（如 Vercel）後台設定同樣的環境變數。

---

## 主要功能

- **豐富的發文體驗**
  - 長篇 Murmur（上限 2 000 字）搭配即時字數統計。
  - 支援 Cloudinary 圖片上傳與預覽。
  - 遞迴對話串 `/post/[id]`、`/post/[id]/comment/[commentId]`，可無限層回覆。
  - 使用 Pusher 即時廣播新貼文、留言、按讚、轉傳。
- **社交圖譜**
  - 追蹤／取消追蹤，並即時更新粉絲與追蹤數。
  - 個人檔案編輯：自我介紹、網站、所在地、封面與頭貼上傳。
  - 個人塗鴉牆：發文列表、回覆紀錄、按讚貼文。
- **探索與引用**
  - `@mention` 連結到使用者個人頁並送出唯一通知。
  - `#hashtag` 開啟主題頁面，並統一樣式顏色。
  - 可搜尋的時間線、草稿保存、轉傳檢視、按讚統計。
- **通知與資料持久化**
  - 通知中心具備未讀徽章、即時更新、個別清除與標記已讀。
  - MongoDB 永久保存通知記錄，離線使用者回來也能追上進度。
- **響應式介面**
  - 手機優先設計，桌面裝置提供雙欄版面（側欄＋主內容）。
  - 側欄頭像與快速發文器會即時反映個人檔案更新。
- **基礎架構**
  - 以 MongoDB 原生驅動實作 CRUD，搭配 Prisma 抽象化工具。
  - Pusher 客戶端／伺服器封裝，確保頻道訂閱安全。

---

## 系統架構

```
        ┌────────────────────────┐
        │        Browser         │
        │  Next.js (App Router)  │
        └──────────┬─────────────┘
                   │
        Client-side fetch / SWR / Pusher
                   │
        ┌──────────▼─────────────┐
        │  Next.js API Routes    │
        │  (/app/api/**)         │
        ├──────────┬─────────────┤
        │          │             │
        ▼          ▼             ▼
MongoDB Atlas   Pusher JS    Cloudinary
(users, posts,  (realtime)   (media)
 notifications)
```

---

## 開發環境設定

1. **安裝相依套件**
   ```bash
   npm install
   # 或 pnpm install / yarn install
   ```
2. **設定環境變數**
   - 複製 `env.example` 為 `.env.local`。
   - 填入 MongoDB、Pusher、Cloudinary、NextAuth 等配置。（若需邀請制，可自行加入 `REG_KEY`。）
3. **資料庫與型別同步**
   ```bash
   npm run db:push      # 若使用 Prisma，同步 Schema 至資料庫
   npm run lint         # 選擇性：檢查程式碼風格
   ```
4. **啟動開發伺服器**
   ```bash
   npm run dev
   ```
5. 打開瀏覽器造訪 `http://localhost:3000`。

---

## 部署須知

- 在部署平台設定與 `.env.local` 相同的環境變數。
- 確認 Cloudinary、MongoDB、Pusher 等服務已開通正式環境。
- 部署完成後可直接使用上方「線上展示」連結進行驗收。

---

## 常用指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動 Next.js 開發模式。 |
| `npm run build` | 建置正式版應用程式。 |
| `npm run start` | 以正式模式啟動伺服器。 |
| `npm run lint` | 執行 Lint 檢查。 |
| `npm run db:push` | 將 Prisma Schema 推送至資料庫。 |

---

## 疑難排解

- **無法註冊：** 請確認 `REG_KEY` 與伺服器設定值一致。
- **圖片上傳失敗：** 檢查 Cloudinary 金鑰與 `next.config.ts` 的允許網域。
- **通知遲遲未送達：** 檢查 Pusher 相關金鑰與伺服器是否可連線。

---

## 📞 聯絡資訊

如有問題或建議，請透過以下方式聯絡：

- GitHub: @panisleepy
- Email: panisleepy@gmail.com
