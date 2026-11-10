// Bandeau d'aide pour activer les alertes (écran éteint / app en arrière-plan).
import { BellRing } from "lucide-react";
import { fr } from "../../i18n/fr";
import { Button } from "../../components/ui/button";
import type { PushState } from "../../lib/webpush";

interface Props {
  state: PushState;
  onEnable: () => void;
}

export function PushBanner({ state, onEnable }: Props) {
  if (state === "granted" || state === "not-configured") return null;

  const text =
    state === "needs-install"
      ? fr.staff.push.needsInstall
      : state === "denied"
        ? fr.staff.push.denied
        : state === "unsupported"
          ? fr.staff.push.unsupported
          : fr.staff.push.text;

  return (
    <div role="status" className="mx-3 mt-3 flex items-center gap-3 rounded-card bg-surface-2 px-4 py-3 text-sm text-ink">
      <BellRing className="h-5 w-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 font-semibold">{text}</p>
      {state === "default" && (
        <Button size="sm" onClick={onEnable}>
          {fr.staff.push.enable}
        </Button>
      )}
    </div>
  );
}
