import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, X } from "lucide-react";
import useAuthStore from "../store/authStore";
import { navLabel, visibleNavigation } from "../config/navigation";

const ROLE_LABELS = { admin: "Administrator", engineer: "Engineer" };

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 group ${isActive
    ? "bg-indigo-50 text-indigo-700 font-semibold"
    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-medium"}`;

// A menu entry with sub-pages (Master): collapsible, open while one of them is the current page.
function NavGroup({ item, onClose }) {
  const { pathname } = useLocation();
  const inGroup = pathname === item.href || pathname.startsWith(item.href + "/");
  const [open, setOpen] = useState(inGroup);
  const expanded = open || inGroup;
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setOpen(!expanded)}
        data-testid={`nav-group-${item.name.toLowerCase()}`}
        className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 group ${inGroup ? "text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-medium"}`}
      >
        <item.icon size={17} className={inGroup ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"} aria-hidden="true" />
        <span className="text-sm truncate">{navLabel(item)}</span>
        <ChevronDown size={15} className={`ml-auto text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded && (
        <div className="mt-0.5 ml-5 space-y-0.5 border-l border-slate-200 pl-2">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              to={child.href}
              end
              onClick={onClose}
              data-testid={`nav-${child.href.slice(1).replace("/", "-")}`}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-medium"}`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const items = visibleNavigation(user);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 lg:w-60 bg-white border-r border-slate-200 z-50 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <Link to="/" onClick={onClose} className="flex min-w-0 items-center gap-3">
            <img src="/divine-logo.svg" alt="Divine" className="h-8 w-auto shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-base font-bold text-slate-800 tracking-tight" data-testid="app-title">Service Inbound</p>
              <p className="text-xs text-slate-500">Divine Empire</p>
            </div>
          </Link>
          <button type="button" aria-label="Close menu" onClick={onClose} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">
          {items.map((item) => item.children ? <NavGroup key={item.href} item={item} onClose={onClose} /> : (
            <NavLink
              key={item.href}
              to={item.href}
              end
              onClick={onClose}
              data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
              className={linkClass}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"} aria-hidden="true" />
                  <span className="text-sm truncate">{navLabel(item)}</span>
                  {item.comingSoon && (
                    <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Soon</span>
                  )}
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-600">{(user?.name || "U")[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">{user?.name || "Guest"}</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">{ROLE_LABELS[user?.role] || "User"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-600 hover:text-white transition-colors font-semibold text-xs"
          >
            <LogOut size={14} aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
