import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './api';
import Login from './pages/Login';
import DonorDashboard from './pages/DonorDashboard';
import DonorHelp from './pages/DonorHelp';
import DonorSettings from './pages/DonorSettings';
import RecipientDashboard from './pages/RecipientDashboard';
import RecipientHelp from './pages/RecipientHelp';
import DriverDashboard from './pages/DriverDashboard';
import DriverDonations from './pages/DriverDonations';
import DriverNewDonation from './pages/DriverNewDonation';
import DriverHelp from './pages/DriverHelp';
import DriverSettings from './pages/DriverSettings';
import ImpactDashboard from './pages/ImpactDashboard';

function HomeRoute() {
  const user = getUser();
  if (!user) return <ImpactDashboard />;
  if (user.role === 'donor') return <Navigate to="/donor" replace />;
  if (user.role === 'recipient') return <Navigate to="/recipient" replace />;
  if (user.role === 'driver') return <Navigate to="/driver" replace />;
  return <Navigate to="/impact" replace />;
}

function ProtectedDonorRoute({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'recipient') return <Navigate to="/recipient" replace />;
  if (user.role === 'driver') return <Navigate to="/driver" replace />;
  if (user.role !== 'donor') return <Navigate to="/login" replace />;
  return children;
}

function ProtectedRecipientRoute({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'donor') return <Navigate to="/donor" replace />;
  if (user.role === 'driver') return <Navigate to="/driver" replace />;
  if (user.role !== 'recipient') return <Navigate to="/login" replace />;
  return children;
}

function ProtectedDriverRoute({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'donor') return <Navigate to="/donor" replace />;
  if (user.role === 'recipient') return <Navigate to="/recipient" replace />;
  if (user.role !== 'driver') return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/impact" element={<ImpactDashboard />} />
        <Route path="/login" element={<Login />} />

        {/* Dynamic Role-Aware Home Route */}
        <Route path="/" element={<HomeRoute />} />

        {/* Protected Donor Portal */}
        <Route
          path="/donor"
          element={
            <ProtectedDonorRoute>
              <DonorDashboard initialTab="dashboard" />
            </ProtectedDonorRoute>
          }
        />
        <Route
          path="/donor/dashboard"
          element={
            <ProtectedDonorRoute>
              <DonorDashboard initialTab="dashboard" />
            </ProtectedDonorRoute>
          }
        />
        <Route
          path="/donor/donations"
          element={
            <ProtectedDonorRoute>
              <DonorDashboard initialTab="donations" />
            </ProtectedDonorRoute>
          }
        />
        <Route
          path="/donor/donations/new"
          element={
            <ProtectedDonorRoute>
              <DonorDashboard initialTab="new_donation" />
            </ProtectedDonorRoute>
          }
        />
        <Route
          path="/donor/help"
          element={
            <ProtectedDonorRoute>
              <DonorHelp />
            </ProtectedDonorRoute>
          }
        />
        <Route
          path="/donor/settings"
          element={
            <ProtectedDonorRoute>
              <DonorSettings />
            </ProtectedDonorRoute>
          }
        />

        {/* Protected Recipient / Shelter Portal */}
        <Route
          path="/recipient"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/dashboard"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/offers"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/settings"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard initialTab="settings" />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/capacity"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard initialTab="settings" />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/help"
          element={
            <ProtectedRecipientRoute>
              <RecipientHelp />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/deliveries"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard />
            </ProtectedRecipientRoute>
          }
        />
        <Route
          path="/recipient/history"
          element={
            <ProtectedRecipientRoute>
              <RecipientDashboard />
            </ProtectedRecipientRoute>
          }
        />

        {/* Protected Driver Portal */}
        <Route
          path="/driver"
          element={
            <ProtectedDriverRoute>
              <DriverDashboard />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/assignment"
          element={
            <ProtectedDriverRoute>
              <DriverDashboard />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/donations"
          element={
            <ProtectedDriverRoute>
              <DriverDonations />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/donations/:id"
          element={
            <ProtectedDriverRoute>
              <DriverDonations />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/donations/new"
          element={
            <ProtectedDriverRoute>
              <DriverNewDonation />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/help"
          element={
            <ProtectedDriverRoute>
              <DriverHelp />
            </ProtectedDriverRoute>
          }
        />
        <Route
          path="/driver/help-support"
          element={<Navigate to="/driver/help" replace />}
        />
        <Route
          path="/driver/settings"
          element={
            <ProtectedDriverRoute>
              <DriverSettings />
            </ProtectedDriverRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
