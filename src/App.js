import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import EmailForm from './components/forms/EmailForm';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import Header from './components/common/Header';
import EditAccount from './components/auth/EditAccount';
import Sidebar from './components/common/Sidebar';
import TestResults from './components/results/TestResults';
import './styles/App.css';

const AppContent = () => {
  const { isAuthenticated, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentPage, setCurrentPage] = useState('form'); // 'form', 'results', or 'editAccount'

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
      <Header onEditAccount={() => setCurrentPage('editAccount')} />
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <div className="main-content">
          {currentPage === 'editAccount' ? (
            <div className="container">
              <EditAccount onBack={() => setCurrentPage('form')} />
            </div>
          ) : currentPage === 'results' ? (
            <TestResults />
          ) : (
            <div className="container">
              <EmailForm />
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

