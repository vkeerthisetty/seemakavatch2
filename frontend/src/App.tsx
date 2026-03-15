import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import OfficerDashboard from './pages/OfficerDashboard';
import TravellerDashboard from './pages/TravellerDashboard';
import NGODashboard from './pages/NGODashboard';
import MEADashboard from './pages/MEADashboard';
import BorderMap from './pages/BorderMap';
import Layout from './components/Layout';

function ProtectedRoute({ children, role }: { children: JSX.Element; role?: string }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  if (user.role === 'officer')   return <OfficerDashboard />;
  if (user.role === 'traveller') return <TravellerDashboard />;
  if (user.role === 'ngo')       return <NGODashboard />;
  if (user.role === 'mea')       return <MEADashboard />;
  return <Navigate to="/" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/map" element={
              <ProtectedRoute role="officer"><BorderMap /></ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
