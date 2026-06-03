import { useState, useCallback } from "react";
import { UploadCloud, FileText, Loader2, AlertCircle } from "lucide-react";
import { extractTextFromPdf } from "@/lib/pdf";
import { parseStatement, Transaction } from "@/lib/parser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UploadProps {
  onTransactionsParsed: (transactions: Transaction[]) => void;
}

export default function Upload({ onTransactionsParsed }: UploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFiles = async (files: FileList | File[]) => {
    setLoading(true);
    setError(null);
    let allTransactions: Transaction[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== "application/pdf") continue;
        
        const text = await extractTextFromPdf(file);
        const transactions = parseStatement(text, file.name);
        allTransactions = allTransactions.concat(transactions);
      }

      if (allTransactions.length === 0) {
        setError("PDF'lerden işlem verisi bulunamadı. Desteklenen bir Garanti Bonus veya Türkiye Finans Happy Kart ekstresi olduğundan emin olun.");
      } else {
        onTransactionsParsed(allTransactions);
      }
    } catch (err: any) {
      console.error(err);
      setError("Dosya okunurken bir hata oluştu: " + (err.message || "Bilinmeyen hata"));
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 flex flex-col items-center">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Kredi Kartı Ekstre Analizi</h1>
        <p className="text-muted-foreground text-lg">Garanti Bonus veya Türkiye Finans Happy Kart PDF ekstrelerinizi yükleyin</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6 w-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Hata</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        className={`w-full p-12 border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer
          ${dragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'}`}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        onClick={() => document.getElementById("pdf-upload")?.click()}
      >
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />
        
        {loading ? (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-lg font-medium text-foreground">PDF işleniyor...</p>
          </div>
        ) : (
          <>
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="h-10 w-10 text-primary" />
            </div>
            <p className="text-xl font-semibold mb-2">PDF dosyalarını sürükleyin veya seçin</p>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Birden fazla ekstre seçebilirsiniz
            </p>
            
            <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
              <FileText className="h-3 w-3" />
              <span>Verileriniz tarayıcınızda işlenir, hiçbir yere gönderilmez.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
