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

// =============================================================================
// GARANTİ BONUS PARSER
// =============================================================================

const MONTHS_TR: Record<string, number> = {
  Ocak: 1,
  Şubat: 2,
  Subat: 2,
  Mart: 3,
  Nisan: 4,
  Mayıs: 5,
  Mayis: 5,
  Haziran: 6,
  Temmuz: 7,
  Ağustos: 8,
  Agustos: 8,
  Eylül: 9,
  Eylul: 9,
  Ekim: 10,
  Kasım: 11,
  Kasim: 11,
  Aralık: 12,
  Aralik: 12,
};

const CATEGORY_HEADERS = [
  "Akaryakıt",
  "Hediyelik Eşya/Cam,Porselen Ürünleri",
  "Mobilya & Aksesuar",
  "Konaklama",
  "Cafe & Restaurant",
  "Market",
  "Fast Food",
  "Pastane",
  "Bilgisayar",
  "Eczane",
  "Kozmetik",
  "Ulaşım",
  "DİĞER HARCAMALARINIZ",
  "YURT DIŞI HARCAMALARINIZ",
  "BONUS PROGRAM ORTAKLARI'NDA YAPTIĞINIZ HARCAMALAR",
  "BONUS PROGRAM ORTAKLARI DIŞI HARCAMALARINIZ",
  "Finans",
];

const NOISE_KEYWORDS = [
  "ÖDEMENİZ İÇİN TEŞEKKÜR",
  "ÖNCEKİ DÖNEMDEN",
  "DÖNEM FAİZİ",
  "KKDF",
  "BSMV",
  "BONUS BEDAVA",
  "Toplam",
  "Min. Ödeme",
  "Dönem Borcunuz",
  "NAKİT AVANS BİLGİLERİ",
];

// =============================================================================
// ORTAK ŞEHİR / KATEGORİ SÖZLÜKLERİ
// Garanti ve Türkiye Finans parser'ları aynı inferCity / inferCategory fonksiyonlarını kullanır.
// Yeni banka formatı eklendiğinde sadece burayı genişletmek yeterli olur.
// =============================================================================

