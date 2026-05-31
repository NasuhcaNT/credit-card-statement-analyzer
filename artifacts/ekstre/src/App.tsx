import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Transaction } from "@/lib/parser";
import Upload from "@/components/Upload";
import Dashboard from "@/components/Dashboard";

const queryClient = new QueryClient();

function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      {transactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Upload onTransactionsParsed={setTransactions} />
        </div>
      ) : (
        <Dashboard transactions={transactions} />
      )}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
