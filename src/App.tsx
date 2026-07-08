import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../convex/_generated/api";
import { useAuth } from "./lib/auth";
import { setCurrency } from "./lib/format";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import DailyPrices from "./pages/DailyPrices";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import InvoiceCreate from "./pages/InvoiceCreate";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import PriceLists from "./pages/PriceLists";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function Protected({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Layout>{children}</Layout>;
}

/** يحمّل العملة من الإعدادات — معزول حتى لا تُعطّل شاشة الدخول قبل نشر Convex. */
function CurrencyLoader() {
  const settings = useQuery(api.settings.all, {});
  useEffect(() => {
    if (settings?.currency) setCurrency(settings.currency);
  }, [settings]);
  return null;
}

export default function App() {
  return (
    <>
    <ErrorBoundary fallback={null}><CurrencyLoader /></ErrorBoundary>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/invoice/new" element={<Protected><InvoiceCreate /></Protected>} />
      <Route path="/invoice/:id" element={<Protected><InvoiceView /></Protected>} />
      <Route path="/invoice/:id/edit" element={<Protected><InvoiceCreate /></Protected>} />
      <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
      <Route path="/customers" element={<Protected><Customers /></Protected>} />
      <Route path="/customers/:id" element={<Protected><CustomerDetail /></Protected>} />
      <Route path="/items" element={<Protected><Items /></Protected>} />
      <Route path="/prices" element={<Protected><DailyPrices /></Protected>} />
      <Route path="/price-lists" element={<Protected><PriceLists /></Protected>} />
      <Route path="/purchases" element={<Protected><Purchases /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
