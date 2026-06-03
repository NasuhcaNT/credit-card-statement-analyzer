export interface Transaction {
  date: Date;
  month: string; // "YYYY-MM"
  merchant: string;
  amountTry: number;
  currency: string;
  originalAmount: string | null;
  city: string;
  category: string;
  statementCategory: string;
  rawLine: string;
  sourceFile: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GARANTİ BONUS PARSER (mevcut)
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS_TR: Record<string, number> = {
  "Ocak": 1, "Şubat": 2, "Subat": 2, "Mart": 3, "Nisan": 4,
  "Mayıs": 5, "Mayis": 5, "Haziran": 6, "Temmuz": 7, "Ağustos": 8,
  "Agustos": 8, "Eylül": 9, "Eylul": 9, "Ekim": 10, "Kasım": 11,
  "Kasim": 11, "Aralık": 12, "Aralik": 12
};

const CATEGORY_HEADERS = [
  "Akaryakıt", "Hediyelik Eşya/Cam,Porselen Ürünleri", "Mobilya & Aksesuar",
  "Konaklama", "Cafe & Restaurant", "Süpermarket", "Fast Food", "Pastane",
  "Bilgisayar", "Eczane", "Kozmetik", "Ulaşım", "DİĞER HARCAMALARINIZ",
  "YURT DIŞI HARCAMALARINIZ", "BONUS PROGRAM ORTAKLARI'NDA YAPTIĞINIZ HARCAMALAR",
  "BONUS PROGRAM ORTAKLARI DIŞI HARCAMALARINIZ"
];

const NOISE_KEYWORDS = [
  "ÖDEMENİZ İÇİN TEŞEKKÜR", "ÖNCEKİ DÖNEMDEN", "DÖNEM FAİZİ",
  "KKDF", "BSMV", "BONUS BEDAVA", "Toplam", "Min. Ödeme",
  "Dönem Borcunuz", "NAKİT AVANS BİLGİLERİ"
];

const CITIES: Record<string, string[]> = {
  "İstanbul": ["ISTANBUL", "İSTANBUL", "FATİH", "BEYOĞLU", "ÇAPA", "MERTER", "TOPKAPI", "GALATA", "GALATAPORT", "FINDIKZADE", "YEŞİLKÖY"],
  "Nevşehir": ["NEVŞEHİR", "NEVSEHIR", "GÖREME", "GOREME", "UÇHİSAR", "UCHISAR", "AVANOS", "GÜLŞEHİR", "GULSEHIR"],
  "Tallinn": ["TALLINN", "ULEMISTE", "ÜLEMISTE", "KOTZEBUE", "MUSTAMAE", "VIIMSI", "REVAL", "SELVER", "LIDO", "IKEA TALLINN"],
  "Helsinki": ["HELSINKI", "LONNROTINKATU", "LÖNNROTINKATU", "ALEKSINKULMA", "CITYCENTER", "VIKINGLINE.FI", "VIKING LINE", "STOCKMANN"]
};

const CATEGORIES: Record<string, string[]> = {
  "Market": ["MIGROS", "BİM", "BIM", "MARKET", "SELVER", "K-MARKET", "A1000", "MERNUR", "GIDA"],
  "Restoran/Kafe": ["CAFE", "KAFE", "RESTAURANT", "RESTORAN", "BURGER", "KFC", "HAPPYMOONS", "ESPRESSOLAB", "KAHVE", "LIDO", "KEBAB", "MIDPOINT", "PEATUS"],
  "Konaklama": ["HOTEL", "BOOKING", "KONAK", "OTEL"],
  "Ulaşım": ["BELBIM", "MARMARAY", "VIKING", "AVIS", "BELEDİYESİ", "BELEDIYESI", "CIRCLE K"],
  "Giyim/Alışveriş": ["KOTON", "MARIMEKKO", "STOCKMANN", "OUTLET", "GRATİS", "GRATIS"],
  "Akaryakıt": ["SHELL", "PETRO", "CIRCLE K"],
  "Müze/Gezi": ["MÜZE", "MUZE", "ÖRENYERİ", "ORENYERI", "KİLİSE", "KILISE"],
  "Sağlık": ["ECZANE", "DİŞ", "DIS"],
  "Dijital/Abonelik": ["APPLE.COM", "MOBIMATTER", "PAY*"]
};

function inferCity(merchant: string): string {
  const upper = merchant.toUpperCase();
  for (const [city, keywords] of Object.entries(CITIES)) {
    if (keywords.some(kw => upper.includes(kw))) return city;
  }
  return "Bilinmiyor";
}

function inferCategory(merchant: string, statementHeader: string): string {
  const upper = merchant.toUpperCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => upper.includes(kw))) return category;
  }
  if (statementHeader.includes("YURT DIŞI")) return "Yurt dışı / Diğer";
  if (statementHeader.includes("DİĞER")) return "Diğer";
  if (statementHeader.includes("BONUS PROGRAM")) return "Bonus işyeri";
  if (statementHeader) return statementHeader;
  return "Bilinmiyor";
}

