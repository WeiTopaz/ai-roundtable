# AI 圓桌 (AI Roundtable)

![Version](https://img.shields.io/badge/version-0.2.0-blue)

> 讓多個 AI 助手圍桌討論，交叉評價，深度協作

一個 Chrome 擴充功能，讓你像「會議主持人」一樣，同時操控多個 AI（Claude、ChatGPT、Gemini），實現真正的 AI 圓桌會議。

---

## 🔬 Experimental Prototype / 實驗性原型

**EN**

This is an **experimental prototype** built to validate a working method:

> **Ask the same question to multiple models, let them debate each other, and use the friction to expose blind spots and expand thinking.**

It is **not** a production-ready tool, nor an attempt to compete with AI aggregators or workflow platforms.
Think of it as a *runnable experiment* rather than a polished product.

**中文**

這是一個**實驗性原型**，用於驗證一種工作方式：

> **同一個問題，讓多個模型同時回答並互相辯論，用分歧與衝突逼出漏洞、拓展思路。**

它**不是**一個生產級工具，也不是為了和任何 AI 聚合器或工作流產品競爭。
你可以把它理解為：**一份可以直接執行的實驗記錄**。

---

## 🎯 Non-goals / 刻意不做的事

**EN**

* No guarantee of long-term compatibility (AI web UIs change frequently)
* No promise of ongoing maintenance or rapid fixes
* No cloud backend, accounts, or data persistence
* No complex workflow orchestration, exports, or template libraries
* Not trying to support every model or platform

The focus is validating the **roundtable workflow**, not building software for its own sake.

**中文**

* 不承諾長期相容（AI 網頁端結構隨時可能變化）
* 不保證持續維護或快速修復
* 不做雲端帳號、資料儲存或同步
* 不做複雜的工作流編排、匯出或範本庫
* 不追求覆蓋所有模型或平台

重點在於**驗證「圓桌式思考流程」是否有價值**，而不是把軟體本身做大做全。

---

## ❓ Why this does NOT use APIs / 為什麼不用 API

**EN**

This project intentionally operates on the **web UIs** (Claude / ChatGPT / Gemini) instead of APIs.

In practice, **API and web chat often behave differently** — commonly due to model variants, hidden system settings, sampling parameters, or UI-specific features.

I'm currently most satisfied with, and calibrated to, the **web chat experience**, so this experiment stays on the web to validate the workflow under real conditions I actually use.

**中文**

這個專案刻意選擇直接操作 **Claude / ChatGPT / Gemini 的網頁端**，而不是使用 API。

在實際使用中，**API 和 Web 端的表現往往並不一致**，常見原因包括：模型版本差異、隱藏的系統設定、取樣參數，以及網頁端特有的互動能力。

目前我對 **Web 端 Chat 的體驗最熟悉、也最滿意**，因此這次實驗選擇留在 Web 端，驗證的是我真實使用場景下的思考流程，而不是 API 能力。

---

## 核心特性

- **統一控制台** - 透過 Chrome 側邊欄同時管理多個 AI
- **多目標傳送** - 一條訊息同時發給多個 AI，對比回答
- **互評模式** - 讓所有 AI 互相評價，對等參與（/mutual 指令）
- **交叉引用** - 讓 Claude 評價 ChatGPT 的回答，或反過來
- **討論模式** - 兩個 AI 就同一主題進行多輪深度討論
- **無需 API** - 直接操作網頁介面，使用你現有的 AI 訂閱

---

## 🧭 推薦使用流程 / Recommended Workflow

**中文**

1. **一般模式**：同題多答，製造分歧
2. **/mutual**：互相挑刺，逼出前提
3. **@ 審計**：由你決定誰審誰
4. **/cross**：兩方圍攻一方，壓力測試
5. **討論模式**：只在需要時進行多輪辯論

**EN**

1. **Normal** — Ask the same question to multiple models (create divergence)
2. **/mutual** — Let models critique each other (expose assumptions)
3. **@ audit** — You decide who audits whom
4. **/cross** — Two models pressure-test one conclusion
5. **Discussion** — Run multi-round debates only when needed

---

## 🚀 快速開始 / Quick Start

### 安裝

1. 下載或複製本儲存庫
2. 開啟 Chrome，進入 `chrome://extensions/`
3. 開啟右上角「開發人員模式」
4. 點選「載入未封裝項目」
5. 選擇本專案資料夾

### 首次使用提示：請重新整理頁面

開啟側邊欄並選取目標 AI 後，**建議把每個 AI 的網頁重新整理一次**。
這樣可以確保擴充功能正確取得頁面內容並穩定綁定（尤其是這些分頁已經開啟了一段時間的情況下）。

> **First-run tip:** After opening the sidebar and selecting target AIs, **refresh each AI page once** to ensure reliable detection.

### 準備工作

1. 開啟 Chrome，登入以下 AI 平台（根據需要）：
   - [Claude](https://claude.ai)
   - [ChatGPT](https://chatgpt.com)
   - [Gemini](https://gemini.google.com)

2. 推薦使用 Chrome 的 Split Tab 功能，將 2 個 AI 頁面並排顯示（不支持 Edge 的分割頁面）

3. 點選擴充功能圖示，開啟側邊欄控制台

---

## 使用方法

### 一般模式

**基本傳送**
1. 勾選要傳送的目標 AI（Claude / ChatGPT / Gemini）
2. 輸入訊息
3. 按 Enter 或點選「傳送」按鈕

**動作選單**

透過「選擇動作...」下拉選單快速執行評價操作：

| 類別 | 動作 | 說明 |
|------|------|------|
| 🔄 互評 | 讓勾選的 AI 互相評價 | 所有勾選的 AI 互相評價對方回覆 |
| 📝 請...評價 | 請 Claude/ChatGPT/Gemini 評價... | 指定某個 AI 評價其他 AI 的回覆 |
| ⚙️ 進階 | 指定來源評價（多對一） | 複雜組合：多個 AI 評價同一個 |

**互評（推薦）**

1. 先傳送一個問題給多個 AI，等待它們各自回覆
2. 從動作選單選擇「讓勾選的 AI 互相評價」
3. 每個 AI 都會收到其他 AI 的回覆並進行評價
   - 2 AI：A 評價 B，B 評價 A
   - 3 AI：A 評價 BC，B 評價 AC，C 評價 AB

**請...評價（單向評價）**

1. 從動作選單選擇「請 Claude/ChatGPT/Gemini 評價...」
2. 在彈出的選擇視窗中：
   - 勾選要被評價的 AI（來源）
   - 選擇評價語氣：綜合評價/指出優點/指出問題/補充說明/觀點對比
3. 點選「確定」執行

**Prompt Repetition**

勾選「Repetition」選項可將訊息重複傳送兩次，建議用於非推理模型以提高回覆品質。

### 討論模式

讓兩個 AI 就同一主題進行深度辯論：

1. 點選頂部「討論」切換到討論模式
2. 選擇 2 個參與討論的 AI
3. 輸入討論主題
4. 點選「開始討論」

**討論流程**

```
第 1 輪: 兩個 AI 各自闡述觀點
第 2 輪: 互相評價對方的觀點
第 3 輪: 回應對方的評價，深化討論
...
摘要: 雙方各自產生討論摘要
```

**日誌功能**

- **活動紀錄**：顯示操作記錄（傳送、接收等）
- **系統日誌**：詳細的開發者日誌（首次點選時啟用）
- **Copy**：複製當前日誌內容
- **Clear**：清除當前日誌

---

## 技術架構

```
ai-roundtable/
├── manifest.json           # Chrome 擴充功能設定 (Manifest V3)
├── background.js           # Service Worker 訊息中轉
├── sidepanel/
│   ├── panel.html          # 側邊欄 UI（含 Modal 元件）
│   ├── panel.css           # 樣式表
│   └── panel.js            # 控制邏輯（~1260 行）
├── content/
│   ├── claude.js           # Claude 頁面注入腳本
│   ├── chatgpt.js          # ChatGPT 頁面注入腳本
│   └── gemini.js           # Gemini 頁面注入腳本
├── specs/                  # 規格與測試文件
│   ├── spec.md             # 技術規格文件
│   ├── test-plan.md        # 測試計劃
│   └── test-cases.md       # 測試案例
└── icons/                  # 擴充功能圖示
```

---

## 隱私說明

- **不上傳任何內容** - 擴充功能完全在本機執行，不向任何伺服器傳送資料
- **無遙測/日誌蒐集** - 不收集使用資料、不追蹤行為
- **資料儲存位置** - 僅使用瀏覽器本機儲存空間（chrome.storage.local）
- **無第三方服務** - 不依賴任何外部 API 或服務
- **如何刪除資料** - 解除安裝擴充功能即可完全清除，或在 Chrome 擴充功能設定中清除儲存空間

---

## 常見問題

### Q: 安裝後無法連線 AI 頁面？
**A:** 安裝或更新擴充功能後，需要重新整理已開啟的 AI 頁面。

### Q: 交叉引用時提示「無法取得回覆」？
**A:** 確認來源 AI 已經有回覆。系統會取得該 AI 的最新一筆回覆。

### Q: ChatGPT 回覆很長時會逾時嗎？
**A:** 不會。系統支援最長 10 分鐘的回覆擷取。

---

## 已知限制

- 依賴各 AI 平台的 DOM 結構，平台更新可能導致功能失效
- 討論模式固定 2 個參與者
- 不支援 Claude Artifacts、ChatGPT Canvas 等特殊功能

---

## Contributing

Contributions welcome (low-maintenance project):

- Reproducible bug reports (input + output + steps + environment)
- Documentation improvements
- Small PRs (fixes/docs)

> **Note:** Feature requests may not be acted on due to limited maintenance capacity.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**Current Version: Wei Topaz**  

[![GitHub stars](https://img.shields.io/github/stars/WeiTopaz/ai-roundtable
)](https://github.com/WeiTopaz/ai-roundtable)  

**Original Creator: © AXTONLIU™ & AI 精英學院™** - AI Educator & Creator  
[![GitHub stars](https://img.shields.io/github/stars/axtonliu/ai-roundtable
)](https://github.com/axtonliu/ai-roundtable)
- Website: [axtonliu.ai](https://www.axtonliu.ai)
- YouTube: [@AxtonLiu](https://youtube.com/@AxtonLiu)
- Twitter/X: [@axtonliu](https://twitter.com/axtonliu)

 