const COMMON_CITIES: Record<string, string[]> = {
  İstanbul: [
    "ISTANBUL",
    "İSTANBUL",
    "IST",
    "İST",
    "FATİH",
    "FATIH",
    "BEYOĞLU",
    "BEYOGLU",
    "ÇAPA",
    "CAPA",
    "MERTER",
    "TOPKAPI",
    "GALATA",
    "GALATAPORT",
    "FINDIKZADE",
    "YEŞİLKÖY",
    "YESILKOY",
    "GAZİOSMANPAŞA",
    "GAZIOSMANPASA",
    "KUCUKKOY",
    "KÜÇÜKKÖY",
    "POLIGON",
    "POLİGON",
    "KADIKÖY",
    "KADIKOY",
    "ÜSKÜDAR",
    "USKUDAR",
    "BEŞİKTAŞ",
    "BESIKTAS",
    "ŞİŞLİ",
    "SISLI",
    "BAKIRKÖY",
    "BAKIRKOY",
    "ATAŞEHİR",
    "ATASEHIR",
    "MALTEPE",
    "PENDİK",
    "PENDIK",
    "KARTAL",
    "SARIYER",
    "BAYRAMPAŞA",
    "BAYRAMPASA",
    "ESENLER",
    "BAĞCILAR",
    "BAGCILAR",
    "AVCILAR",
    "BEYLİKDÜZÜ",
    "BEYLIKDUZU",
    "ÜMRANİYE",
    "UMRANIYE",
    "ASMALI",
    "SUADIYE",
    "KALAMIŞ",
    "KOCAMUSTAFAPAŞA",
    "CEVAHİR",
    "KUZGUNCUK",
    "HEKİMOĞLU",
    "AKSARAY",
    "BELBIM",
    "PAŞA LİMANI",
    "PERA",
    "TEPEBASI",
    "GRANDPERA",
  ],
  Ankara: [
    "ANKARA",
    "ÇANKAYA",
    "CANKAYA",
    "KIZILAY",
    "ULUS",
    "KEÇİÖREN",
    "KECIOREN",
    "MAMAK",
    "YENİMAHALLE",
    "YENIMAHALLE",
    "ETİMESGUT",
    "ETIMESGUT",
    "SİNCAN",
    "SINCAN",
    "ALTINDAĞ",
    "ALTINDAG",
    "ERYAMAN",
    "BİLKENT",
    "BILKENT",
    "BATIKENT",
    "PURSAKLAR",
    "GÖLBAŞI",
    "GOLBASI",
  ],
  İzmir: [
    "İZMİR",
    "IZMIR",
    "KONAK",
    "KARŞIYAKA",
    "KARSIYAKA",
    "BORNOVA",
    "BUCA",
    "BALÇOVA",
    "BALCOVA",
    "ALSANCAK",
    "GÜZELYALI",
    "GUZELYALI",
    "GÖZTEPE",
    "GOZTEPE",
    "ÇİĞLİ",
    "CIGLI",
    "NARLIDERE",
    "URLA",
    "FOÇA",
    "FOCA",
    "MENEMEN",
    "TORBALI",
    "BAYRAKLI",
    "KEMERALTI",
    "KARABAĞLAR",
    "KARABAGLAR",
  ],
  Antalya: [
    "ANTALYA",
    "MURATPAŞA",
    "MURATPASA",
    "KEPEZ",
    "KONYAALTI",
    "LARA",
    "KUNDU",
    "AKSU",
    "ALANYA",
    "MANAVGAT",
    "SİDE",
    "SIDE",
    "KAŞ",
    "KAS",
    "KALKAN",
    "KEMER",
    "BELEK",
    "SERİK",
    "SERIK",
  ],
  Ordu: ["ORDU", "ÜNYE", "UNYE", "FATSA", "ALTINORDU"],
  Samsun: [
    "SAMSUN",
    "ATAKUM",
    "İLKADIM",
    "ILKADIM",
    "CANİK",
    "CANIK",
    "TEKKEKÖY",
    "TEKKEKOY",
  ],
  Çankırı: ["ÇANKIRI", "CANKIRI"],
  Gaziantep: [
    "GAZİANTEP",
    "GAZIANTEP",
    "ŞAHİNBEY",
    "SAHINBEY",
    "ŞEHİTKAMİL",
    "SEHITKAMIL",
  ],
  Nevşehir: [
    "NEVŞEHİR",
    "NEVSEHIR",
    "GÖREME",
    "GOREME",
    "UÇHİSAR",
    "UCHISAR",
    "AVANOS",
    "GÜLŞEHİR",
    "GULSEHIR",
  ],
  Tallinn: [
    "TALLINN",
    "ULEMISTE",
    "ÜLEMISTE",
    "KOTZEBUE",
    "MUSTAMAE",
    "VIIMSI",
    "REVAL",
    "SELVER",
    "LIDO",
    "IKEA TALLINN",
  ],
  Helsinki: [
    "HELSINKI",
    "LONNROTINKATU",
    "LÖNNROTINKATU",
    "ALEKSINKULMA",
    "CITYCENTER",
    "VIKINGLINE.FI",
    "VIKING LINE",
    "STOCKMANN",
  ],
};

