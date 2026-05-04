import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import AdminDashboard from './pages/AdminDashboard.tsx'
import InspectorApp from './pages/InspectorApp.tsx'
import Login from './pages/Login.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
        <Route path="/inspector/*" element={<InspectorApp />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
