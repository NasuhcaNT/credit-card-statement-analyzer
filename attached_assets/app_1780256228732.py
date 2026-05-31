
import re
from pathlib import Path
from datetime import datetime
import pandas as pd
import streamlit as st
import plotly.express as px

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


MONTHS_TR = {
    "Ocak": 1, "Şubat": 2, "Subat": 2, "Mart": 3, "Nisan": 4,
    "Mayıs": 5, "Mayis": 5, "Haziran": 6, "Temmuz": 7, "Ağustos": 8,
    "Agustos": 8, "Eylül": 9, "Eylul": 9, "Ekim": 10, "Kasım": 11,
    "Kasim": 11, "Aralık": 12, "Aralik": 12
}

CATEGORY_HEADERS = [
    "Akaryakıt", "Hediyelik Eşya/Cam,Porselen Ürünleri", "Mobilya & Aksesuar",
    "Konaklama", "Cafe & Restaurant", "Süpermarket", "Fast Food", "Pastane",
    "Bilgisayar", "Eczane", "Kozmetik", "Ulaşım", "DİĞER HARCAMALARINIZ",
    "YURT DIŞI HARCAMALARINIZ", "BONUS PROGRAM ORTAKLARI'NDA YAPTIĞINIZ HARCAMALAR",
    "BONUS PROGRAM ORTAKLARI DIŞI HARCAMALARINIZ"
]

NON_EXPENSE_KEYWORDS = [
    "ÖDEMENİZ İÇİN TEŞEKKÜR", "ÖNCEKİ DÖNEMDEN", "DÖNEM FAİZİ",
    "KKDF", "BSMV", "BONUS BEDAVA", "Toplam", "Min. Ödeme",
    "Dönem Borcunuz", "NAKİT AVANS BİLGİLERİ"
]

CITY_KEYWORDS = {
    "İstanbul": ["ISTANBUL", "İSTANBUL", "FATİH", "BEYOĞLU", "ÇAPA", "MERTER", "TOPKAPI", "GALATA", "GALATAPORT", "FINDIKZADE", "YEŞİLKÖY"],
    "Nevşehir": ["NEVŞEHİR", "NEVSEHIR", "GÖREME", "GOREME", "UÇHİSAR", "UCHISAR", "AVANOS", "GÜLŞEHİR", "GULSEHIR"],
    "Tallinn": ["TALLINN", "ULEMISTE", "ÜLEMISTE", "KOTZEBUE", "MUSTAMAE", "VIIMSI", "REVAL", "SELVER", "LIDO", "IKEA TALLINN"],
    "Helsinki": ["HELSINKI", "LONNROTINKATU", "LÖNNROTINKATU", "ALEKSINKULMA", "CITYCENTER", "VIKINGLINE.FI", "VIKING LINE", "STOCKMANN"],
}

CATEGORY_RULES = {
    "Market": ["MIGROS", "BİM", "BIM", "MARKET", "SELVER", "K-MARKET", "A1000", "MERNUR", "GIDA"],
    "Restoran/Kafe": ["CAFE", "KAFE", "RESTAURANT", "RESTORAN", "BURGER", "KFC", "HAPPYMOONS", "ESPRESSOLAB", "KAHVE", "LIDO", "KEBAB", "MIDPOINT", "PEATUS"],
    "Konaklama": ["HOTEL", "BOOKING", "KONAK", "OTEL"],
    "Ulaşım": ["BELBIM", "MARMARAY", "VIKING", "AVIS", "BELEDİYESİ", "BELEDIYESI", "CIRCLE K"],
    "Giyim/Alışveriş": ["KOTON", "MARIMEKKO", "STOCKMANN", "OUTLET", "GRATİS", "GRATIS"],
    "Akaryakıt": ["SHELL", "PETRO", "CIRCLE K"],
    "Müze/Gezi": ["MÜZE", "MUZE", "ÖRENYERİ", "ORENYERI", "KİLİSE", "KILISE"],
    "Sağlık": ["ECZANE", "DİŞ", "DIS", "MURAT Dİ", "MURAT DI"],
    "Dijital/Abonelik": ["APPLE.COM", "MOBIMATTER", "PAY*"],
}


def pdf_to_text(file) -> str:
    if fitz is None:
        st.error("PyMuPDF kurulu değil. Terminalde: pip install pymupdf")
        return ""

    text = ""
    doc = fitz.open(stream=file.read(), filetype="pdf")
    for page in doc:
        text += page.get_text("text") + "\n"
    return text


def parse_tr_amount(raw: str) -> float:
    raw = raw.strip().replace(".", "").replace(",", ".")
    return float(raw)


def parse_date(day: str, month: str, year: str):
    month_no = MONTHS_TR.get(month)
    if not month_no:
        return None
    return datetime(int(year), month_no, int(day)).date()


