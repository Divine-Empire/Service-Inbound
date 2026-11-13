import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout";
import ProtectedRoute from "../components/ProtectedRoute";
import Login from "../pages/Login/Login";

// Each page is its own chunk, loaded on first visit (Layout wraps <Outlet /> in Suspense).
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const Tickets = lazy(() => import("../pages/Tickets/Tickets"));
const MachineReceived = lazy(() => import("../pages/MachineReceived/MachineReceived"));
const Quotation = lazy(() => import("../pages/Quotation/Quotation"));
const FollowUp = lazy(() => import("../pages/FollowUp/FollowUp"));
const CrmVerification = lazy(() => import("../pages/CrmVerification/CrmVerification"));
const Invoice = lazy(() => import("../pages/Invoice/Invoice"));
const Calibration = lazy(() => import("../pages/Calibration/Calibration"));
const MachineHandover = lazy(() => import("../pages/MachineHandover/MachineHandover"));
const CancelledTickets = lazy(() => import("../pages/Cancelled_Tickets/Cancelled_Tickets"));
const Report = lazy(() => import("../pages/Report/Report"));
const Settings = lazy(() => import("../pages/Master/Settings"));
const MasterDropdown = lazy(() => import("../pages/Master/DropdownMaster"));
const MasterCompany = lazy(() => import("../pages/Master/CompanyDetails"));
const MasterSections = lazy(() => import("../pages/Master/MasterSections"));
const TatConfig = lazy(() => import("../pages/Master/tat-config"));

const admin = (element) => <ProtectedRoute requiredRole="admin">{element}</ProtectedRoute>;

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="machine-received" element={<MachineReceived />} />
        <Route path="quotation" element={<Quotation />} />
        <Route path="followup" element={<FollowUp />} />
        <Route path="crm-verification" element={<CrmVerification />} />
        <Route path="invoice" element={<Invoice />} />
        <Route path="calibration" element={<Calibration />} />
        <Route path="machine-handover" element={<MachineHandover />} />
        <Route path="cancel" element={<CancelledTickets />} />
        <Route path="report" element={<Report />} />
        <Route path="master" element={<Navigate to="/master/dropdown" replace />} />
        <Route path="master/dropdown" element={admin(<MasterDropdown />)} />
        <Route path="master/company" element={admin(<MasterCompany />)} />
        <Route path="master/items" element={admin(<MasterSections section="items" />)} />
        <Route path="master/engineers" element={admin(<MasterSections section="engineers" />)} />
        <Route path="master/tat" element={admin(<TatConfig />)} />
        <Route path="tat-config" element={<Navigate to="/master/tat" replace />} />
        <Route path="settings" element={admin(<Settings />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
