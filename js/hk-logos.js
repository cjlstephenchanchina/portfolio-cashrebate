/* 持倉 Logo 映射（自動生成，請勿手動編輯）
 * code 對應數據層 stock_top3 的 code；color 用於圓形 badge 底色。
 * 若需替換為官方 Logo：將 img/logos/<code>.png 覆蓋為透明底 PNG 即可（UI 自動採用）。
 */
const HK_LOGO = {
  "1024": {
    "cn": "快手",
    "en": "Kuaishou",
    "color": "#FF4906",
    "mono": "快"
  },
  "1288": {
    "cn": "農業銀行",
    "en": "ABC",
    "color": "#009B4D",
    "mono": "農"
  },
  "1398": {
    "cn": "工商銀行",
    "en": "ICBC",
    "color": "#B51E2D",
    "mono": "工"
  },
  "1810": {
    "cn": "小米集團-W",
    "en": "Xiaomi",
    "color": "#FF6900",
    "mono": "米"
  },
  "2318": {
    "cn": "中國平安",
    "en": "Ping An",
    "color": "#E60012",
    "mono": "平"
  },
  "2628": {
    "cn": "中國人壽",
    "en": "China Life",
    "color": "#E60012",
    "mono": "壽"
  },
  "3690": {
    "cn": "美團-W",
    "en": "Meituan",
    "color": "#FFD100",
    "mono": "美"
  },
  "3988": {
    "cn": "中國銀行",
    "en": "BOC",
    "color": "#A4191A",
    "mono": "中"
  },
  "9618": {
    "cn": "京東集團",
    "en": "JD.com",
    "color": "#E1251B",
    "mono": "京"
  },
  "9988": {
    "cn": "阿里巴巴-W",
    "en": "Alibaba",
    "color": "#FF6A00",
    "mono": "巴"
  },
  "9999": {
    "cn": "網易",
    "en": "NetEase",
    "color": "#D71345",
    "mono": "易"
  },
  "300750": {
    "cn": "寧德時代",
    "en": "CATL",
    "color": "#1A6FB5",
    "mono": "寧"
  },
  "600519": {
    "cn": "貴州茅台",
    "en": "Moutai",
    "color": "#B91C1C",
    "mono": "茅"
  },
  "601318": {
    "cn": "中國平安",
    "en": "Ping An",
    "color": "#E60012",
    "mono": "平"
  },
  "0700": {
    "cn": "騰訊控股",
    "en": "Tencent",
    "color": "#12B7F5",
    "mono": "腾"
  },
  "0005": {
    "cn": "匯豐控股",
    "en": "HSBC",
    "color": "#DB0011",
    "mono": "滙"
  },
  "0941": {
    "cn": "中國移動",
    "en": "China Mobile",
    "color": "#0066CC",
    "mono": "中"
  },
  "0939": {
    "cn": "建設銀行",
    "en": "CCB",
    "color": "#003D7D",
    "mono": "建"
  },
  "0388": {
    "cn": "香港交易所",
    "en": "HKEX",
    "color": "#111111",
    "mono": "港"
  },
  "0998": {
    "cn": "中信銀行",
    "en": "CITIC",
    "color": "#C8102E",
    "mono": "信"
  },
  "0992": {
    "cn": "聯想集團",
    "en": "Lenovo",
    "color": "#E60012",
    "mono": "聯"
  },
  "000001": {
    "cn": "平安銀行",
    "en": "Ping An Bank",
    "color": "#E60012",
    "mono": "平"
  },
  "AAPL": {
    "cn": "Apple",
    "en": "Apple",
    "color": "#555555",
    "mono": "A"
  },
  "TSLA": {
    "cn": "Tesla",
    "en": "Tesla",
    "color": "#E82127",
    "mono": "T"
  },
  "MSFT": {
    "cn": "Microsoft",
    "en": "Microsoft",
    "color": "#00A4EF",
    "mono": "M"
  },
  "GOOGL": {
    "cn": "Alphabet",
    "en": "Google",
    "color": "#4285F4",
    "mono": "G"
  },
  "NVDA": {
    "cn": "NVIDIA",
    "en": "NVIDIA",
    "color": "#76B900",
    "mono": "N"
  }
};

function hkLogoInfo(code) {
  if (!code) return null;
  const c = String(code).trim().toUpperCase();
  const cands = [c, c.replace(/^0+/, "")];
  if (/^[0-9]+$/.test(c)) { cands.push(c.padStart(5, "0")); cands.push(c.padStart(4, "0")); }
  for (const k of cands) if (HK_LOGO[k]) return { ...HK_LOGO[k], key: k };
  return null;
}
