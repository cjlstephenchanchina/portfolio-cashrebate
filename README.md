# Nora-AI Capital（諾拉資本 · 股票市值計算器）

港股 / A股 / 美股持倉市值查詢、批量作業與現金回贈統計 — **純前端靜態站點，無後端依賴**。

## ✨ 功能
- **單筆查詢**：輸入股票代碼與日期（可選股數）→ 返回真實收市價、原幣市值與港幣市值
- **批量作業**：上傳 Excel（客戶編號／市場／股票代碼／股份數量）→ 自動查價、計算並寫入港幣市值，一鍵匯出
- **回贈統計**：每人上限 + 每 10 萬港幣送 100 元條件 → 總回贈／客戶人數／平均市值／Top 3 持倉／市場分佈／各客戶回贈圖表
- **真實數據**：查不到即明示，絕不模擬

## 📊 數據來源（瀏覽器直連，全部支援 CORS）
| 來源 | 用途 |
|---|---|
| 騰訊公開行情接口 | 港股 / A股 歷史收市價（無復權）+ 中文名 |
| stockanalysis.com | 美股 5 年歷史收市價 + 英文公司全名 |
| frankfurter.dev（ECB 數據） | 按查詢日的官方參考匯率 |

## 🚀 部署（GitHub Pages）
```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/<你的帳號>/<倉庫名>.git
git push -u origin main
```
然後在 GitHub 倉庫 Settings → Pages → Source 選 `main` 分支根目錄 → Save，等待 1-2 分鐘即可訪問：
`https://<你的帳號>.github.io/<倉庫名>/`

## 🛠 本地運行
任意靜態伺服器即可，例如：
```bash
cd site && python3 -m http.server 8000
```

## ⚠️ 聲明
行情與匯率均來自第三方公開接口，可能受網絡/限流影響；查不到時系統會明確提示。所有計算僅供參考，不構成投資建議。
