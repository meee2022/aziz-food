import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../convex/_generated/api";
import { useAuth } from "./lib/auth";
import { setCurrency } from "./lib/format";
import ErrorBoundary from "./components/ErrorBoundary";
import { Spinner } from "./components/ui";
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
import Orders from "./pages/Orders";
import CustomerPortal from "./pages/CustomerPortal";

/** بوابة الجلسة: تتحقق من صلاحية الـ token وتعيد التوجيه للدخول عند الحاجة. */
function Protected({ children }: { children: JSX.Element }) {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const me = useQuery(api.auth.me, user && token ? { token } : "skip");
  useEffect(() => {
    if (user && token && me === null) logout();
  }, [me, user, token]);
  if (!user || !token) return <Navigate to="/login" state={{ from: location }} replace />;
  if (me === undefined) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;
  if (me === null) return <Navigate to="/login" replace />;
  return children;
}

const S = (el: JSX.Element) => <Protected><Layout>{el}</Layout></Protected>;

function CurrencyLoader() {
  const settings = useQuery(api.settings.all, {});
  useEffect(() => {
    if (settings?.currency) setCurrency(settings.currency);
  }, [settings]);
  return null;
}

export default function App() {
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";

  return (
    <>
      <ErrorBoundary fallback={null}><CurrencyLoader /></ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        {isCustomer ? (
          // ── بوابة العميل ──
          <Route path="/*" element={<Protected><CustomerPortal /></Protected>} />
        ) : (
          <>
            <Route path="/" element={S(<Dashboard />)} />
            <Route path="/invoice/new" element={S(<InvoiceCreate />)} />
            <Route path="/invoice/:id" element={S(<InvoiceView />)} />
            <Route path="/invoice/:id/edit" element={S(<InvoiceCreate />)} />
            <Route path="/invoices" element={S(<Invoices />)} />
            <Route path="/orders" element={S(<Orders />)} />
            <Route path="/customers" element={S(<Customers />)} />
            <Route path="/customers/:id" element={S(<CustomerDetail />)} />
            <Route path="/items" element={S(<Items />)} />
            <Route path="/prices" element={S(<DailyPrices />)} />
            <Route path="/price-lists" element={S(<PriceLists />)} />
            <Route path="/purchases" element={S(<Purchases />)} />
            <Route path="/reports" element={S(<Reports />)} />
            <Route path="/settings" element={S(<Settings />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </>
  );
}
