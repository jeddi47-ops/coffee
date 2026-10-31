// /admin/reglages (owner uniquement) : service, identité du café, réglages avancés, apparence.
import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { publicAssetUrl } from "../../lib/env";
import { errorMessage } from "../../lib/errors";
import { ACCEPTED_IMAGE_TYPES } from "../../lib/image";
import { fr } from "../../i18n/fr";
import type { CafeRow } from "../../types/api";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { initials } from "../../components/CafeHeader";
import { AppearanceSettings } from "./AppearanceSettings";
import { assertWritten, imageErrorMessage, removeImage, uploadImage, useStaffProfile } from "./adminData";

type Editable = Pick<CafeRow, "name" | "currency" | "order_rate_limit" | "waiter_call_cooldown_seconds" | "session_stale_hours">;

const RANGES = {
  order_rate_limit: [1, 100],
  waiter_call_cooldown_seconds: [0, 3600],
  session_stale_hours: [1, 48],
} as const;

export default function SettingsPage() {
  const { cafe } = useStaffProfile();
  const refreshCafe = useAuthStore((s) => s.refreshCafe);
  const [form, setForm] = useState<Editable>(cafe);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void refreshCafe().catch(() => undefined);
  }, [refreshCafe]);
  useEffect(() => {
    setForm(cafe);
  }, [cafe]);

  const update = async (values: Partial<CafeRow>, successMessage = fr.common.saved) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { data, error: updError } = await supabase.from("cafes").update(values).eq("id", cafe.id).select();
      assertWritten(data, updError);
      await refreshCafe();
      setInfo(successMessage);
    } catch (e) {
      setError(errorMessage(e) === fr.errors.codes.check_violation ? fr.admin.refused : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rangeError = (key: keyof typeof RANGES) => {
    const [min, max] = RANGES[key];
    const v = form[key];
    return Number.isInteger(v) && v >= min && v <= max ? null : fr.admin.outOfRange(min, max);
  };
  const currencyValid = /^[A-Z]{3}$/.test(form.currency);
  const formValid =
    form.name.trim().length > 0 && currencyValid && !rangeError("order_rate_limit") && !rangeError("waiter_call_cooldown_seconds") && !rangeError("session_stale_hours");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) return;
    void update({
      name: form.name.trim(),
      currency: form.currency,
      order_rate_limit: form.order_rate_limit,
      waiter_call_cooldown_seconds: form.waiter_call_cooldown_seconds,
      session_stale_hours: form.session_stale_hours,
    });
  };

  const uploadLogo = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadImage(cafe.id, "logo", file);
      const old = cafe.logo_path;
      await update({ logo_path: path });
      if (old && old !== path) void removeImage(old);
    } catch (e) {
      setError(imageErrorMessage(e));
      setBusy(false);
    }
  };

  const num = (key: keyof typeof RANGES) => (
    <Input
      id={key}
      type="number"
      inputMode="numeric"
      min={RANGES[key][0]}
      max={RANGES[key][1]}
      value={Number.isFinite(form[key]) ? String(form[key]) : ""}
      onChange={(e) => setForm({ ...form, [key]: e.target.value === "" ? NaN : Number(e.target.value) })}
    />
  );
  const logo = publicAssetUrl(cafe.logo_path);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{fr.admin.settingsTitle}</h1>
      {error && <p role="alert" className="rounded-card bg-danger px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}
      {info && <p role="status" className="rounded-card bg-surface-2 px-4 py-3 text-sm font-semibold">{info}</p>}

      <Card className="space-y-2">
        <div className={cafe.ordering_enabled ? "" : "rounded-card bg-warn-soft p-3"}>
          <Switch
            checked={!cafe.ordering_enabled}
            disabled={busy}
            onChange={(paused) => void update({ ordering_enabled: !paused })}
            label={fr.admin.pauseOrders}
            description={fr.admin.pauseOrdersHint}
          />
        </div>
        <Switch
          checked={cafe.call_waiter_enabled}
          disabled={busy}
          onChange={(v) => void update({ call_waiter_enabled: v })}
          label={fr.admin.callButton}
          description={fr.admin.callButtonHint}
        />
      </Card>

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label={fr.admin.cafeName} htmlFor="cafe-name">
            <Input id="cafe-name" maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium">{fr.admin.logo}</p>
            <div className="flex items-center gap-4">
              {logo ? (
                <img src={logo} alt="" className="h-16 w-16 rounded-full border border-line object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-lg font-bold">{initials(cafe.name)}</span>
              )}
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-card border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {fr.admin.photoChoose}
                <input type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
              </label>
            </div>
            <p className="text-xs text-muted">{fr.admin.photoHint}</p>
          </div>

          <Field label={fr.admin.currency} htmlFor="currency" error={currencyValid ? null : fr.admin.currencyInvalid}>
            <Input id="currency" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className="w-28 uppercase" />
          </Field>

          <details className="rounded-card border border-line p-4">
            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">{fr.admin.advanced}</summary>
            <div className="mt-3 space-y-4">
              <Field label={fr.admin.rateLimit} htmlFor="order_rate_limit" hint={fr.admin.rateLimitHint} error={rangeError("order_rate_limit")}>
                {num("order_rate_limit")}
              </Field>
              <Field label={fr.admin.cooldown} htmlFor="waiter_call_cooldown_seconds" hint={fr.admin.cooldownHint} error={rangeError("waiter_call_cooldown_seconds")}>
                {num("waiter_call_cooldown_seconds")}
              </Field>
              <Field label={fr.admin.stale} htmlFor="session_stale_hours" hint={fr.admin.staleHint} error={rangeError("session_stale_hours")}>
                {num("session_stale_hours")}
              </Field>
            </div>
          </details>

          <Button type="submit" disabled={busy || !formValid}>{busy ? fr.common.saving : fr.common.save}</Button>
        </form>
      </Card>

      <AppearanceSettings cafe={cafe} />
    </div>
  );
}
