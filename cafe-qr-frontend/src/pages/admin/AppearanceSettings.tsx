// Bloc « Apparence » (owner uniquement) : couleur d'accent, mode, phrase d'accroche, aperçu en direct.
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { buildTheme, DEFAULT_ACCENT, isValidHex, SUGGESTED_ACCENTS, type ThemeMode } from "../../lib/theme";
import { errorMessage } from "../../lib/errors";
import { fr } from "../../i18n/fr";
import type { CafeRow, CategoryRow, ProductRow } from "../../types/api";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field } from "../../components/ui/label";
import { Card } from "../../components/ui/card";
import { MenuView } from "../../components/MenuView";
import { ThemeScope } from "../../components/ThemeScope";
import { assertWritten, buildPreviewMenu, loadCatalog } from "./adminData";
import { cn } from "../../lib/utils";

const TAGLINE_MAX = 100;

export function AppearanceSettings({ cafe }: { cafe: CafeRow }) {
  const profile = useAuthStore((s) => s.profile);
  const refreshCafe = useAuthStore((s) => s.refreshCafe);
  const [accentInput, setAccentInput] = useState(cafe.theme_accent ?? DEFAULT_ACCENT);
  const [mode, setMode] = useState<ThemeMode>(cafe.theme_mode === "dark" ? "dark" : "light");
  const [tagline, setTagline] = useState(cafe.tagline ?? "");
  const [catalog, setCatalog] = useState<{ categories: CategoryRow[]; products: ProductRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void loadCatalog().then(setCatalog).catch(() => setCatalog({ categories: [], products: [] }));
  }, []);

  const valid = isValidHex(accentInput);
  const theme = useMemo(() => buildTheme(valid ? accentInput : cafe.theme_accent, mode), [accentInput, valid, mode, cafe.theme_accent]);
  const adjusted = valid && theme.accent.toLowerCase() !== accentInput.toLowerCase();
  const menu = useMemo(
    () =>
      catalog
        ? buildPreviewMenu(cafe, catalog.categories, catalog.products, {
            accent: theme.accent,
            mode,
            tagline: tagline.trim() || null,
          })
        : null,
    [catalog, cafe, theme.accent, mode, tagline],
  );

  // Réservé au owner (un manager ne voit jamais ce bloc).
  if (profile?.kind !== "staff" || profile.staff.role !== "owner") return null;

  const save = async () => {
    if (!valid) {
      setError(fr.admin.accentInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { data, error: updError } = await supabase
        .from("cafes")
        .update({ theme_accent: accentInput.toUpperCase(), theme_mode: mode, tagline: tagline.trim() || null })
        .eq("id", cafe.id)
        .select();
      assertWritten(data, updError);
      await refreshCafe();
      setInfo(fr.admin.appearanceSaved);
    } catch (e) {
      setError(errorMessage(e) === fr.errors.codes.check_violation ? fr.admin.themeRefused : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold">{fr.admin.appearance}</h2>
      <p className="mt-1 text-sm text-muted">{fr.admin.appearanceIntro}</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">{fr.admin.accent}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTED_ACCENTS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setAccentInput(hex)}
                  aria-label={hex}
                  aria-pressed={accentInput.toLowerCase() === hex.toLowerCase()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line"
                  style={{ background: hex }}
                >
                  {accentInput.toLowerCase() === hex.toLowerCase() && (
                    <Check className="h-5 w-5" style={{ color: buildTheme(hex, "light").accentForeground }} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={fr.admin.accentHex} htmlFor="accent-hex" error={!valid ? fr.admin.accentInvalid : null} hint={adjusted ? fr.admin.accentAdjusted : undefined}>
            <Input id="accent-hex" value={accentInput} maxLength={7} onChange={(e) => setAccentInput(e.target.value.trim())} className="font-mono uppercase" />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">{fr.admin.mode}</legend>
            <div className="mt-2 flex gap-2">
              {(["light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={cn("min-h-[44px] flex-1 rounded-card border-2 px-4 text-sm font-semibold", mode === m ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface")}
                >
                  {fr.admin.modes[m]}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={`${fr.admin.tagline} (${fr.common.optional})`} htmlFor="tagline" counter={fr.common.chars(tagline.length, TAGLINE_MAX)}>
            <Input id="tagline" maxLength={TAGLINE_MAX} placeholder={fr.admin.taglinePlaceholder} value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, TAGLINE_MAX))} />
          </Field>

          {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
          {info && <p role="status" className="text-sm font-semibold">{info}</p>}
          <Button onClick={() => void save()} disabled={busy || !valid}>{busy ? fr.common.saving : fr.common.save}</Button>
        </div>

        <div aria-label={fr.admin.previewTitle} className="overflow-hidden rounded-[28px] border-4 border-ink">
          <div className="h-[560px] overflow-y-auto">
            {menu && (
              <ThemeScope theme={theme} className="min-h-full pb-6">
                <MenuView menu={menu} />
              </ThemeScope>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