def infer_city(merchant: str) -> str:
    m = merchant.upper()
    for city, keys in CITY_KEYWORDS.items():
        if any(k.upper() in m for k in keys):
            return city
    return "Bilinmiyor"


def infer_category(merchant: str, current_header: str) -> str:
    m = merchant.upper()

    for category, keys in CATEGORY_RULES.items():
        if any(k.upper() in m for k in keys):
            return category

    if current_header:
        h = current_header.strip()
        if "YURT DIŞI" in h:
            return "Yurt dışı / Diğer"
        if "DİĞER" in h:
            return "Diğer"
        if "BONUS PROGRAM" in h:
            return "Bonus işyeri"
        return h

    return "Bilinmiyor"


def is_noise(line: str) -> bool:
    return any(k.upper() in line.upper() for k in NON_EXPENSE_KEYWORDS)


def extract_transactions(text: str) -> pd.DataFrame:
    rows = []
    current_category = None

    # Örnek satırlar:
    # 23 Mayıs 2026 KOTZEBUE CITYALKO 51,46 EUR 2.814,35
    # 14 Mayıs 2026 SHELL ÇIRPICI 0,02 55,00
    # 23 Mayıs 2026 ZİRAAT FİNAN/TSK MEHMETCI 6.500,00x3=19.500,00 1.Taksit 17,55 6.500,00
    date_re = re.compile(r"^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})\s+(.+)$")
    amount_re = re.compile(r"(-?\d{1,3}(?:\.\d{3})*,\d{2})(\+)?\s*$")
    fx_re = re.compile(r"(\d{1,3}(?:[.,]\d{2})?)\s*(EUR|USD|GBP)", re.IGNORECASE)

    for raw_line in text.splitlines():
        line = " ".join(raw_line.strip().split())
        if not line:
            continue

        if line in CATEGORY_HEADERS:
            current_category = line
            continue

        m_date = date_re.match(line)
        if not m_date:
            continue

        if is_noise(line):
            continue

        day, month, year, rest = m_date.groups()
        date = parse_date(day, month, year)
        if date is None:
            continue

        m_amount = amount_re.search(rest)
        if not m_amount:
            continue

        amount_raw, plus_sign = m_amount.groups()
        amount = parse_tr_amount(amount_raw)

        # + işaretli olanlar genelde ödeme/iade; harcama analizinde negatif sayalım
        if plus_sign:
            amount = -amount

        before_amount = rest[:m_amount.start()].strip()

        # Taksit/bonus gibi ara sayıları temizleme
        before_amount = re.sub(r"\d{1,3}(?:\.\d{3})*,\d{2}x\d+=\d{1,3}(?:\.\d{3})*,\d{2}", "", before_amount)
        before_amount = re.sub(r"\d+\.Taksit", "", before_amount, flags=re.IGNORECASE)
        before_amount = re.sub(r"\s+", " ", before_amount).strip()

        fx = fx_re.search(before_amount)
        original_amount = None
        currency = "TRY"
        if fx:
            original_amount = fx.group(1).replace(",", ".")
            currency = fx.group(2).upper()
            merchant = before_amount[:fx.start()].strip()
        else:
            # Bonus puanı gibi satır sonundaki küçük sayıları mağaza adından ayırmaya çalış
            merchant = re.sub(r"\s+-?\d{1,3}(?:\.\d{3})*,\d{2}\s*$", "", before_amount).strip()

        if not merchant:
            continue

        rows.append({
            "date": date,
            "month": date.strftime("%Y-%m"),
            "merchant": merchant,
            "amount_try": amount,
            "currency": currency,
            "original_amount": original_amount,
            "city": infer_city(merchant),
            "category": infer_category(merchant, current_category),
            "statement_category": current_category or "Bilinmiyor",
            "raw_line": line
        })

    df = pd.DataFrame(rows)

    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
        df["amount_try"] = pd.to_numeric(df["amount_try"], errors="coerce")
        df = df[df["amount_try"].notna()]
        df = df[df["amount_try"] > 0]  # ödeme/iade çıkar
        df = df.sort_values("date")

    return df


def kpi(label, value):
    st.metric(label, value)


st.set_page_config(page_title="Kredi Kartı Ekstre Analizi", layout="wide")
st.title("💳 Kredi Kartı PDF Ekstre Analizi")

st.write("PDF ekstrelerini yükle; günlük, şehir, kategori ve mağaza bazlı harcamalarını analiz et.")

uploaded_files = st.file_uploader(
    "PDF ekstrelerini yükle",
    type=["pdf"],
    accept_multiple_files=True
)

if not uploaded_files:
    st.info("Başlamak için bir veya birden fazla PDF ekstre yükle.")
    st.stop()

