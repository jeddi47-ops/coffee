// Garde l'écran allumé pendant le service (Wake Lock API) quand le navigateur le permet.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
}
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

let sentinel: WakeLockSentinelLike | null = null;
let wanted = false;

export const wakeLockSupported = (): boolean => Boolean((navigator as WakeLockNavigator).wakeLock);

async function acquire(): Promise<boolean> {
  const nav = navigator as WakeLockNavigator;
  if (!nav.wakeLock || document.visibilityState !== "visible") return false;
  try {
    sentinel = await nav.wakeLock.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
    return true;
  } catch {
    return false;
  }
}

function onVisibility() {
  if (wanted && !sentinel && document.visibilityState === "visible") void acquire();
}

export async function enableWakeLock(): Promise<boolean> {
  wanted = true;
  document.addEventListener("visibilitychange", onVisibility);
  return acquire();
}

export async function disableWakeLock(): Promise<void> {
  wanted = false;
  document.removeEventListener("visibilitychange", onVisibility);
  await sentinel?.release().catch(() => undefined);
  sentinel = null;
}
