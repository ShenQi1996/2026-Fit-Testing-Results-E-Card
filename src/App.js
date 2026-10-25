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
import StagingBanner from './components/common/StagingBanner';
import { resolveAppRoute } from './utils/appRoute';
import { isAccessWindowOpen, isAdminOrAbove, isFaculty } from './utils/roles';
import './styles/App.css';

const StaffApp = ({ user, currentPage, onNavigate, sidebarOpen, setSidebarOpen }) => {
  const faculty = isFaculty(user);
  const page = faculty && currentPage !== 'results' && currentPage !== 'editAccount'
    ? 'results'
    : currentPage;
  return (
  <div className="app">
    <Header
      onEditAccount={() => onNavigate('editAccount')}
      onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      sidebarOpen={sidebarOpen}
    />
    <div className="app-layout">
      <Sidebar
        currentPage={page}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
      />
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
      <div className="main-content">
        {user?.role === 'admin' && !isAccessWindowOpen(user) && (
          <div className="container">
            <p role="status">Your admin access has expired or has not started.</p>
          </div>
        )}
        {page === 'editAccount' ? (
          <div className="container">
            <EditAccount
              onBack={() => onNavigate(faculty ? 'results' : 'form')}
              onManageSchools={() => onNavigate('users')}
            />
          </div>
        ) : page === 'results' ? (
          <FitTestResults />
        ) : page === 'users' && isAdminOrAbove(user) ? (
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
    if (isFaculty(user) && page !== 'results' && page !== 'editAccount') {
      setCurrentPage('results');
      setSidebarOpen(false);
      return;
    }
    if (page === 'users' && !isAdminOrAbove(user)) {
      setCurrentPage('form');
      setSidebarOpen(false);
      return;
    }
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (isFaculty(user) && currentPage !== 'results' && currentPage !== 'editAccount') {
      setCurrentPage('results');
      return;
    }
    if (currentPage === 'users' && !isAdminOrAbove(user)) {
      setCurrentPage('form');
    }
  }, [currentPage, user]);

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
        <StagingBanner />
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
