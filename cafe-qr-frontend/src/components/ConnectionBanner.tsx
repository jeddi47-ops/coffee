import { WifiOff } from "lucide-react";
import { fr } from "../i18n/fr";

export function ConnectionBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-sm font-semibold text-warn">
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      {fr.staff.connectionLost}
    </div>
  );
}
