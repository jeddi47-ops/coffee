import { MetricsSkeleton } from "../../components/Skeletons";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";
import { fr } from "../../i18n/fr";

type Plan = "monthly" | "annual";
type Dashboard = {
  month: string;
  cafes: { total: number; active: number };
  keys: { total: number; activated: number; available: number };
  activations: { monthly: number; annual: number; total: number };
  revenue_usd: number;
};
type GeneratedBatch = { batch_id: string; plan: Plan; quantity: number; codes: string[] };

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};
const money = (amount: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);

export default function PlatformAdminPage() {
  const [month, setMonth] = useState(currentMonth);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [plan, setPlan] = useState<Plan>("monthly");
  const [quantity, setQuantity] = useState("25");
  const [batch, setBatch] = useState<GeneratedBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("platform-dashboard", { body: { month } });
    if (invokeError) {
      setDashboard(null);
      setError(fr.platformAdmin.error);
    } else {
      setDashboard(data as Dashboard);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadDashboard(), 30_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  const csv = useMemo(() => batch?.codes.map((code) => `"${code}"`).join("\r\n") ?? "", [batch]);

  const downloadCsv = () => {
    if (!batch || !csv) return;
    const blob = new Blob(["\uFEFFclé\r\n", csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `cafe-qr-${batch.plan}-${batch.batch_id}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const createBatch = async (event: FormEvent) => {
    event.preventDefault();
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      setError(fr.platformAdmin.generateError);
      return;
    }
    setBusy(true);
    setError(null);
    setBatch(null);
    const { data, error: invokeError } = await supabase.functions.invoke("create-access-keys", {
      body: { plan, quantity: count },
    });
    if (invokeError) {
      setError(fr.platformAdmin.generateError);
    } else {
      setBatch(data as GeneratedBatch);
      await loadDashboard();
    }
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-8 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Café QR</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{fr.platformAdmin.title}</h1>
            <p className="mt-2 text-sm text-muted">{fr.platformAdmin.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold underline">{fr.auth.loginTitle}</Link>
            <Button variant="secondary" onClick={() => void loadDashboard()} disabled={loading}>
              {fr.platformAdmin.refresh}
            </Button>
          </div>
        </header>

        <Card className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <label htmlFor="activation-month" className="mb-1 block text-sm font-medium">{fr.platformAdmin.month}</label>
            <Input id="activation-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <p className="text-sm text-muted">{fr.platformAdmin.grossRevenue}</p>
        </Card>

        {error && (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {error}
            <span className="ml-2 font-normal">
              <Link to="/login" className="underline">{fr.platformAdmin.signIn}</Link>
            </span>
          </p>
        )}

        {loading && !dashboard ? (
          <MetricsSkeleton />
        ) : dashboard ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={fr.platformAdmin.title}>
            <Metric label={fr.platformAdmin.revenue} value={money(dashboard.revenue_usd)} detail={`${dashboard.activations.total} ${fr.platformAdmin.totalKeys.toLowerCase()}`} />
            <Metric label={fr.platformAdmin.monthlyKeys} value={String(dashboard.activations.monthly)} detail={money(dashboard.activations.monthly * 10)} />
            <Metric label={fr.platformAdmin.annualKeys} value={String(dashboard.activations.annual)} detail={money(dashboard.activations.annual * 110)} />
            <Metric label={fr.platformAdmin.cafes} value={String(dashboard.cafes.active)} detail={`${dashboard.cafes.total} au total`} />
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-bold">{fr.platformAdmin.generateTitle}</h2>
              <p className="mt-1 text-sm text-muted">{fr.platformAdmin.keyInventory}: {dashboard?.keys.available ?? "—"}</p>
            </div>
            <form onSubmit={(event) => void createBatch(event)} className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
              <div>
                <label htmlFor="key-plan" className="mb-1 block text-sm font-medium">{fr.platformAdmin.plan}</label>
                <select id="key-plan" value={plan} onChange={(event) => setPlan(event.target.value as Plan)} className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3 text-sm">
                  <option value="monthly">{fr.platformAdmin.monthlyPlan}</option>
                  <option value="annual">{fr.platformAdmin.annualPlan}</option>
                </select>
              </div>
              <div>
                <label htmlFor="key-quantity" className="mb-1 block text-sm font-medium">{fr.platformAdmin.quantity}</label>
                <Input id="key-quantity" type="number" min={1} max={500} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
              <Button type="submit" disabled={busy}>{busy ? fr.platformAdmin.generating : fr.platformAdmin.generate}</Button>
            </form>
          </Card>

          <Card className="space-y-3">
            <div>
              <h2 className="text-lg font-bold">{fr.platformAdmin.availableKeys}</h2>
              <p className="mt-1 text-sm text-muted">{dashboard?.keys.available ?? "—"} disponibles · {dashboard?.keys.activated ?? "—"} activées</p>
            </div>
            <div className="rounded-card bg-surface-2 p-3 text-sm">
              <p className="font-semibold">{fr.platformAdmin.monthlyPlan} / {fr.platformAdmin.annualPlan}</p>
              <p className="mt-1 text-muted">Les clés complètes ne sont montrées qu'au moment de leur création.</p>
            </div>
          </Card>
        </section>

        {batch && (
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{fr.platformAdmin.generatedTitle}</h2>
                <p className="mt-1 text-sm text-muted">{fr.platformAdmin.generatedHint}</p>
              </div>
              <Button onClick={downloadCsv}>{fr.platformAdmin.export}</Button>
            </div>
            <textarea
              readOnly
              aria-label={fr.platformAdmin.generatedTitle}
              value={batch.codes.join("\n")}
              className="min-h-48 w-full rounded-card border border-line bg-surface p-3 font-mono text-sm"
            />
            <p className="text-xs text-muted">{batch.quantity} · {batch.plan === "monthly" ? fr.platformAdmin.monthlyPlan : fr.platformAdmin.annualPlan} · lot {batch.batch_id}</p>
          </Card>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card className="space-y-2">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm text-muted">{detail}</p>
    </Card>
  );
}
