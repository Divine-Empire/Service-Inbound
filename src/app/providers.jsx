import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// One client for the app: list pages fetch one server page per request, so a
// short stale window is enough to make tab/page switches feel instant without
// showing old data after a submit (writers call invalidateQueries).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

export default function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* The only toast host; hooks/use-toast.js forwards the older toast({...}) calls here. */}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      {children}
    </QueryClientProvider>
  );
}
