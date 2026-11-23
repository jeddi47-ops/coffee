// /admin/tables : tables, QR codes SVG, plaquettes à imprimer, régénération du jeton.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Download, Info, Plus, Printer, QrCode, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { publicAssetUrl, tableUrl } from "../../lib/env";
import { staffRpc } from "../../lib/api";
import { ApiError, errorMessage, fromPostgrest } from "../../lib/errors";
import { downloadSvg, qrSvg, safeFileName, svgDataUrl } from "../../lib/qr";
import { fr } from "../../i18n/fr";
import type { CafeTableRow } from "../../types/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge, Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ListSkeleton } from "../../components/Skeletons";
import { initials } from "../../components/CafeHeader";
import { assertWritten, useStaffProfile } from "./adminData";

type Confirm = { title: string; message: string; label: string; danger?: boolean; run: () => Promise<void> } | null;

export default function TablesAdminPage() {
  const { cafe } = useStaffProfile();
  const [tables, setTables] = useState<CafeTableRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("cafe_tables")
      .select("id, cafe_id, label, qr_token, is_active, created_at")
      .order("created_at");
    if (loadError) setError(errorMessage(fromPostgrest(loadError)));
    else setTables((data ?? []) as CafeTableRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const svgs = useMemo(
    () => Object.fromEntries((tables ?? []).map((t) => [t.id, qrSvg(tableUrl(t.qr_token), fr.menu.tableLabel(t.label))])),
    [tables],
  );

  const act = async (fn: () => Promise<void>, dependencyMessage?: string) => {
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError && e.code === "has_dependencies" && dependencyMessage ? dependencyMessage : errorMessage(e));
    } finally {
      await load();
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const value = label.trim();
    if (!value) return;
    void act(async () => {
      const { data, error: insError } = await supabase.from("cafe_tables").insert({ cafe_id: cafe.id, label: value }).select();
      assertWritten(data, insError);
      setLabel("");
    });
  };

  const logo = publicAssetUrl(cafe.logo_path);
  const printable = (tables ?? []).filter((t) => t.is_active);

  if (!tables) return error ? <p role="alert" className="text-danger">{error}</p> : <ListSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{fr.admin.tablesTitle}</h1><p className="mt-2 text-base text-muted">Gérez vos tables, leurs QR codes et les plaquettes à imprimer.</p></div>
        <Button variant="secondary" className="rounded-full bg-white px-5 shadow-sm" onClick={() => window.print()} disabled={printable.length === 0}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          {fr.admin.print}
        </Button>
      </header>
      <p className="flex items-center gap-3 rounded-2xl border border-[#d7b46b]/40 bg-[#d7b46b]/10 px-4 py-4 text-sm text-ink"><Info className="h-5 w-5 shrink-0 text-[#a87824]" aria-hidden="true" />Chaque QR code ouvre le menu associé à sa table. Si tu en régénères un, réimprime sa plaquette.</p>
      {error && <p role="alert" className="rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}
      {info && <p role="status" className="rounded-card bg-surface-2 px-4 py-3 text-sm font-semibold">{info}</p>}

      <Card className="rounded-3xl border-black/[0.06] p-5 shadow-[0_12px_35px_rgba(27,24,19,0.06)] sm:p-6">
        <div className="mb-4 flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5f2ed]"><QrCode className="h-6 w-6" aria-hidden="true" /></span><div><h2 className="text-xl font-bold">Ajouter une table</h2><p className="mt-1 text-sm text-muted">Créez une table puis téléchargez ou imprimez son QR code.</p></div></div>
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="new-table" className="sr-only">{fr.admin.tableLabel}</label>
          <Input id="new-table" className="min-h-12 rounded-2xl border-[#dedbd5] bg-white" placeholder={fr.admin.tableLabel} maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button type="submit" className="min-h-12 shrink-0 rounded-2xl bg-gradient-to-r from-[#dfb75e] to-[#b9842d] px-6 text-[#21180b] shadow-sm hover:opacity-90" disabled={!label.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {fr.admin.newTable}
          </Button>
        </form>
      </Card>

      {tables.length === 0 && <Card className="rounded-3xl border-dashed p-8 text-center text-muted">{fr.admin.noTables}</Card>}

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {tables.map((t) => (
          <li key={t.id}>
            <Card className="flex h-full flex-col rounded-3xl border-black/[0.06] p-5 shadow-[0_12px_35px_rgba(27,24,19,0.06)]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5f2ed]"><QrCode className="h-5 w-5" aria-hidden="true" /></span><p className="truncate text-lg font-bold">{fr.menu.tableLabel(t.label)}</p></div>
                <Badge className={t.is_active ? "bg-[#e7f3eb] text-[#1f6b3e]" : "bg-surface-2 text-muted"}>{t.is_active ? fr.admin.active : fr.admin.inactive}</Badge>
              </div>
              <img
                src={svgDataUrl(svgs[t.id])}
                alt={fr.admin.qrAlt(t.label)}
                className={`mx-auto mt-4 w-44 rounded-2xl border border-line bg-white p-2 ${t.is_active ? "" : "opacity-40"}`}
              />
              <div className="mt-3">
                <Switch
                  tone="gold"
                  checked={t.is_active}
                  label={t.is_active ? fr.admin.active : fr.admin.inactive}
                  onChange={(v) =>
                    void act(async () => {
                      const { data, error: updError } = await supabase.from("cafe_tables").update({ is_active: v }).eq("id", t.id).select();
                      assertWritten(data, updError);
                    })
                  }
                />
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <Button variant="secondary" size="sm" className="rounded-xl bg-white" onClick={() => downloadSvg(svgs[t.id], `qr-table-${safeFileName(t.label)}.svg`)}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {fr.admin.downloadSvg}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl bg-white"
                  onClick={() =>
                    setConfirm({
                      title: fr.admin.regenerate,
                      message: fr.admin.regenerateConfirm(t.label),
                      label: fr.admin.regenerate,
                      danger: true,
                      run: () =>
                        act(async () => {
                          await staffRpc.regenerateTableToken(t.id);
                          setInfo(fr.admin.regenerated);
                        }),
                    })
                  }
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  {fr.admin.regenerate}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`${fr.common.delete} ${fr.menu.tableLabel(t.label)}`}
                  onClick={() =>
                    setConfirm({
                      title: fr.common.delete,
                      message: fr.admin.deleteTableConfirm(t.label),
                      label: fr.common.delete,
                      danger: true,
                      run: () =>
                        act(async () => {
                          const { data, error: delError } = await supabase.from("cafe_tables").delete().eq("id", t.id).select();
                          assertWritten(data, delError);
                        }, fr.admin.tableHasHistory),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {/* Plaquettes de table : rendues hors de l'application, visibles uniquement à l'impression (A4, 6 par page). */}
      {createPortal(
      <div className="print-portal" aria-hidden="true">
        <div className="grid grid-cols-2 gap-[8mm]">
          {printable.map((t) => (
            <div key={t.id} className="plate flex h-[86mm] flex-col items-center justify-center rounded-[4mm] border-2 border-ink p-[4mm] text-center">
              <div className="flex items-center gap-[3mm]">
                {logo ? (
                  <img src={logo} alt="" className="h-[10mm] w-[10mm] rounded-full object-cover" />
                ) : (
                  <span className="flex h-[10mm] w-[10mm] items-center justify-center rounded-full border-2 border-ink text-[10pt] font-bold">{initials(cafe.name)}</span>
                )}
                <span className="text-[14pt] font-bold">{cafe.name}</span>
              </div>
              <img src={svgDataUrl(svgs[t.id])} alt="" className="mt-[2mm] h-[58mm] w-auto" />
              <p className="text-[9pt]">{fr.admin.printScan}</p>
            </div>
          ))}
        </div>
      </div>,
      document.body,
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.label}
        danger={confirm?.danger}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
    </div>
  );
}

