import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import Providers from "./app/providers";
import AppRoutes from "./app/routes";
import UpdateBanner from "./components/UpdateBanner";

function App() {
  return (
    <BrowserRouter>
      <Providers>
        <UpdateBanner />
        {/* Routes outside Layout are lazy too; Layout has its own fallback. */}
        <Suspense fallback={null}>
          <AppRoutes />
        </Suspense>
      </Providers>
    </BrowserRouter>
  );
}

export default App;
