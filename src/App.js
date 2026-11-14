import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
// Page styles stay in main.css, in the order the pages used to be imported,
// so App.css still comes last and the cascade is unchanged. Only page code is
// split into chunks.
import './components/common/CardPreview.css';
import './components/forms/FitTestForm.css';
import Login from './components/auth/Login';
import Header from './components/common/Header';
import './components/auth/EditAccount.css';
import Sidebar from './components/common/Sidebar';
import './components/results/FitTestResults.css';
import './components/admin/UsersManagement.css';
import './components/lookup/VerifyCardPage.css';
import HomePage from './components/common/HomePage';
import LoadingAnimation from './components/common/LoadingAnimation';
import PageLoading from './components/common/PageLoading';
import ChunkErrorBoundary from './components/common/ChunkErrorBoundary';
import StagingBanner from './components/common/StagingBanner';
import { resolveAppRoute } from './utils/appRoute';
import { isAccessWindowOpen, isAdminOrAbove, isFaculty } from './utils/roles';
import './styles/App.css';

// Each page is its own chunk, downloaded the first time it is shown. Login,
// home, the header and the sidebar stay in the main bundle.
const FitTestForm = lazy(() => import(/* webpackChunkName: "page-form" */ './components/forms/FitTestForm'));
const FitTestResults = lazy(() => import(/* webpackChunkName: "page-results" */ './components/results/FitTestResults'));
const UsersManagement = lazy(() => import(/* webpackChunkName: "page-users" */ './components/admin/UsersManagement'));
const EditAccount = lazy(() => import(/* webpackChunkName: "page-account" */ './components/auth/EditAccount'));
const VerifyCardPage = lazy(() => import(/* webpackChunkName: "page-verify" */ './components/lookup/VerifyCardPage'));
const ResendCardPage = lazy(() => import(/* webpackChunkName: "page-resend" */ './components/lookup/ResendCardPage'));

const LazyPage = ({ children, pageKey }) => (
  <ChunkErrorBoundary key={pageKey}>
    <Suspense fallback={<PageLoading />}>
      {children}
    </Suspense>
  </ChunkErrorBoundary>
);

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
        {(user?.role === 'admin' || user?.role === 'faculty') && !isAccessWindowOpen(user) && (
          <div className="container">
            <p role="status">
              {user.role === 'faculty'
                ? 'Your faculty access has expired or has not started.'
                : 'Your admin access has expired or has not started.'}
            </p>
          </div>
        )}
        <LazyPage pageKey={page}>
          {page === 'editAccount' ? (
            <div className="container">
              <EditAccount
                onBack={() => onNavigate(faculty ? 'results' : 'form')}
                onManageSchools={() => onNavigate('users')}
              />
            </div>
          ) : page === 'results' && faculty && !isAccessWindowOpen(user) ? null : page === 'results' ? (
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
        </LazyPage>
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
        <LazyPage pageKey="verify">
          <VerifyCardPage initialToken={route.token} />
        </LazyPage>
      </PublicPage>
    );
  }

  if (route.kind === 'resend') {
    return (
      <PublicPage>
        <LazyPage pageKey="resend">
          <ResendCardPage />
        </LazyPage>
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
