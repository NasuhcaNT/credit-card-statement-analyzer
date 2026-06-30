# Credit Card Statement Analyzer (Asset Manager)

Kredi kartı ekstrelerini PDF olarak yükleyip harcamalarınızı otomatik olarak analiz eden, tamamen tarayıcı tarafında (client-side) çalışan interaktif bir web uygulaması.

🔗 **Canlı demo:** [asset-manager--nasuhcanturker.replit.app](https://asset-manager--nasuhcanturker.replit.app/)

## Özellikler

- 📄 **PDF Ekstre Yükleme** — Garanti BBVA Bonus ve Türkiye Finans Happy Kart ekstrelerini doğrudan PDF olarak yükleyip ayrıştırma
- 📊 **İnteraktif Dashboard** — Harcamaları kategori, tarih ve tutar bazında görselleştiren grafikler (Recharts)
- 🗺️ **Şehir Bazlı Analiz** — Harcamaların hangi şehirlerde yapıldığını gösteren detaylı kırılım
- 🔒 **%100 Client-Side** — Ekstre verileri hiçbir sunucuya gönderilmez, tüm işleme tarayıcıda (pdf.js ile) yapılır
- 🎨 **Modern Arayüz** — shadcn/ui ve Radix UI bileşenleri ile responsive, erişilebilir tasarım

## Kullanılan Teknolojiler

- **React 18** + **TypeScript**
- **Vite** — geliştirme ve build aracı
- **Tailwind CSS** + **shadcn/ui** — stil ve bileşen kütüphanesi
- **pdfjs-dist** — PDF parse işlemleri
- **Recharts** — veri görselleştirme
- **TanStack Query**, **React Hook Form**, **Zod**

## Kurulum

```bash
# Bağımlılıkları yükle
pnpm install

# Geliştirme sunucusunu başlat
pnpm dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde açılır.

## Build

```bash
pnpm build
```

## Nasıl Çalışır?

1. Banka ekstresi PDF dosyasını uygulamaya sürükleyip bırakın veya seçin.
2. `pdf.js` ile metin içerik istemci tarafında çıkarılır.
3. Banka formatına özel parser (Garanti Bonus / Türkiye Finans Happy Kart) işlem satırlarını ayrıştırır.
4. Dashboard'da kategori bazlı toplamlar, harcama trendleri ve şehir bazlı detaylar interaktif grafiklerle sunulur.

## Lisans

MIT
