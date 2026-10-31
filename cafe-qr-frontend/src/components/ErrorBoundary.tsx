import { Component, type ErrorInfo, type ReactNode } from "react";
import { fr } from "../i18n/fr";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Volontairement aucun journal : l'URL peut contenir le jeton de table.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto mt-24 max-w-md p-6 text-center">
        <p className="text-lg text-ink">{fr.errors.boundaryTitle}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 min-h-[44px] rounded-card bg-accent px-5 font-semibold text-accent-fg"
        >
          {fr.errors.boundaryAction}
        </button>
      </main>
    );
  }
}
