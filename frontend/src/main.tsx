import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import './index.css'
import AdminDashboard from './pages/AdminDashboard.tsx'
import InspectorApp from './pages/InspectorApp.tsx'
import Login from './pages/Login.tsx'

// Hook que bloquea el botón "Atrás" del navegador/celular en rutas protegidas
function usePreventBackNavigation() {
  useEffect(() => {
    // Empuja un estado extra para que el "atrás" no salga de la app
    window.history.pushState({ protected: true }, '');

    const handlePopState = () => {
      // Cada vez que el browser intenta ir atrás, volvemos a empujar el estado
      window.history.pushState({ protected: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}

const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'inspector' }) => {
  const userRole = localStorage.getItem('userRole');
  usePreventBackNavigation();
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