function parseGarantiStatement(text: string, filename: string): Transaction[] {
  const lines = text.split('\n');
  const transactions: Transaction[] = [];
  let currentCategory = "";

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, ' ');
    if (!line) continue;

    if (CATEGORY_HEADERS.includes(line)) {
      currentCategory = line;
      continue;
    }

    const dateMatch = line.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})\s+(.+)$/);
    if (!dateMatch) continue;

    if (NOISE_KEYWORDS.some(kw => line.toLowerCase().includes(kw.toLowerCase()))) continue;

    const [_, dayStr, monthStr, yearStr, rest] = dateMatch;
    const monthNum = MONTHS_TR[monthStr];
    if (!monthNum) continue;

    const date = new Date(parseInt(yearStr), monthNum - 1, parseInt(dayStr));
    const monthId = `${yearStr}-${monthNum.toString().padStart(2, '0')}`;

    const amountMatch = rest.match(/(-?\d{1,3}(?:\.\d{3})*,\d{2})(\+)?\s*$/);
    if (!amountMatch) continue;

    let amountStr = amountMatch[1].replace(/\./g, '').replace(',', '.');
    let amountTry = parseFloat(amountStr);
    if (amountMatch[2] === '+') amountTry = -amountTry;
    if (amountTry <= 0) continue;

    let restBeforeAmount = rest.substring(0, amountMatch.index).trim();
    restBeforeAmount = restBeforeAmount.replace(/\d{1,3}(?:\.\d{3})*,\d{2}x\d+=\d{1,3}(?:\.\d{3})*,\d{2}/g, '');
    restBeforeAmount = restBeforeAmount.replace(/\d+\.Taksit/gi, '');
    restBeforeAmount = restBeforeAmount.replace(/\s+/g, ' ').trim();

    let originalAmount: string | null = null;
    let currency = "TRY";
    let merchant = restBeforeAmount;

    const currencyMatch = restBeforeAmount.match(/(\d{1,3}(?:[.,]\d{2})?)\s*(EUR|USD|GBP)/i);
    if (currencyMatch) {
      originalAmount = currencyMatch[1];
      currency = currencyMatch[2].toUpperCase();
      merchant = restBeforeAmount.substring(0, currencyMatch.index).trim();
    } else {
      merchant = restBeforeAmount.replace(/\s+-?\d{1,3}(?:\.\d{3})*,\d{2}\s*$/, '').trim();
    }

    if (!merchant) continue;

    transactions.push({
      date,
      month: monthId,
      merchant,
      amountTry,
      currency,
      originalAmount,
      city: inferCity(merchant),
      category: inferCategory(merchant, currentCategory),
      statementCategory: currentCategory,
      rawLine: line,
      sourceFile: filename
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// TÜRKİYE FİNANS / HAPPY KART PARSER
// Format: GG/AA/YYYY   MERCHANT ADI ŞEHİR TR   [bonus?]   TUTAR
// ─────────────────────────────────────────────────────────────────────────────

const TF_NOISE = [
  "DEVREDEN BAKİYE", "MBL-ÖDEME", "TEŞEKKÜR", "TOPLAM TL",
  "HAPPY KART HESAP", "Hesap özetiniz", "Bir sonraki", "Sayfa",
  "MESAJINIZ VAR", "TARİHİ İTİBARİYLE", "REFERANS ORANI",
  "Önceki Bakiye", "Dönem Harcamaları", "Karpayı", "Ödemeleriniz",
  "Dönem Borcunuz", "Min. Ödeme", "HAPPY GOLD KART", "Ödeme ve Kâr",
  "Toplam Borç", "Asgari Ödeme", "Akdi Kâr", "Gecikme Cezası",
  "Bonus", "Kart Numarası", "Müşteri", "Azami", "Nakit Avans",
  "Hesap Kesim", "Son Ödeme", "Yıllık", "Sayın", "MAH.", "Şubesi",
  "TROY", "Fatura Hizmet Bedeli",
];

const TF_CITIES: Record<string, string[]> = {
  "İstanbul":  ["ISTANBUL", "İSTANBUL", "GAZİOSMANPAŞA", "GAZIOSMANPASA", "BAYR", "KUCUKKOY", "POLIGON"],
  "Ordu":      ["ORDU", "ÜNYE", "UNYE"],
  "Samsun":    ["SAMSUN"],
  "Çankırı":   ["CANKIRI", "ÇANKIRI"],
  "Ankara":    ["ANKARA"],
  "Gaziantep": ["GAZİANTEP", "GAZIANTEP"],
};

const TF_CATEGORIES: Record<string, string[]> = {
  "Akaryakıt":         ["SHELL", "PETROL", "OPET", "AKB AKARYAKIT", "ÇIRPICI SHELL", "CIRPICI SHELL"],
  "Market":            ["BİM", "BIM", "A101", "CARREFOURSA", "GÖKKUŞAĞI", "EDA MARKET", "BİR MAR", "YAVUZ MARKET",
                        "GIDA", "SERVETIM KURUYEMIS", "ASLANOĞLU FIRIN", "YUNUS TAVUKÇULUK", "EMİROĞLU"],
  "Giyim/Alışveriş":  ["LCWAİKİKİ", "LCWAIKIKI", "DECATHLON", "GRATİS", "GRATIS", "MÜEZZİNOĞLU"],
  "Restoran/Kafe":     ["MC DONALDS", "MCDONALD", "FAVORI CAFE", "FOCACCİA", "BÜFE", "HACI MUSTAFA"],
  "Çocuk/Anne-Bebek": ["EBEBEK"],
  "Sağlık/Eczane":    ["ECZANE", "HASTANESİ", "HASTANE"],
  "Fatura/Abonelik":  ["İGDAŞ", "IGDAS", "İSKİ", "ISKI", "TURKNET", "TÜRK TELEK", "TURK TELEK",
                       "CK BOĞAZİÇ", "N KOLAY", "GUMRUK EXPORT", "HAKAN AÇIKKOLLU"],
  "Diğer":            [],
};

function tfInferCity(merchant: string): string {
  const upper = merchant.toUpperCase();
  for (const [city, kws] of Object.entries(TF_CITIES)) {
    if (kws.some(kw => upper.includes(kw))) return city;
  }
  return "Bilinmiyor";
}

function tfInferCategory(merchant: string): string {
  const upper = merchant.toUpperCase();
  for (const [cat, kws] of Object.entries(TF_CATEGORIES)) {
    if (kws.length > 0 && kws.some(kw => upper.includes(kw))) return cat;
  }
  return "Diğer";
}

function parseTurkiyeFinansStatement(text: string, filename: string): Transaction[] {
  const lines = text.split('\n');
  const transactions: Transaction[] = [];

  // GG/AA/YYYY   merchant text   [optional bonus float]   tutar
  const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+)$/;
  // Son tutarı yakala: 1.660,00 veya 1660.00 veya 126.00 formatları
  const AMOUNT_RE = /(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/;

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, ' ');
    if (!line) continue;
    if (TF_NOISE.some(n => line.includes(n))) continue;

    const dm = line.match(DATE_RE);
    if (!dm) continue;

    const [, dayStr, monStr, yearStr, rest] = dm;
    const day   = parseInt(dayStr, 10);
    const month = parseInt(monStr, 10);
    const year  = parseInt(yearStr, 10);
    if (month < 1 || month > 12) continue;

    const date    = new Date(year, month - 1, day);
    const monthId = `${year}-${monStr}`;

    const am = rest.match(AMOUNT_RE);
    if (!am) continue;

    // Tutarı parse et: hem "1.660,00" hem "1660.00" formatını destekle
    let rawAmt = am[1];
    if (rawAmt.includes(',')) {
      // Türk formatı: 1.660,00
      rawAmt = rawAmt.replace(/\./g, '').replace(',', '.');
    }
    const amountTry = parseFloat(rawAmt);
    if (!isFinite(amountTry) || amountTry <= 0) continue;

    // Merchant: tutardan önce kalan metin
    let merchantRaw = rest.substring(0, am.index!).trim();
    // Taksit/bonus: "3\3" gibi gösterimleri kaldır
    merchantRaw = merchantRaw.replace(/\s+\d+\\\d+\s*$/, '').trim();
    // Küçük bonus sayısını kaldır (örn "0.04" veya "1.66" gibi 4 haneden az)
    merchantRaw = merchantRaw.replace(/\s+\d{1,3}\.\d{2}$/, '').trim();

    if (!merchantRaw) continue;

    transactions.push({
      date,
      month: monthId,
      merchant: merchantRaw,
      amountTry,
      currency: "TRY",
      originalAmount: null,
      city: tfInferCity(merchantRaw),
      category: tfInferCategory(merchantRaw),
      statementCategory: "Türkiye Finans Happy Kart",
      rawLine: line,
      sourceFile: filename,
    });
  }

  return transactions;
}

// ─────────────────────────────────────────────────────────────────────────────
// OTOMATIK FORMAT ALGILAMA + ANA EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function detectFormat(text: string): "garanti" | "turkiyefinans" | "unknown" {
  if (text.includes("TROY GOLD HAPPY") || text.includes("Türkiye Finans") ||
      text.includes("turkiyefinans") || text.includes("HAPPY KART HESAP")) {
    return "turkiyefinans";
  }
  if (text.includes("GARANTİ") || text.includes("BONUS PROGRAM ORTAKLARI") ||
      text.includes("BONUS BEDAVA")) {
    return "garanti";
  }
  // Tarih formatına göre tahmin et
  if (/\d{2}\/\d{2}\/\d{4}/.test(text)) return "turkiyefinans";
  if (/\d{1,2}\s+(?:Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)/.test(text)) return "garanti";
  return "unknown";
}

export function parseStatement(text: string, filename: string): Transaction[] {
  const format = detectFormat(text);
  if (format === "turkiyefinans") {
    return parseTurkiyeFinansStatement(text, filename);
  }
  // Garanti veya bilinmeyen: Garanti parser'ı dene
  return parseGarantiStatement(text, filename);
}
