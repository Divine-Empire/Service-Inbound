import { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import ErrorBoundary from "../components/ErrorBoundary";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-60 h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Pages still own a page-level scroll; the shared table kit (Batch 1+) scrolls inside its card. */}
        <main className="flex-1 overflow-y-auto p-4 md:p-5 min-h-0 bg-slate-50">
          <div className="w-full max-w-[1800px] mx-auto">
            <ErrorBoundary key={pathname}>
              <Suspense
                fallback={
                  <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading page">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
