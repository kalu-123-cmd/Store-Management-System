import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';

const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Products       = lazy(() => import('./pages/Products'));
const Sales          = lazy(() => import('./pages/Sales'));
const Customers      = lazy(() => import('./pages/Customers'));
const Suppliers      = lazy(() => import('./pages/Suppliers'));
const Categories     = lazy(() => import('./pages/Categories'));
const Inventory      = lazy(() => import('./pages/Inventory'));
const Reports        = lazy(() => import('./pages/Reports'));
const Users          = lazy(() => import('./pages/Users'));
const AIDashboard    = lazy(() => import('./pages/AIDashboard'));
const Profile        = lazy(() => import('./pages/Profile'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const BarcodePrint   = lazy(() => import('./pages/BarcodePrint'));
const Branches       = lazy(() => import('./pages/Branches'));
const AuditLog       = lazy(() => import('./pages/AuditLog'));
const Settings       = lazy(() => import('./pages/Settings'));
const NotFound       = lazy(() => import('./pages/NotFound'));
const Organizations  = lazy(() => import('./pages/Organizations'));
const Procurement    = lazy(() => import('./pages/Procurement'));
const CSVImport      = lazy(() => import('./pages/CSVImport'));
const Batches        = lazy(() => import('./pages/Batches'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<Dashboard       />} />
          <Route path="products"        element={<Products        />} />
          <Route path="sales"           element={<Sales           />} />
          <Route path="customers"       element={<Customers       />} />
          <Route path="suppliers"       element={<Suppliers       />} />
          <Route path="categories"      element={<Categories      />} />
          <Route path="inventory"       element={<Inventory       />} />
          <Route path="batches"         element={<Batches         />} />
          <Route path="reports"         element={<Reports         />} />
          <Route path="users"           element={<Users           />} />
          <Route path="ai-dashboard"    element={<AIDashboard      />} />
          <Route path="csv-import"     element={<CSVImport        />} />
          <Route path="profile"         element={<Profile         />} />
          <Route path="purchases"       element={<PurchaseOrders  />} />
          <Route path="barcodes"        element={<BarcodePrint    />} />
          <Route path="branches"        element={<Branches        />} />
          <Route path="audit"           element={<AuditLog        />} />
          <Route path="settings"        element={<Settings        />} />
          <Route path="organizations"  element={<Organizations   />} />
          <Route path="procurement"     element={<Procurement     />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
