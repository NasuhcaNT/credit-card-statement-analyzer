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
  "DEVREDEN BAK", "MBL-ÖDEME", "ÖDEME TEŞEKKÜR", "TOPLAM TL",
  "HAPPY KART HESAP", "HAPPY GOLD KART", "Hesap özetiniz", "Bir sonraki",
  "MESAJINIZ VAR", "TARİHİ İTİBARİYLE", "REFERANS ORANI", "DÖNEM BORCU",
  "Önceki Bakiye", "Dönem Harcamaları", "Karpayı", "Ödemeleriniz",
  "Dönem Borcunuz", "Min. Ödeme", "Ödeme ve Kâr", "Toplam Borç",
  "Asgari Ödeme", "Akdi Kâr", "Gecikme Cezası", "Kart Numarası",
  "Müşteri Numarası", "Azami Harcama", "Nakit Avans", "Hesap Kesim",
  "Son Ödeme Tarihi", "Yıllık Akdi", "Yıllık Gecikme", "Sayın;", "MAH.",
  "Şubesi", "TROY GOLD", "İşlem Tarihi", "Dönem İçi İşlemler", "Sayfa :",
  "NURULLAH", "TL Anapara", "Kar+Vergi", "Bugüne Kadar", "Devreden Bonus",
  "Bu Dönem Kazanılan", "Bu Dönem Harcanan", "Harcanabilecek",
];

const TF_CITY_NAMES = [
  "İSTANBUL", "ISTANBUL", "ORDU", "ÜNYE", "UNYE", "SAMSUN", "ÇANKIRI", "CANKIRI",
  "ANKARA", "GAZİANTEP", "GAZIANTEP",
];

const TF_CITY_MAP: Record<string, string> = {
  "İSTANBUL": "İstanbul", "ISTANBUL": "İstanbul",
  "ORDU": "Ordu", "ÜNYE": "Ordu", "UNYE": "Ordu",
  "SAMSUN": "Samsun",
  "ÇANKIRI": "Çankırı", "CANKIRI": "Çankırı",
  "ANKARA": "Ankara",
  "GAZİANTEP": "Gaziantep", "GAZIANTEP": "Gaziantep",
};

const TF_CATEGORIES: Record<string, string[]> = {
  "Akaryakıt":         ["SHELL", "PETROL", "OPET", "AKARYAKIT", "CEM PETROL"],
  "Market":            ["BİM", "BIM", "A101", "CARREFOURSA", "MARKET", "MERKET", "GÖKKUŞAĞI",
                        "GOKKUSAGI", "EDA MARKET", "BİR MAR", "BIR MAR", "YAVUZ MARKET",
                        "SERVETIM", "KURUYEMIS", "ASLANOĞLU", "ASLANOGLU", "FIRIN",
                        "YUNUS TAVUK", "EMİROĞLU", "EMIROGLU", "ENGIN GOKPINAR", "AHMET TURKMEN"],
  "Giyim/Alışveriş":  ["LCWAİKİKİ", "LCWAIKIKI", "LC WAIKIKI", "DECATHLON", "GRATİS", "GRATIS",
                        "MÜEZZİNOĞLU", "MUEZZINOGLU", "AVM"],
  "Restoran/Kafe":     ["MC DONALDS", "MCDONALD", "FAVORI CAFE", "CAFE", "RESTORAN",
                        "FOCACCİA", "FOCACCIA", "BÜFE", "BUFE", "HACI MUSTAFA"],
  "Çocuk/Anne-Bebek": ["EBEBEK"],
  "Sağlık/Eczane":    ["ECZANE", "HASTANESİ", "HASTANESI", "HASTANE", "ŞEHİR HASTANESİ", "SEHIR HASTANESI"],
  "Fatura/Abonelik":  ["İGDAŞ", "IGDAS", "İSKİ", "ISKI", "TURKNET", "TÜRK TELEK", "TURK TELEK",
                       "CK BOĞAZİÇ", "CK BOGAZIC", "N KOLAY", "GUMRUK EXPORT", "HAKAN AÇIKKOLLU",
                       "5056915752", "4756650", "5457351510", "67471222", "500106008388", "0979427313"],
  "Kâr Payı/Ücret":   ["FATURA HİZMET BEDELİ", "FATURA HIZMET BEDELI"],
};

function tfNorm(s: string): string {
  return s
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .toUpperCase();
}

function parseTfAmount(amount: string): number {
  // Türkiye Finans: virgül binlik ayırıcı, nokta ondalık. Örn 1,660.00
  return parseFloat(amount.replace(/,/g, ""));
}

