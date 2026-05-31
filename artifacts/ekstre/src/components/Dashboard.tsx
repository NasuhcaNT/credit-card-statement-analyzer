import { useState, useMemo } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Transaction } from "@/lib/parser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface DashboardProps {
  transactions: Transaction[];
}

const formatTL = (amount: number) => {
  return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type SortDir = "asc" | "desc";
interface SortState<K extends string> { key: K; dir: SortDir }

function useSort<K extends string>(defaultKey: K, defaultDir: SortDir = "desc") {
  const [sort, setSort] = useState<SortState<K>>({ key: defaultKey, dir: defaultDir });
  const toggle = (key: K) =>
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  return [sort, toggle] as const;
}

function applySort<T extends Record<string, unknown>>(data: T[], sort: SortState<string>): T[] {
  return [...data].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    const cmp = av instanceof Date && bv instanceof Date
      ? av.getTime() - bv.getTime()
      : typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av ?? "").localeCompare(String(bv ?? ""), "tr");
    return sort.dir === "asc" ? cmp : -cmp;
  });
}

function SortableHead<K extends string>({ label, sortKey, sort, onSort, className }: {
  label: string; sortKey: K; sort: SortState<K>; onSort: (k: K) => void; className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={`cursor-pointer select-none whitespace-nowrap hover:text-foreground ${className ?? ""}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && sort.dir === "asc"  && <ChevronUp   className="h-3 w-3 text-primary" />}
        {active && sort.dir === "desc" && <ChevronDown  className="h-3 w-3 text-primary" />}
        {!active && <ChevronsUpDown className="h-3 w-3 opacity-25" />}
      </span>
    </TableHead>
  );
}

export default function Dashboard({ transactions }: DashboardProps) {
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [dailySort,    toggleDailySort]    = useSort<"date" | "amount">("amount");
  const [citySort,     toggleCitySort]     = useSort<"name" | "value" | "percent">("value");
  const [catSort,      toggleCatSort]      = useSort<"name" | "amount" | "percent">("amount");
  const [merchantSort, toggleMerchantSort] = useSort<"name" | "count" | "amount">("amount");
  const [rawSort,      toggleRawSort]      = useSort<"date" | "merchant" | "amountTry" | "city" | "category">("date", "desc");
  
  const allMonths = useMemo(() => Array.from(new Set(transactions.map(t => t.month))).sort(), [transactions]);
  const allCities = useMemo(() => Array.from(new Set(transactions.map(t => t.city))).sort(), [transactions]);
  const allCategories = useMemo(() => Array.from(new Set(transactions.map(t => t.category))).sort(), [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (selectedMonths.length > 0 && !selectedMonths.includes(t.month)) return false;
      if (selectedCities.length > 0 && !selectedCities.includes(t.city)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(t.category)) return false;
      return true;
    });
  }, [transactions, selectedMonths, selectedCities, selectedCategories]);

  // KPIs
  const totalSpend = filteredTransactions.reduce((sum, t) => sum + t.amountTry, 0);
  const uniqueDays = new Set(filteredTransactions.map(t => t.date.toISOString())).size;
  const dailyAverage = uniqueDays > 0 ? totalSpend / uniqueDays : 0;
  const uniqueMerchants = new Set(filteredTransactions.map(t => t.merchant)).size;

  // Daily Chart Data
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach(t => {
      const dateStr = format(t.date, "dd MMM", { locale: tr });
      map.set(dateStr, (map.get(dateStr) || 0) + t.amountTry);
    });
    return Array.from(map.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => b.amount - a.amount); // for table
  }, [filteredTransactions]);

  const dailyChartDataClean = useMemo(() => {
    const map = new Map<string, { dateObj: Date; amount: number; isoKey: string }>();
    filteredTransactions.forEach(t => {
      const isoKey = format(t.date, "yyyy-MM-dd");
      if (!map.has(isoKey)) {
        map.set(isoKey, { dateObj: t.date, amount: 0, isoKey });
      }
      map.get(isoKey)!.amount += t.amountTry;
    });
    return Array.from(map.values())
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(item => ({
        date: format(item.dateObj, "dd MMM", { locale: tr }),
        isoKey: item.isoKey,
        amount: item.amount,
      }));
  }, [filteredTransactions]);

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDay) return [];
    return filteredTransactions.filter(t => format(t.date, "yyyy-MM-dd") === selectedDay)
      .sort((a, b) => b.amountTry - a.amountTry);
  }, [selectedDay, filteredTransactions]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return null;
    const [y, m, d] = selectedDay.split("-").map(Number);
    return format(new Date(y, m - 1, d), "d MMMM yyyy", { locale: tr });
  }, [selectedDay]);

  // City Data
  const cityData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach(t => {
      map.set(t.city, (map.get(t.city) || 0) + t.amountTry);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, percent: value / totalSpend * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, totalSpend]);

  // Category Data
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTransactions.forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amountTry);
    });
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, percent: amount / totalSpend * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, totalSpend]);

  // Merchant Data
  const merchantData = useMemo(() => {
    const map = new Map<string, { amount: number, count: number }>();
    filteredTransactions.forEach(t => {
      if (!map.has(t.merchant)) map.set(t.merchant, { amount: 0, count: 0 });
      map.get(t.merchant)!.amount += t.amountTry;
      map.get(t.merchant)!.count += 1;
    });
    return Array.from(map.entries())
      .map(([name, stats]) => ({ name, amount: stats.amount, count: stats.count }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  const selectedMerchantTransactions = useMemo(() => {
    if (!selectedMerchant) return [];
    return filteredTransactions
      .filter(t => t.merchant === selectedMerchant)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [selectedMerchant, filteredTransactions]);

  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredTransactions
      .filter(t => t.category === selectedCategory)
      .sort((a, b) => b.amountTry - a.amountTry);
  }, [selectedCategory, filteredTransactions]);

  const handleDownloadCsv = () => {
    const headers = ["Tarih", "Mağaza", "Tutar (TL)", "Döviz", "Orijinal Tutar", "Şehir", "Kategori", "Dosya"];
    const rows = filteredTransactions.map(t => [
      format(t.date, "yyyy-MM-dd"),
      `"${t.merchant.replace(/"/g, '""')}"`,
      t.amountTry.toString().replace('.', ','),
      t.currency,
      t.originalAmount || "",
      `"${t.city}"`,
      `"${t.category}"`,
      `"${t.sourceFile}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ekstre_analizi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFilter = (list: string[], setList: (l: string[]) => void, val: string) => {
    if (list.includes(val)) setList(list.filter(i => i !== val));
    else setList([...list, val]);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">Kredi Kartı Ekstre Analizi</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Toplam Harcama</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatTL(totalSpend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Günlük Ortalama</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatTL(dailyAverage)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">İşlem Sayısı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{filteredTransactions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Farklı Mağaza</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{uniqueMerchants}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center text-sm">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-foreground">Ay:</span>
            <div className="flex flex-wrap gap-1">
              {allMonths.map(m => (
                <Button key={m} variant={selectedMonths.includes(m) ? "default" : "outline"} size="sm" className="h-7 px-2 text-xs" onClick={() => toggleFilter(selectedMonths, setSelectedMonths, m)}>
                  {m}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="w-px h-6 bg-border mx-2"></div>
          
          <Button variant="ghost" size="sm" onClick={() => { setSelectedMonths([]); setSelectedCities([]); setSelectedCategories([]); }}>
            Filtreleri Sıfırla
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="gunluk" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 mb-6 h-auto">
          <TabsTrigger value="gunluk" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Günlük Analiz</TabsTrigger>
          <TabsTrigger value="sehir" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Şehir Analizi</TabsTrigger>
          <TabsTrigger value="kategori" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Kategori Analizi</TabsTrigger>
          <TabsTrigger value="magaza" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Mağaza Analizi</TabsTrigger>
          <TabsTrigger value="veri" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">Ham Veri</TabsTrigger>
        </TabsList>

        <TabsContent value="gunluk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Günlük Harcama Trendi</CardTitle>
              {!selectedDay && <p className="text-xs text-muted-foreground mt-1">Bir güne tıklayarak o günün harcamalarını görün</p>}
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyChartDataClean}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]) {
                      const isoKey = (data.activePayload[0].payload as { isoKey: string }).isoKey;
                      setSelectedDay(prev => prev === isoKey ? null : isoKey);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v as number).toLocaleString('tr-TR')} ₺`} />
                  <Tooltip formatter={(val: number) => formatTL(val)} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {dailyChartDataClean.map((entry) => (
                      <Cell
                        key={entry.isoKey}
                        fill={selectedDay === entry.isoKey ? "hsl(var(--chart-3))" : "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {selectedDay && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">
                  {selectedDayLabel} — {selectedDayTransactions.length} işlem
                  <span className="ml-3 text-muted-foreground font-normal text-sm">
                    Toplam: {formatTL(selectedDayTransactions.reduce((s, t) => s + t.amountTry, 0))}
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>Kapat</Button>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mağaza</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Şehir</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="text-right">Döviz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDayTransactions.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{t.merchant}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.city}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{formatTL(t.amountTry)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {t.currency !== "TRY" ? `${t.originalAmount} ${t.currency}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>En Yüksek Harcama Günleri</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Tarih"  sortKey="date"   sort={dailySort} onSort={toggleDailySort} />
                    <SortableHead label="Tutar"  sortKey="amount" sort={dailySort} onSort={toggleDailySort} className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applySort(dailyData, dailySort).slice(0, 20).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell className="text-right font-medium">{formatTL(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sehir" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Şehirlere Göre Dağılım</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={cityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {cityData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val: number) => formatTL(val)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Şehir Detayları</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Şehir"  sortKey="name"    sort={citySort} onSort={toggleCitySort} />
                      <SortableHead label="Tutar"  sortKey="value"   sort={citySort} onSort={toggleCitySort} className="text-right" />
                      <SortableHead label="%"      sortKey="percent" sort={citySort} onSort={toggleCitySort} className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applySort(cityData, citySort).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right font-medium">{formatTL(row.value)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.percent.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kategori" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kategorilere Göre Harcamalar</CardTitle>
              {!selectedCategory && <p className="text-xs text-muted-foreground mt-1">Bir kategoriye tıklayarak o kategorinin harcamalarını görün</p>}
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ left: 100 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]) {
                      const name = (data.activePayload[0].payload as { name: string }).name;
                      setSelectedCategory(prev => prev === name ? null : name);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <Tooltip formatter={(val: number) => formatTL(val)} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={selectedCategory === entry.name ? "hsl(var(--chart-3))" : "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {selectedCategory && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">
                  {selectedCategory}
                  <span className="ml-3 text-muted-foreground font-normal text-sm">
                    {selectedCategoryTransactions.length} işlem — Toplam: {formatTL(selectedCategoryTransactions.reduce((s, t) => s + t.amountTry, 0))}
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>Kapat</Button>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Mağaza</TableHead>
                      <TableHead>Şehir</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="text-right">Döviz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCategoryTransactions.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm whitespace-nowrap">{format(t.date, "dd.MM.yyyy")}</TableCell>
                        <TableCell className="font-medium text-sm">{t.merchant}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.city}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{formatTL(t.amountTry)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {t.currency !== "TRY" ? `${t.originalAmount} ${t.currency}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Kategori" sortKey="name"    sort={catSort} onSort={toggleCatSort} />
                    <SortableHead label="Tutar"    sortKey="amount"  sort={catSort} onSort={toggleCatSort} className="text-right" />
                    <SortableHead label="%"        sortKey="percent" sort={catSort} onSort={toggleCatSort} className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applySort(categoryData, catSort).map((row, i) => (
                    <TableRow
                      key={i}
                      className={`cursor-pointer transition-colors ${selectedCategory === row.name ? "bg-primary/10 font-semibold" : "hover:bg-muted/60"}`}
                      onClick={() => setSelectedCategory(prev => prev === row.name ? null : row.name)}
                    >
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right font-medium">{formatTL(row.amount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.percent.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="magaza" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>En Çok Harcama Yapılan Mağazalar (İlk 20)</CardTitle></CardHeader>
            <CardContent className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={merchantData.slice(0, 20)}
                  layout="vertical"
                  margin={{ left: 150 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]) {
                      const name = (data.activePayload[0].payload as { name: string }).name;
                      setSelectedMerchant(prev => prev === name ? null : name);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={150} />
                  <Tooltip formatter={(val: number) => formatTL(val)} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {merchantData.slice(0, 20).map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={selectedMerchant === entry.name ? "hsl(var(--chart-3))" : "hsl(var(--primary))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {selectedMerchant && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">
                  {selectedMerchant}
                  <span className="ml-3 text-muted-foreground font-normal text-sm">
                    {selectedMerchantTransactions.length} işlem — Toplam: {formatTL(selectedMerchantTransactions.reduce((s, t) => s + t.amountTry, 0))}
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMerchant(null)}>Kapat</Button>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Şehir</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="text-right">Döviz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMerchantTransactions.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm whitespace-nowrap">{format(t.date, "dd.MM.yyyy")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.category}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.city}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">{formatTL(t.amountTry)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {t.currency !== "TRY" ? `${t.originalAmount} ${t.currency}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Tüm Mağazalar</CardTitle>
              {!selectedMerchant && <p className="text-xs text-muted-foreground mt-1">Bir mağazaya tıklayarak tüm işlemlerini görün</p>}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Mağaza"       sortKey="name"   sort={merchantSort} onSort={toggleMerchantSort} />
                    <SortableHead label="İşlem Sayısı" sortKey="count"  sort={merchantSort} onSort={toggleMerchantSort} className="text-right" />
                    <SortableHead label="Toplam Tutar" sortKey="amount" sort={merchantSort} onSort={toggleMerchantSort} className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applySort(merchantData, merchantSort).slice(0, 50).map((row, i) => (
                    <TableRow
                      key={i}
                      className={`cursor-pointer transition-colors ${selectedMerchant === row.name ? "bg-primary/10 font-semibold" : "hover:bg-muted/60"}`}
                      onClick={() => setSelectedMerchant(prev => prev === row.name ? null : row.name)}
                    >
                      <TableCell className="font-medium text-sm">{row.name}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell className="text-right">{formatTL(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="veri" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>İşlem Listesi</CardTitle>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{filteredTransactions.length} işlem gösteriliyor</span>
                <Button onClick={handleDownloadCsv} size="sm" variant="outline">CSV İndir</Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <SortableHead label="Tarih"    sortKey="date"      sort={rawSort} onSort={toggleRawSort} />
                      <SortableHead label="Mağaza"   sortKey="merchant"  sort={rawSort} onSort={toggleRawSort} />
                      <SortableHead label="Tutar"    sortKey="amountTry" sort={rawSort} onSort={toggleRawSort} className="text-right" />
                      <TableHead>Döviz</TableHead>
                      <SortableHead label="Şehir"    sortKey="city"      sort={rawSort} onSort={toggleRawSort} />
                      <SortableHead label="Kategori" sortKey="category"  sort={rawSort} onSort={toggleRawSort} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applySort(filteredTransactions as unknown as Record<string, unknown>[], rawSort).map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-xs">{format(t.date, "dd.MM.yyyy")}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate" title={t.merchant}>{t.merchant}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap text-xs">{formatTL(t.amountTry)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {t.currency !== 'TRY' ? `${t.originalAmount} ${t.currency}` : '-'}
                        </TableCell>
                        <TableCell className="text-xs">{t.city}</TableCell>
                        <TableCell className="text-xs">{t.category}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Accordion type="single" collapsible className="w-full mt-12 bg-card border rounded-lg px-4">
        <AccordionItem value="item-1" className="border-none">
          <AccordionTrigger className="text-sm font-medium">Şehir ve kategori tahmini nasıl çalışıyor?</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground pb-4">
            Ekstrelerinizdeki mağaza isimleri taranarak belirli anahtar kelimeler aranır. Örneğin mağaza isminde "MIGROS" veya "BIM" geçiyorsa "Market" kategorisine, "ISTANBUL" geçiyorsa "İstanbul" şehrine atanır. Herhangi bir eşleşme bulunamazsa bankanın ekstresindeki orijinal bölüm başlığı kullanılır.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
