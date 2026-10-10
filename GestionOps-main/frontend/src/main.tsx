import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import './index.css'
import AdminDashboard from './pages/AdminDashboard.tsx'
import InspectorApp from './pages/InspectorApp.tsx'
import Login from './pages/Login.tsx'
import { getSessionRole } from './services/api'

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

// La sesión real es el JWT de Supabase (su rol lo aplica RLS en el servidor); aquí solo se decide la pantalla.
const ProtectedRoute = ({ children, role }: { children: React.ReactNode, role: 'admin' | 'inspector' }) => {
  const [state, setState] = useState<'loading' | 'ok' | 'no'>('loading');
  usePreventBackNavigation();
  useEffect(() => {
    let alive = true;
    getSessionRole().then(r => { if (alive) setState(r === role ? 'ok' : 'no'); });
    return () => { alive = false; };
  }, [role]);
  if (state === 'loading') return null;
  if (state === 'no') return <Navigate to="/login" replace />;
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
