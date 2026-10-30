import { fr } from "../i18n/fr";

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">{fr.notFound.title}</h1>
      <p className="mt-2 text-muted">{fr.notFound.text}</p>
    </main>
  );
}
