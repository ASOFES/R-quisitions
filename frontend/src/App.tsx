import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRoute from './components/RoleBasedRoute';
import Layout from './components/Layout';
import theme from './theme';

// Pages
import LoginPage from './pages/Login';
import SimpleDashboard from './pages/SimpleDashboard';
import UsersManagement from './pages/UsersManagement';
import ServicesManagement from './pages/ServicesManagement';
import SitesManagement from './pages/SitesManagement';
import ZonesManagement from './pages/ZonesManagement';
import RequisitionsList from './pages/RequisitionsList';
import RequisitionForm from './pages/RequisitionForm';
import ProfilePage from './pages/ProfilePage';
import EmitterProfile from './pages/EmitterProfile';
import AnalystProfile from './pages/AnalystProfile';
import PMProfileClean from './pages/PMProfileClean';
import GMProfile from './pages/GMProfile';
import RequisitionAnalysis from './pages/RequisitionAnalysis';
import FinancialPage from './pages/FinancialPage';
import PaymentsPage from './pages/PaymentsPage';
import FundsPage from './pages/FundsPage';
import SettingsPage from './pages/SettingsPage';
import CompilationsPage from './pages/CompilationsPage';
import BudgetsPage from './pages/BudgetsPage';
import { useAuth } from './context/AuthContext';

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      
      {/* Protected Routes wrapped in Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<SimpleDashboard />} />
        <Route
          path="/users"
          element={
            <RoleBasedRoute allowedRoles={['admin']}>
              <UsersManagement />
            </RoleBasedRoute>
          }
        />
        <Route path="/services" element={<ServicesManagement />} />
        <Route path="/sites" element={<SitesManagement />} />
        <Route path="/zones" element={<ZonesManagement />} />
        <Route path="/requisitions" element={<RequisitionsList />} />
        <Route path="/requisitions/new" element={<RequisitionForm />} />
        <Route path="/requisition-form" element={<RequisitionForm />} />
        
        <Route
          path="/profile"
          element={
            <ProfilePage />
          }
        />
        <Route
          path="/emitter-profile"
          element={
            <RoleBasedRoute allowedRoles={['emetteur']}>
              <EmitterProfile />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/analyst-profile"
          element={
            <RoleBasedRoute allowedRoles={['analyste', 'admin']}>
              <AnalystProfile />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/pm-profile"
          element={
            <RoleBasedRoute allowedRoles={['validateur']}>
              <PMProfileClean />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/gm-profile"
          element={
            <RoleBasedRoute allowedRoles={['gm', 'admin']}>
              <GMProfile />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/requisitions/:id"
          element={
            <RoleBasedRoute allowedRoles={['analyste', 'admin', 'validateur', 'gm', 'challenger', 'comptable', 'emetteur']}>
              <RequisitionAnalysis />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/financial"
          element={
            <FinancialPage />
          }
        />
        <Route
          path="/payments"
          element={
            <RoleBasedRoute allowedRoles={['comptable', 'admin', 'gm']}>
              <PaymentsPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/compilations"
          element={
            <RoleBasedRoute allowedRoles={['compilateur', 'admin', 'comptable', 'gm', 'analyste']}>
              <CompilationsPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/budgets"
          element={
            <RoleBasedRoute allowedRoles={['admin', 'comptable', 'pm', 'analyste']}>
              <BudgetsPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/funds"
          element={
            <RoleBasedRoute allowedRoles={['comptable', 'admin', 'gm']}>
              <FundsPage />
            </RoleBasedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <RoleBasedRoute allowedRoles={['admin']}>
              <SettingsPage />
            </RoleBasedRoute>
          }
        />
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
