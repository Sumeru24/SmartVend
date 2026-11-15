import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./layouts/AdminLayout";
import { AnalyticsPage } from "./pages/admin/AnalyticsPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { InventoryPage } from "./pages/admin/InventoryPage";
import { LoginPage } from "./pages/admin/LoginPage";
import { MachinesPage } from "./pages/admin/MachinesPage";
import { ProductsPage } from "./pages/admin/ProductsPage";
import { TransactionDetailPage } from "./pages/admin/TransactionDetailPage";
import { TransactionsPage } from "./pages/admin/TransactionsPage";
import { VendingPage } from "./pages/customer/VendingPage";
import { NotFoundPage } from "./pages/public/NotFoundPage";
import { SimulatorPage } from "./pages/public/SimulatorPage";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<VendingPage />} />
        <Route path="/vending" element={<VendingPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/admin/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute roles={["admin", "operator"]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="transactions/:reference" element={<TransactionDetailPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="machines" element={<MachinesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
