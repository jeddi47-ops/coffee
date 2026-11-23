import { BellRing, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { fr } from "../../i18n/fr";

export function CallWaiterView({
  tableLabel,
  busy,
  waiting,
  cooldown,
  onCall,
}: {
  tableLabel: string;
  busy: boolean;
  waiting: boolean;
  cooldown: number;
  onCall: () => void;
}) {
  const title = waiting
    ? fr.table.callActiveTitle
    : busy
      ? fr.table.callSendingTitle
      : fr.table.callScreenTitle;
  const description = waiting
    ? fr.table.callActiveDescription
    : busy
      ? fr.table.callSendingDescription
      : fr.table.callScreenDescription;

  return (
    <section className="mx-auto flex min-h-[calc(100svh_-_190px)] w-full max-w-xl flex-col items-center justify-center px-5 py-8 text-center" aria-labelledby="call-waiter-title">
      <div className="waiter-call-orbit mb-9" data-waiting={waiting} aria-hidden="true">
        <span className="waiter-call-wave waiter-call-wave-one" />
        <span className="waiter-call-wave waiter-call-wave-two" />
        <span className="waiter-call-icon">
          {busy ? <Loader2 className="h-12 w-12 animate-spin motion-reduce:animate-none" /> : waiting ? <Check className="h-12 w-12" /> : <BellRing className="h-12 w-12" />}
        </span>
      </div>

      <p className="rounded-full bg-accent-soft px-4 py-1.5 text-sm font-semibold text-ink">{tableLabel}</p>
      <h1 id="call-waiter-title" className="mt-5 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mt-3 max-w-sm text-base leading-relaxed text-muted" aria-live="polite">{description}</p>

      {waiting && <p role="status" className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-surface px-4 py-2 text-sm font-semibold text-ink"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />{fr.table.callActiveStatus}</p>}

      {!waiting && (
        <Button
          size="lg"
          className="mt-8 min-w-56 rounded-full px-7 shadow-lg"
          onClick={onCall}
          disabled={busy || cooldown > 0}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : cooldown > 0 ? <Clock className="h-5 w-5" aria-hidden="true" /> : <BellRing className="h-5 w-5" aria-hidden="true" />}
          {busy ? fr.table.callSendingButton : cooldown > 0 ? fr.table.callCooldown(cooldown) : fr.table.callAction}
        </Button>
      )}

      <p className="mt-6 max-w-xs text-xs leading-relaxed text-muted">{waiting ? fr.table.callActiveHint : fr.table.callScreenHint}</p>
    </section>
  );
}