all_data = []

for file in uploaded_files:
    text = pdf_to_text(file)
    df = extract_transactions(text)
    if not df.empty:
        df["source_file"] = file.name
        all_data.append(df)

if not all_data:
    st.error("PDF içinden işlem satırı çıkarılamadı. PDF formatı farklı olabilir.")
    st.stop()

df = pd.concat(all_data, ignore_index=True)

st.sidebar.header("Filtreler")

months = sorted(df["month"].dropna().unique())
cities = sorted(df["city"].dropna().unique())
categories = sorted(df["category"].dropna().unique())

selected_months = st.sidebar.multiselect("Ay", months, default=months)
selected_cities = st.sidebar.multiselect("Şehir", cities, default=cities)
selected_categories = st.sidebar.multiselect("Kategori", categories, default=categories)

min_date = df["date"].min().date()
max_date = df["date"].max().date()
date_range = st.sidebar.date_input("Tarih aralığı", value=(min_date, max_date))

filtered = df.copy()

if selected_months:
    filtered = filtered[filtered["month"].isin(selected_months)]

if selected_cities:
    filtered = filtered[filtered["city"].isin(selected_cities)]

if selected_categories:
    filtered = filtered[filtered["category"].isin(selected_categories)]

if isinstance(date_range, tuple) and len(date_range) == 2:
    start, end = date_range
    filtered = filtered[(filtered["date"].dt.date >= start) & (filtered["date"].dt.date <= end)]

total_spend = filtered["amount_try"].sum()
daily_avg = filtered.groupby(filtered["date"].dt.date)["amount_try"].sum().mean()
transaction_count = len(filtered)
merchant_count = filtered["merchant"].nunique()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Toplam Harcama", f"{total_spend:,.2f} TL")
c2.metric("Günlük Ortalama", f"{daily_avg:,.2f} TL" if pd.notna(daily_avg) else "0 TL")
c3.metric("İşlem Sayısı", f"{transaction_count}")
c4.metric("Farklı Mağaza", f"{merchant_count}")

st.divider()

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📅 Günlük Analiz",
    "🏙️ Şehir Analizi",
    "🧾 Kategori Analizi",
    "🏪 Mağaza Analizi",
    "📋 Ham Veri"
])

with tab1:
    daily = filtered.groupby(filtered["date"].dt.date, as_index=False)["amount_try"].sum()
    daily.columns = ["date", "amount_try"]

    st.subheader("Günlük toplam harcama")
    fig = px.bar(daily, x="date", y="amount_try", text_auto=".2s")
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("En pahalı günler")
    st.dataframe(daily.sort_values("amount_try", ascending=False), use_container_width=True)

with tab2:
    city = filtered.groupby("city", as_index=False)["amount_try"].sum().sort_values("amount_try", ascending=False)

    st.subheader("Şehir bazlı harcama")
    fig = px.pie(city, names="city", values="amount_try")
    st.plotly_chart(fig, use_container_width=True)
    st.dataframe(city, use_container_width=True)

with tab3:
    cat = filtered.groupby("category", as_index=False)["amount_try"].sum().sort_values("amount_try", ascending=False)

    st.subheader("Kategori bazlı harcama")
    fig = px.bar(cat, x="category", y="amount_try", text_auto=".2s")
    st.plotly_chart(fig, use_container_width=True)
    st.dataframe(cat, use_container_width=True)

with tab4:
    merchant = (
        filtered.groupby("merchant", as_index=False)
        .agg(total_spend=("amount_try", "sum"), transaction_count=("amount_try", "count"))
        .sort_values("total_spend", ascending=False)
    )

    st.subheader("En çok para harcanan mağazalar")
    st.dataframe(merchant.head(50), use_container_width=True)

    top_merchants = merchant.head(20)
    fig = px.bar(top_merchants, x="merchant", y="total_spend", text_auto=".2s")
    st.plotly_chart(fig, use_container_width=True)

with tab5:
    st.subheader("Çıkarılan işlem verisi")
    st.dataframe(filtered, use_container_width=True)

    csv = filtered.to_csv(index=False).encode("utf-8-sig")
    st.download_button(
        "CSV indir",
        csv,
        file_name="ekstre_harcama_analizi.csv",
        mime="text/csv"
    )

st.divider()

with st.expander("Şehir/kategori tahmini nasıl çalışıyor?"):
    st.write("""
Bu ilk sürüm işletme adındaki anahtar kelimelerden şehir ve kategori tahmini yapar.
Örneğin HELSINKI → Helsinki, TALLINN → Tallinn, GÖREME → Nevşehir gibi.
İstersen `CITY_KEYWORDS` ve `CATEGORY_RULES` alanlarını kendi harcama alışkanlığına göre genişletebilirsin.
""")
