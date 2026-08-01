import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { VerifyEmail } from './pages/VerifyEmail';
import { Profile } from './pages/Profile';
import { Cabinet } from './pages/Cabinet';
import { MedicineForm } from './pages/MedicineForm';
import { MedicineExplorer } from './pages/MedicineExplorer';
import { MedicineDetails } from './pages/MedicineDetails';
import { Reminders } from './pages/Reminders';
import { Dashboard } from './pages/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/useAuthStore';
import { NotificationManager } from './components/NotificationManager';
import { BottomNav } from './components/BottomNav';
import { MobileHeader } from './components/MobileHeader';

function App() {
  const [darkMode, setDarkMode] = useState(true); // default dark for premium feel
  const { isAuthenticated, fetchProfiles } = useAuthStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
    }
  }, [isAuthenticated, fetchProfiles]);

  return (
    <Router>
      {/* App Background */}
      <div className="app-desktop-bg">
        {/* App Shell */}
        <div className="phone-shell desktop-container">
          <NotificationManager />

          {/* Mobile Header */}
          <MobileHeader darkMode={darkMode} setDarkMode={setDarkMode} />

          {/* Page Content — scrollable */}
          <main className="phone-content">
            {/* Ambient background blobs */}
            <div className="ambient-blob ambient-blob-1" />
            <div className="ambient-blob ambient-blob-2" />

            <div className="page-inner">
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/explorer" element={<MedicineExplorer />} />
                <Route path="/medicine/:id" element={<MedicineDetails />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />

                {/* Protected Routes */}
                <Route path="/profile" element={
                  <ProtectedRoute><Profile /></ProtectedRoute>
                } />
                <Route path="/cabinet" element={
                  <ProtectedRoute><Cabinet /></ProtectedRoute>
                } />
                <Route path="/reminders" element={
                  <ProtectedRoute><Reminders /></ProtectedRoute>
                } />
                <Route path="/cabinet/new" element={
                  <ProtectedRoute><MedicineForm /></ProtectedRoute>
                } />
                <Route path="/cabinet/edit/:id" element={
                  <ProtectedRoute><MedicineForm /></ProtectedRoute>
                } />

                {/* Home */}
                <Route path="/" element={
                  isAuthenticated ? (
                    <Dashboard />
                  ) : (
                    <WelcomePage />
                  )
                } />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
              </Routes>
            </div>
          </main>

          {/* Bottom Navigation — only when authenticated */}
          {isAuthenticated && <BottomNav />}
        </div>
      </div>
    </Router>
  );
}

// Welcome / landing page for unauthenticated users
function WelcomePage() {
  return (
    <div className="welcome-page">
      {/* Hero Icon */}
      <div className="welcome-hero">
        <div className="welcome-icon-ring">
          <div className="welcome-icon-inner">
            <Activity size={40} strokeWidth={2} className="text-white" />
          </div>
        </div>
        <div className="welcome-pulse-ring" />
        <div className="welcome-pulse-ring welcome-pulse-ring-2" />
      </div>

      {/* Text */}
      <div className="welcome-text">
        <h1 className="welcome-title">MediMate AI</h1>
        <p className="welcome-subtitle">
          Your personal health operating system.{'\n'}Never miss a dose again.
        </p>
      </div>

      {/* Features */}
      <div className="welcome-features">
        {[
          { emoji: '💊', text: 'Track all your medicines' },
          { emoji: '⏰', text: 'Smart dose reminders' },
          { emoji: '📊', text: 'Adherence insights' },
          { emoji: '👨‍👩‍👧', text: 'Family profile support' },
        ].map((f) => (
          <div key={f.text} className="welcome-feature-item">
            <span className="welcome-feature-emoji">{f.emoji}</span>
            <span className="welcome-feature-text">{f.text}</span>
          </div>
        ))}
      </div>

      {/* CTA Buttons */}
      <div className="welcome-cta">
        <Link to="/register" className="btn-primary-full">
          Get Started Free
        </Link>
        <Link to="/login" className="btn-ghost-full">
          Sign In
        </Link>
      </div>

      <p className="welcome-footer">
        Free forever · No credit card required
      </p>
    </div>
  );
}

export default App;
