import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { supabase } from "./lib/api";
import "./styles.css";
function InvitationRoute({ manage = false }: { manage?: boolean }) {
  const location = useLocation();
  return <App key={location.pathname + location.hash} manage={manage} />;
}
const NotFound = lazy(() => import("./pages/NotFound"));
const Parties = lazy(() => import("./pages/Parties"));
const Create = lazy(() => import("./pages/Create"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
let previousUser: string | null = null;
supabase?.auth.onAuthStateChange((event, session) => {
  const user = session?.user.id || null;
  if (event === "SIGNED_OUT" || (previousUser && user !== previousUser))
    queryClient.clear();
  previousUser = user;
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<p className="loading">Getting things ready…</p>}>
            <Routes>
              <Route path="/" element={<InvitationRoute />} />
              <Route path="/invite/:token" element={<InvitationRoute />} />
              <Route path="/manage" element={<InvitationRoute manage />} />
              <Route path="/parties" element={<Parties />} />
              <Route path="/create" element={<Create />} />
              <Route path="/host/:partyId" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
if ("serviceWorker" in navigator)
  void navigator.serviceWorker.register("/sw.js").catch(() => {
    /* Installation is optional; a failed registration never blocks the app. */
  });
