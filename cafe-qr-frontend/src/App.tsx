import { Suspense } from "react";
import { useRoutes } from "react-router-dom";
import { routes } from "./routes";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { FullPageLoader } from "./components/Skeletons";

export default function App() {
  const element = useRoutes(routes);
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullPageLoader />}>{element}</Suspense>
    </ErrorBoundary>
  );
}
