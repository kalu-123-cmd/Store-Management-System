import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login            from './pages/Login';
import Layout           from './components/Layout';
import Dashboard        from './pages/Dashboard';
import Products         from './pages/Products';
import Sales            from './pages/Sales';
import Customers        from './pages/Customers';
import Suppliers        from './pages/Suppliers';
import Categories       from './pages/Categories';
import Inventory        from './pages/Inventory';
import Reports          from './pages/Reports';
import Users            from './pages/Users';
import TraditionalItems from './pages/TraditionalItems';
import Profile          from './pages/Profile';
import PurchaseOrders   from './pages/PurchaseOrders';
import BarcodePrint     from './pages/BarcodePrint';
import Branches         from './pages/Branches';
import NotFound         from './pages/NotFound';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"   element={<Dashboard       />} />
        <Route path="products"    element={<Products        />} />
        <Route path="sales"       element={<Sales           />} />
        <Route path="customers"   element={<Customers       />} />
        <Route path="suppliers"   element={<Suppliers       />} />
        <Route path="categories"  element={<Categories      />} />
        <Route path="inventory"   element={<Inventory       />} />
        <Route path="reports"     element={<Reports         />} />
        <Route path="users"       element={<Users           />} />
        <Route path="traditional" element={<TraditionalItems />} />
        <Route path="profile"     element={<Profile         />} />
        <Route path="purchases"   element={<PurchaseOrders  />} />
        <Route path="barcodes"    element={<BarcodePrint    />} />
        <Route path="branches"    element={<Branches        />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
