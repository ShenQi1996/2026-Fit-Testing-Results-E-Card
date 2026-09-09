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
import { getVerifyTokenFromPath } from './utils/verificationToken';
import './styles/App.css';

const STAFF_LOGIN_PATH = '/staff_login';
const RESEND_PATH = '/resend';

const getPublicPath = () => {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.replace(/\/+$/, '') || '/';
};

const AppContent = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const { setForceLight } = useTheme();
  const [currentPage, setCurrentPage] = useState('form'); // 'form', 'results', 'users', or 'editAccount'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const publicPath = getPublicPath();
  const isStaffLoginPage = publicPath === STAFF_LOGIN_PATH;
  const isResendPage = publicPath === RESEND_PATH;
  const verifyToken = getVerifyTokenFromPath(publicPath);
  const isVerifyPage = verifyToken !== null;
  const isPublicPage = isVerifyPage || isResendPage || !isStaffLoginPage;

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

  if (isVerifyPage) {
    return (
      <div className="app auth-page">
        <VerifyCardPage initialToken={verifyToken} />
      </div>
    );
  }

  if (isResendPage) {
    return (
      <div className="app auth-page">
        <ResendCardPage />
      </div>
    );
  }

  if (!isStaffLoginPage) {
    return (
      <div className="app auth-page">
        <HomePage />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (loading) {
      return (
        <div className="app auth-page">
          <div className="loading-container">
            <LoadingAnimation label="Loading…" />
          </div>
        </div>
      );
    }

    return (
      <div className="app auth-page">
        <Login />
      </div>
    );
  }

  return (
    <div className="app">
      <Header 
        onEditAccount={() => setCurrentPage('editAccount')} 
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />
      <div className="app-layout">
        <Sidebar 
          currentPage={currentPage} 
          onNavigate={handleNavigate}
          isOpen={sidebarOpen}
        />
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
        <div className="main-content">
          {currentPage === 'editAccount' ? (
            <div className="container">
              <EditAccount onBack={() => setCurrentPage('form')} />
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