function tfInferCity(merchant: string): string {
  const upper = tfNorm(merchant);
  // Satır sonundaki ŞEHİR + TR/TU kalıbını öncelikli yakala
  const endCity = upper.match(
    new RegExp(`\\b(${TF_CITY_NAMES.map(tfNorm).join("|")})\\b\\s*(TR|TU)?\\s*$`)
  );
  if (endCity) {
    const matched = TF_CITY_NAMES.find(c => tfNorm(c) === endCity[1]);
    return (matched && TF_CITY_MAP[matched]) || "Bilinmiyor";
  }
  for (const city of TF_CITY_NAMES) {
    if (upper.includes(tfNorm(city))) return TF_CITY_MAP[city] || "Bilinmiyor";
  }
  return "Bilinmiyor";
}

function tfInferCategory(merchant: string): string {
  const upper = tfNorm(merchant);
  for (const [cat, kws] of Object.entries(TF_CATEGORIES)) {
    if (kws.some(kw => upper.includes(tfNorm(kw)))) return cat;
  }
  return "Diğer";
}

function tfCleanMerchant(merchantRaw: string): string {
  let merchant = merchantRaw
    .replace(/\s+/g, " ")
    .replace(/\s+\d+\\\d+\s*$/g, "")   // 3\3 taksit bilgisi
    .replace(/\s+\d+\/\d+\s*$/g, "")    // 3/3 gelirse
    .trim();
  // Happy Bonus kolonu: tutardan hemen önce 100 altı ondalık sayı
  merchant = merchant.replace(/\s+\d{1,2}\.\d{2}\s*$/g, "").trim();
  // En sondaki TR/TU ülke kodunu sil
  merchant = merchant.replace(/\s+(TR|TU)\s*$/i, "").trim();
  return merchant;
}

function parseTurkiyeFinansStatement(text: string, filename: string): Transaction[] {
  const transactions: Transaction[] = [];

  // PDF satır kırılmalarında bazı satırlar bölünebildiği için önce
  // tarih satırlarını tespit edip sonraki satırları birleştiriyoruz.
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidateLines: string[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+/.test(line)) {
      candidateLines.push(line);
    } else if (candidateLines.length > 0 && !/^\d+$/.test(line)) {
      const last = candidateLines[candidateLines.length - 1];
      const lastHasAmount = /[+-]?\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:TL)?\s*$/.test(last);
      if (!lastHasAmount && !line.includes("TL Anapara") && !line.includes("Kar+Vergi")) {
        candidateLines[candidateLines.length - 1] += " " + line;
      }
    }
  }

  const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/;
  const AMOUNT_RE = /([+-]?\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:TL)?\s*$/;

  for (const raw of candidateLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const upperLine = tfNorm(line);
    if (TF_NOISE.some(n => upperLine.includes(tfNorm(n)))) continue;

    const dm = line.match(DATE_RE);
    if (!dm) continue;

    const [, dayStr, monStr, yearStr, rest] = dm;
    const day   = parseInt(dayStr, 10);
    const month = parseInt(monStr, 10);
    const year  = parseInt(yearStr, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const am = rest.match(AMOUNT_RE);
    if (!am || am.index === undefined) continue;

    const amountTry = parseTfAmount(am[1]);
    if (!isFinite(amountTry) || amountTry <= 0 || am[1].startsWith("+")) continue;

    const merchantRaw = rest.substring(0, am.index).trim();
    const merchant = tfCleanMerchant(merchantRaw);

    if (!merchant) continue;
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(merchant)) continue;

    const mm = month.toString().padStart(2, "0");
    transactions.push({
      date: new Date(year, month - 1, day),
      month: `${year}-${mm}`,
      merchant,
      amountTry,
      currency: "TRY",
      originalAmount: null,
      city: tfInferCity(merchantRaw),
      category: tfInferCategory(merchant),
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

function detectFormat(text: string): "garanti" | "turkiyefinans" {
  if (
    text.includes("TROY GOLD HAPPY") ||
    text.includes("Türkiye Finans") ||
    text.includes("turkiyefinans") ||
    text.includes("HAPPY KART HESAP") ||
    /\d{1,2}\/\d{1,2}\/\d{4}/.test(text)
  ) return "turkiyefinans";
  return "garanti";
}

export function parseStatement(text: string, filename: string): Transaction[] {
  const format = detectFormat(text);
  if (format === "turkiyefinans") return parseTurkiyeFinansStatement(text, filename);
  return parseGarantiStatement(text, filename);
}