const COMMON_CATEGORIES: Record<string, string[]> = {
  Akaryakıt: ["SHELL", "PETROL", "OPET", "AKARYAKIT", "CEM PETROL", "CIRCLE K"],
  Market: [
    "MIGROS",
    "BİM",
    "BIM",
    "A101",
    "CARREFOURSA",
    "MARKET",
    "MERKET",
    "GÖKKUŞAĞI",
    "GOKKUSAGI",
    "SELVER",
    "K-MARKET",
    "A1000",
    "MERNUR",
    "GIDA",
    "EDA MARKET",
    "BİR MAR",
    "BIR MAR",
    "YAVUZ MARKET",
    "SERVETIM",
    "KURUYEMIS",
    "ASLANOĞLU",
    "ASLANOGLU",
    "FIRIN",
    "YUNUS TAVUK",
    "EMİROĞLU",
    "EMIROGLU",
    "ENGIN GOKPINAR",
    "AHMET TURKMEN",
  ],
  "Cafe & Restaurant": [
    "CAFE",
    "KAFE",
    "RESTAURANT",
    "RESTORAN",
    "BURGER",
    "KFC",
    "HAPPYMOONS",
    "ESPRESSOLAB",
    "KAHVE",
    "LIDO",
    "KEBAB",
    "MIDPOINT",
    "PEATUS",
    "MC DONALDS",
    "MCDONALD",
    "FAVORI CAFE",
    "FOCACCİA",
    "FOCACCIA",
    "BÜFE",
    "BUFE",
    "HACI MUSTAFA",
    "SOSYAL TESİS",
  ],
  "Giyim/Alışveriş": [
    "KOTON",
    "MARIMEKKO",
    "STOCKMANN",
    "OUTLET",
    "GRATİS",
    "GRATIS",
    "LCWAİKİKİ",
    "LCWAIKIKI",
    "LC WAIKIKI",
    "DECATHLON",
    "MÜEZZİNOĞLU",
    "MUEZZINOGLU",
    "AVM",
    "IKEA",
  ],
  "Sağlık/Eczane": [
    "ECZANE",
    "HASTANESİ",
    "HASTANESI",
    "HASTANE",
    "ŞEHİR HASTANESİ",
    "SEHIR HASTANESI",
    "DİŞ",
    "DIS",
  ],
  "Fatura/Abonelik": [
    "İGDAŞ",
    "IGDAS",
    "İSKİ",
    "ISKI",
    "TURKNET",
    "TÜRK TELEK",
    "TURK TELEK",
    "CK BOĞAZİÇ",
    "CK BOGAZIC",
    "N KOLAY",
    "GUMRUK EXPORT",
    "HAKAN AÇIKKOLLU",
    "APPLE.COM",
    "MOBIMATTER",
    "PAY*",
    "5056915752",
    "4756650",
    "5457351510",
    "67471222",
    "500106008388",
    "0979427313",
  ],
  Ulaşım: [
    "BELBIM",
    "MARMARAY",
    "VIKING",
    "AVIS",
    "BELEDİYESİ",
    "BELEDIYESI",
    "TAKSİ",
    "TAKSI",
    "METRO",
    "OTOBÜS",
    "OTOBUS",
  ],
  Konaklama: ["HOTEL", "BOOKING", "KONAK", "OTEL", "PANSİYON", "PANSIYON"],
  "Müze/Gezi": ["MÜZE", "MUZE", "ÖRENYERİ", "ORENYERI", "KİLİSE", "KILISE"],
  "Çocuk/Anne-Bebek": ["EBEBEK"],
  "Kâr Payı/Ücret": ["FATURA HİZMET BEDELİ", "FATURA HIZMET BEDELI"],

  Finans: [
    "FAİZ",
    "FAIZ",
    "AKDİ KÂR PAYI",
    "AKDI KAR PAYI",
    "KÂR PAYI",
    "KAR PAYI",
    "GECİKME FAİZİ",
    "GECIKME FAIZI",
    "GECİKME CEZASI",
    "GECIKME CEZASI",
    "FATURA HİZMET BEDELİ",
    "FATURA HIZMET BEDELI",
    "KKDF",
    "BSMV",
    "VERGİ",
    "VERGI",
    "KREDİ FAİZİ",
    "KREDI FAIZI",
    "TAHSİLAT FAİZİ",
    "TAHSILAT FAIZI",
    "TEMERRÜT",
    "TEMERRUT",
    "NAKİT AVANS",
    "NAKIT AVANS",
    "NAKİT ÇEKİM",
    "NAKIT CEKIM",
    "OVERLIMIT",
    "LİMİT AŞIM",
    "LIMIT ASIM",
    "BORÇ TRANSFER",
    "BORC TRANSFER",
    "KART ÜCRETİ",
    "KART UCRETI",
    "YILLIK KART ÜCRETİ",
    "YILLIK KART UCRETI",
    "KART AİDATI",
    "KART AIDATI",
    "AİDAT",
    "AIDAT",
    "EK KART ÜCRETİ",
    "EK KART UCRETI",
    "EFT ÜCRETİ",
    "EFT UCRETI",
    "FAST ÜCRETİ",
    "FAST UCRETI",
    "HAVALE ÜCRETİ",
    "HAVALE UCRETI",
    "DOSYA MASRAFI",
    "HESAP İŞLETİM ÜCRETİ",
    "HESAP ISLETIM UCRETI",
    "BANKA KOMİSYONU",
    "BANKA KOMISYONU",
    "KOMİSYON",
    "KOMISYON",
  ],
};

