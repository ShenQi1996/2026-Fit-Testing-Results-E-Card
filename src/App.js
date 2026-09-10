import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import FitTestForm from './components/forms/FitTestForm';
import Login from './components/auth/Login';
import Header from './components/common/Header';
import EditAccount from './components/auth/EditAccount';
import Sidebar from './components/common/Sidebar';
import FitTestResults from './components/results/FitTestResults';
import UsersManagement from './components/admin/UsersManagement';
import ResendCardPage from './components/lookup/ResendCardPage';
import VerifyCardPage from './components/lookup/VerifyCardPage';
import HomePage from './components/common/HomePage';
import LoadingAnimation from './components/common/LoadingAnimation';
import { purgeExpiredFitTests } from './services/firebaseDb';
import { resolveAppRoute } from './utils/appRoute';
import './styles/App.css';

const StaffApp = ({ user, currentPage, onNavigate, sidebarOpen, setSidebarOpen }) => (
  <div className="app">
    <Header
      onEditAccount={() => onNavigate('editAccount')}
      onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      sidebarOpen={sidebarOpen}
    />
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
      />
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <div className="main-content">
        {currentPage === 'editAccount' ? (
          <div className="container">
            <EditAccount onBack={() => onNavigate('form')} />
          </div>
        ) : currentPage === 'results' ? (
          <FitTestResults />
        ) : currentPage === 'users' && user?.role === 'admin' ? (
          <div className="container">
            <UsersManagement />
          </div>
        ) : (
          <div className="container">
            <FitTestForm />
          </div>
        )}
      </div>
    </div>
  </div>
);

const PublicPage = ({ children }) => (
  <div className="app auth-page">{children}</div>
);

const AppContent = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const { setForceLight } = useTheme();
  const [currentPage, setCurrentPage] = useState('form');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const route = resolveAppRoute();
  const isPublicPage = route.kind !== 'staff';

  useEffect(() => {
    setForceLight(!isAuthenticated || isPublicPage);
  }, [isAuthenticated, isPublicPage, setForceLight]);

  const handleNavigate = (page) => {
    if (page === 'users' && user?.role !== 'admin') {
      setCurrentPage('form');
      setSidebarOpen(false);
      return;
    }
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (currentPage === 'users' && user?.role !== 'admin') {
      setCurrentPage('form');
    }
  }, [currentPage, user?.role]);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return undefined;

    purgeExpiredFitTests(user.uid).catch((error) => {
      console.error('Fit test retention cleanup failed:', error);
    });

    return undefined;
  }, [isAuthenticated, user?.uid]);

  if (route.kind === 'verify') {
    return (
      <PublicPage>
        <VerifyCardPage initialToken={route.token} />
      </PublicPage>
    );
  }

  if (route.kind === 'resend') {
    return (
      <PublicPage>
        <ResendCardPage />
      </PublicPage>
    );
  }

  if (route.kind === 'home') {
    return (
      <PublicPage>
        <HomePage />
      </PublicPage>
    );
  }

  if (!isAuthenticated) {
    if (loading) {
      return (
        <PublicPage>
          <div className="loading-container">
            <LoadingAnimation label="Loading…" />
          </div>
        </PublicPage>
      );
    }

    return (
      <PublicPage>
        <Login />
      </PublicPage>
    );
  }

  return (
    <StaffApp
      user={user}
      currentPage={currentPage}
      onNavigate={handleNavigate}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
    />
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
