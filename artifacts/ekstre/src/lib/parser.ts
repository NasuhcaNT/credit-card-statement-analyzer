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
    if (keywords.some(kw => upper.includes(kw))) {
      return city;
    }
  }
  return "Bilinmiyor";
}

function inferCategory(merchant: string, statementHeader: string): string {
  const upper = merchant.toUpperCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => upper.includes(kw))) {
      return category;
    }
  }
  
  if (statementHeader.includes("YURT DIŞI")) return "Yurt dışı / Diğer";
  if (statementHeader.includes("DİĞER")) return "Diğer";
  if (statementHeader.includes("BONUS PROGRAM")) return "Bonus işyeri";
  
  if (statementHeader) return statementHeader;
  return "Bilinmiyor";
}

export function parseStatement(text: string, filename: string): Transaction[] {
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
