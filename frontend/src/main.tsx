import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import './index.css'
import AdminDashboard from './pages/AdminDashboard.tsx'
import InspectorApp from './pages/InspectorApp.tsx'
import Login from './pages/Login.tsx'

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'inspector' }) => {
  const userRole = localStorage.getItem('userRole');
  if (!userRole) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/*" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/inspector/*" element={<ProtectedRoute role="inspector"><InspectorApp /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
