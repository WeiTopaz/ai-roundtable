# AI Roundtable - 修改記錄

> **原作者**: Axton Liu (MIT License)  
> **修改者**: Wei Topaz (2026)

本文件記錄 Wei Topaz 對原版 AI Roundtable 所做的所有修改。

---

## 📊 概覽

| 項目 | 原版 | 修改版 |
|------|------|--------|
| `panel.js` 行數 | 824 行 | 1,265 行 |
| UI 語言 | 简体中文 | 繁體中文（臺灣用語） |
| 動作系統 | 斜線指令 + @ 語法 | 選單驅動 + Modal 視窗 |
| 日誌系統 | 單一活動日誌 | 雙分頁（活動 + 系統） |

---

## 🔧 主要修改內容

### 1. 語言本地化
- 全面轉換為**繁體中文**（臺灣用語）
- 介面文字、提示訊息、按鈕標籤皆已本地化
- 移除標頭區塊，簡化 UI

### 2. 動作系統重新設計 (`panel.js`, `panel.html`)
- **舊版**: `/cross @target <- @source` 語法、`/mutual` 指令
- **新版**: 下拉選單 + Modal 視窗選擇
  - 🔄 互評：讓勾選的 AI 互相評價
  - 📝 請...評價：指定單一 AI 評價其他 AI
  - ⚙️ 進階：多對一評價

### 3. 新增評價語氣選項 (`panel.js`, `panel.html`)
```javascript
const TONE_PROMPTS = {
  general: '請綜合評價以上觀點。你同意什麼？不同意什麼？有什麼補充？',
  pros: '請指出以上回覆中值得學習的優點與亮點。',
  cons: '請指出以上回覆中的問題、不足或可改進之處。',
  add: '請補充以上回覆中遺漏的內容或重要考量。',
  compare: '請對比以上觀點與你的看法，分析異同。'
};
```

### 4. 連線狀態指示器 (`panel.html`, `panel.css`)
- 新增圓點指示器顯示 AI 連線狀態（綠色/灰色）
- 一般模式與討論模式皆有

### 5. 日誌系統增強 (`panel.js`, `panel.html`, `panel.css`)
- 新增**系統日誌**分頁（開發者除錯用）
- 新增 **Copy** 按鈕複製日誌
- 新增 **Clear** 按鈕清除日誌
- 系統日誌僅在首次點選時啟用（節省資源）

### 6. 內容腳本優化 (`content/*.js`)
- 關閉自動 Response Observer，改為按需讀取
- 增加串流完成偵測的穩定性
- 調整等待時間參數

### 7. 版面配置調整 (`panel.css`)
- AI 選擇區改為水平排列
- 移除不必要的標頭區塊
- 調整輸入區樣式與間距
- 新增輔助說明 tooltip

---

## 📁 已修改檔案清單

| 檔案 | 修改類型 |
|------|----------|
| `sidepanel/panel.js` | 大幅修改 (+432 行) |
| `sidepanel/panel.html` | 大幅修改 |
| `sidepanel/panel.css` | 大幅修改 |
| `content/chatgpt.js` | 功能調整 |
| `content/claude.js` | 功能調整 |
| `content/gemini.js` | 功能調整 |
| `manifest.json` | 新增 author 欄位 |
| `README.md` | 更新作者資訊與使用說明 |
| `LICENSE` | 新增修改者版權聲明 |

---

## 📂 新增檔案

| 檔案 | 說明 |
|------|------|
| `specs/spec.md` | 技術規格文件 |
| `specs/test-plan.md` | 測試計劃 |
| `specs/test-cases.md` | 測試案例 |
| `MODIFICATIONS.md` | 本文件 |

---

## ⚠️ 已移除項目

- `.github/` 目錄（Issue 模板等）
- 標頭區塊（簡化 UI）
- 快捷按鈕 `/cross`、`<-`（改用選單）
- @ 提及按鈕（功能保留在訊息輸入中）

---

*最後更新：2026-01-26*
