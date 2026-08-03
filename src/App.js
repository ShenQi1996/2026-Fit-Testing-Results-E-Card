import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import FitTestForm from './components/forms/FitTestForm';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import Header from './components/common/Header';
import EditAccount from './components/auth/EditAccount';
import Sidebar from './components/common/Sidebar';
import FitTestResults from './components/results/FitTestResults';
import UsersManagement from './components/admin/UsersManagement';
import './styles/App.css';

const AppContent = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentPage, setCurrentPage] = useState('form'); // 'form', 'results', 'users', or 'editAccount'
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app auth-page">
        {showSignup ? (
          <Signup onSwitchToLogin={() => setShowSignup(false)} />
        ) : (
          <Login onSwitchToSignup={() => setShowSignup(true)} />
        )}
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