function normText(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferCity(merchant: string): string {
  const upper = normText(merchant);

  // Öncelik: satır sonundaki şehir + TR/TU kalıbı. Örn: "... SAMSUN TR" kesin Samsun.
  for (const [city, keywords] of Object.entries(COMMON_CITIES)) {
    for (const kw of keywords) {
      const normalizedKeyword = normText(kw);
      const endRegex = new RegExp(
        `\\b${escapeRegExp(normalizedKeyword)}\\b\\s*(TR|TU)?\\s*$`,
      );
      if (endRegex.test(upper)) return city;
    }
  }

  for (const [city, keywords] of Object.entries(COMMON_CITIES)) {
    if (keywords.some((kw) => upper.includes(normText(kw)))) return city;
  }
  return "Bilinmiyor";
}

function inferCategory(merchant: string, statementHeader = ""): string {
  const upper = normText(merchant);
  for (const [category, keywords] of Object.entries(COMMON_CATEGORIES)) {
    if (keywords.some((kw) => upper.includes(normText(kw)))) return category;
  }
  const header = normText(statementHeader);
  if (header.includes("YURT DISI")) return "Yurt dışı / Diğer";
  if (header.includes("DIGER")) return "Diğer";
  if (header.includes("BONUS PROGRAM")) return "Bonus işyeri";
  if (statementHeader) return statementHeader;
  return "Bilinmiyor";
}

function parseGarantiStatement(text: string, filename: string): Transaction[] {
  const lines = text.split("\n");
  const transactions: Transaction[] = [];
  let currentCategory = "";

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, " ");
    if (!line) continue;

    if (CATEGORY_HEADERS.includes(line)) {
      currentCategory = line;
      continue;
    }

    const dateMatch = line.match(
      /^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})\s+(.+)$/,
    );
    if (!dateMatch) continue;
    if (
      NOISE_KEYWORDS.some((kw) => line.toLowerCase().includes(kw.toLowerCase()))
    )
      continue;

    const [_, dayStr, monthStr, yearStr, rest] = dateMatch;
    const monthNum = MONTHS_TR[monthStr];
    if (!monthNum) continue;

    const date = new Date(parseInt(yearStr), monthNum - 1, parseInt(dayStr));
    const monthId = `${yearStr}-${monthNum.toString().padStart(2, "0")}`;

    const amountMatch = rest.match(/(-?\d{1,3}(?:\.\d{3})*,\d{2})(\+)?\s*$/);
    if (!amountMatch) continue;

    let amountStr = amountMatch[1].replace(/\./g, "").replace(",", ".");
    let amountTry = parseFloat(amountStr);
    if (amountMatch[2] === "+") amountTry = -amountTry;
    if (amountTry <= 0) continue;

    let restBeforeAmount = rest.substring(0, amountMatch.index).trim();
    restBeforeAmount = restBeforeAmount.replace(
      /\d{1,3}(?:\.\d{3})*,\d{2}x\d+=\d{1,3}(?:\.\d{3})*,\d{2}/g,
      "",
    );
    restBeforeAmount = restBeforeAmount.replace(/\d+\.Taksit/gi, "");
    restBeforeAmount = restBeforeAmount.replace(/\s+/g, " ").trim();

    let originalAmount: string | null = null;
    let currency = "TRY";
    let merchant = restBeforeAmount;

    const currencyMatch = restBeforeAmount.match(
      /(\d{1,3}(?:[.,]\d{2})?)\s*(EUR|USD|GBP)/i,
    );
    if (currencyMatch) {
      originalAmount = currencyMatch[1];
      currency = currencyMatch[2].toUpperCase();
      merchant = restBeforeAmount.substring(0, currencyMatch.index).trim();
    } else {
      merchant = restBeforeAmount
        .replace(/\s+-?\d{1,3}(?:\.\d{3})*,\d{2}\s*$/, "")
        .trim();
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
      sourceFile: filename,
    });
  }

  return transactions;
}

// =============================================================================
// TÜRKİYE FİNANS / HAPPY KART PARSER (daha toleranslı sürüm)
// =============================================================================

const TF_NOISE = [
  "DEVREDEN BAKİYE",
  "MBL-ÖDEME",
  "ÖDEME TEŞEKKÜR",
  "TOPLAM TL",
  "HAPPY KART HESAP",
  "HAPPY GOLD KART",
  "Hesap özetiniz",
  "Bir sonraki",
  "MESAJINIZ VAR",
  "TARİHİ İTİBARİYLE",
  "REFERANS ORANI",
  "DÖNEM BORCU",
  "Önceki Bakiye",
  "Dönem Harcamaları",
  "Karpayı",
  "Ödemeleriniz",
  "Dönem Borcunuz",
  "Min. Ödeme",
  "Ödeme ve Kâr",
  "Toplam Borç",
  "Asgari Ödeme",
  "Akdi Kâr",
  "Gecikme Cezası",
  "Kart Numarası",
  "Müşteri Numarası",
  "Azami Harcama",
  "Nakit Avans",
  "Hesap Kesim",
  "Son Ödeme Tarihi",
  "Yıllık Akdi",
  "Yıllık Gecikme",
  "Sayın;",
  "MAH.",
  "Şubesi",
  "TROY GOLD",
  "İşlem Tarihi",
  "Dönem İçi İşlemler",
  "Sayfa :",
  "NURULLAH",
  "TL Anapara",
  "Kar+Vergi",
  "Bugüne Kadar",
  "Devreden Bonus",
  "Bu Dönem Kazanılan",
  "Bu Dönem Harcanan",
  "Harcanabilecek",
];

