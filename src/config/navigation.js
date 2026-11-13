import {
  BarChart3,
  ClipboardList,
  Ticket,
  PackageCheck,
  FileText,
  Phone,
  Receipt,
  UserCheck,
  Gauge,
  Truck,
  XCircle,
  Database,
  UserCog,
} from "lucide-react";

// Single source for the menu, the header title, the Settings page-access list
// and the post-login landing page.
// `name` is the page-access key stored in each user's page list — never rename it;
// change `label` to change what the user sees. Order = menu order (pipeline order).
export const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Ticket-and-Enquiry", label: "Tickets", href: "/tickets", icon: Ticket },
  { name: "Machine Received", href: "/machine-received", icon: PackageCheck },
  { name: "Quotation", href: "/quotation", icon: FileText },
  { name: "Follow-Up", href: "/followup", icon: Phone },
  { name: "CRM Verification", href: "/crm-verification", icon: UserCheck },
  { name: "Invoice", href: "/invoice", icon: Receipt },
  { name: "Spare Dispatch Details", label: "Machine Handover", href: "/machine-handover", icon: Truck },
  { name: "Calibration", href: "/calibration", icon: Gauge },
  { name: "Report", href: "/report", icon: ClipboardList },
  { name: "Cancel", label: "Cancelled Tickets", href: "/cancel", icon: XCircle },
  {
    name: "Master",
    href: "/master",
    icon: Database,
    adminOnly: true,
    children: [
      { label: "Dropdown", href: "/master/dropdown" },
      { label: "Company Details", href: "/master/company" },
      { label: "Item Master", href: "/master/items" },
      { label: "Engineer List", href: "/master/engineers" },
      { label: "TAT Master", href: "/master/tat" },
    ],
  },
  { name: "Settings", href: "/settings", icon: UserCog, adminOnly: true },
];

// Visible to every signed-in user regardless of their page list.
export const ALWAYS_VISIBLE = [];

export const navLabel = (item) => item.label || item.name;

// Older page lists stored this page under previous names.
const LEGACY_PAGE_NAMES = { "Client Details": "Ticket-and-Enquiry", "Ticket & Enquiry": "Ticket-and-Enquiry" };

export function allowedPageNames(user) {
  if (!Array.isArray(user?.page)) return [];
  return user.page.map((p) => p.trim()).map((p) => LEGACY_PAGE_NAMES[p] || p);
}

// Menu items this user may open (admin = everything).
export function visibleNavigation(user) {
  if (user?.role === "admin") return navigation;
  const allowed = allowedPageNames(user);
  return navigation.filter(
    (item) => !item.adminOnly && (allowed.includes(item.name) || ALWAYS_VISIBLE.includes(item.name))
  );
}

// Where to send a user right after login: the first page they were given,
// falling back to the always-visible pages only if they have nothing else.
export function landingPath(user) {
  if (user?.role === "admin") return "/";
  const items = visibleNavigation(user);
  const assigned = items.find((item) => !ALWAYS_VISIBLE.includes(item.name));
  return (assigned || items[0])?.href || "/";
}

// Menu item for the header title; a sub-page reads "Master · Dropdown".
export function navItemForPath(pathname) {
  for (const item of navigation) {
    if (item.href === pathname) return item;
    const child = item.children?.find((c) => c.href === pathname);
    if (child) return { ...child, label: navLabel(item) + " · " + child.label };
  }
  return undefined;
}
