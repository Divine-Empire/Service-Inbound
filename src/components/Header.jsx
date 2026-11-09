import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { navItemForPath, navLabel } from "../config/navigation";

const ROLE_LABELS = { admin: "Administrator", engineer: "Engineer" };

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user);
  const current = navItemForPath(pathname);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
      <div className="flex justify-between items-center h-14 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-label="Open menu"
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
          <p className="text-lg sm:text-xl font-bold text-slate-800 truncate" data-testid="page-title">
            {current ? navLabel(current) : "Service Support"}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-700">{user?.name || "Guest"}</p>
            <p className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">{ROLE_LABELS[user?.role] || "User"}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm" aria-hidden="true">
            <span className="text-xs font-bold text-white">{(user?.name || "U")[0].toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