// Türkiye Finans parser da ortak sözlükleri kullanır. Eski fonksiyon isimlerini
// içeride bozmamak için aşağıdaki küçük wrapper'lar bırakıldı.
function tfInferCity(merchant: string): string {
  return inferCity(merchant);
}

function tfInferCategory(merchant: string): string {
  return inferCategory(merchant);
}

function tfNorm(s: string): string {
  return normText(s);
}

function parseTfAmount(amount: string): number {
  // Türkiye Finans: virgül binlik, nokta ondalık. Örn 1,660.00
  return parseFloat(amount.replace(/,/g, ""));
}

function tfCleanMerchant(merchantRaw: string): string {
  let merchant = merchantRaw
    .replace(/\s+/g, " ")
    .replace(/\s+\d+\\\d+\s*$/g, "") // 3\3 taksit bilgisi
    .replace(/\s+\d+\/\d+\s*$/g, "") // 3/3 gelirse
    .trim();

  // Happy Bonus kolonu: tutardan hemen önce 0.04 / 1.66 gibi küçük sayı.
  // Burada 100 altı ondalık sayıyı satır sonundan siliyoruz.
  merchant = merchant.replace(/\s+\d{1,2}\.\d{2}\s*$/g, "").trim();

  // Bazı PDF çıktılarında country kodları merchant içinde kalıyor; şehir yakalamak için kalsın,
  // ama merchant adını temiz göstermek için sadece en sondaki TR/TU'yu atıyoruz.
  merchant = merchant.replace(/\s+(TR|TU)\s*$/i, "").trim();
  return merchant;
}

function parseTurkiyeFinansStatement(
  text: string,
  filename: string,
): Transaction[] {
  const transactions: Transaction[] = [];

  // PDF satır kırılmalarında bazı satırlar bölünebildiği için önce satırları normalleştiriyoruz.
  // Bir tarih satırı gördüğümüzde, yeni işlem başlamış kabul ediyoruz.
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidateLines: string[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+/.test(line)) {
      candidateLines.push(line);
    } else if (candidateLines.length > 0 && !/^\d+$/.test(line)) {
      // Sadece önceki tarih satırının sonunda tutar yoksa devam satırını ekle.
      // Böylece sayfa başlığı/altlığı veya TOPLAM TL gibi satırlar son işlemi bozmaz.
      const last = candidateLines[candidateLines.length - 1];
      const lastHasAmount = /[+-]?\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:TL)?\s*$/.test(
        last,
      );
      if (
        !lastHasAmount &&
        !line.includes("TL Anapara") &&
        !line.includes("Kar+Vergi")
      ) {
        candidateLines[candidateLines.length - 1] += " " + line;
      }
    }
  }

  const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/;
  const AMOUNT_RE = /([+-]?\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:TL)?\s*$/;

  for (const raw of candidateLines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const upperLine = tfNorm(line);
    if (TF_NOISE.some((n) => upperLine.includes(tfNorm(n)))) continue;

    const dm = line.match(DATE_RE);
    if (!dm) continue;

    const [, dayStr, monStr, yearStr, rest] = dm;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monStr, 10);
    const year = parseInt(yearStr, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const am = rest.match(AMOUNT_RE);
    if (!am || am.index === undefined) continue;

    const amountTry = parseTfAmount(am[1]);
    // +23,229.68 ödeme/iadeyi harcama gibi sayma. İstersen burada negative olarak döndürebilirsin.
    if (!isFinite(amountTry) || amountTry <= 0 || am[1].startsWith("+"))
      continue;

    let merchantRaw = rest.substring(0, am.index).trim();
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

// =============================================================================
// OTOMATIK FORMAT ALGILAMA + ANA EXPORT
// =============================================================================

function detectFormat(text: string): "garanti" | "turkiyefinans" {
  if (
    text.includes("TROY GOLD HAPPY") ||
    text.includes("Türkiye Finans") ||
    text.includes("turkiyefinans") ||
    text.includes("HAPPY KART HESAP") ||
    /\d{1,2}\/\d{1,2}\/\d{4}/.test(text)
  )
    return "turkiyefinans";
  return "garanti";
}

export function parseStatement(text: string, filename: string): Transaction[] {
  const format = detectFormat(text);
  if (format === "turkiyefinans")
    return parseTurkiyeFinansStatement(text, filename);
  return parseGarantiStatement(text, filename);
}
