import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Header.css';

const Header = ({ onEditAccount, onMenuToggle, sidebarOpen }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <button 
            className="mobile-menu-button"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <h1 className="header-title">
            <span className="header-title-full">Fit Testing Results E-Card</span>
            <span className="header-title-short">Fit Test E-Card</span>
          </h1>
        </div>
        <div className="header-right">
          <button onClick={toggleTheme} className="theme-toggle-button" title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          {user && (
            <div className="user-info">
              <span className="user-name-mobile">👤</span>
              <span className="user-name">Welcome, {user.name}</span>
              <button onClick={onEditAccount} className="edit-account-button" title="Edit Account">
                <span className="button-text">Edit</span>
                <span className="button-icon">⚙️</span>
              </button>
              <button onClick={logout} className="logout-button" title="Logout">
                <span className="button-text">Logout</span>
                <span className="button-icon">🚪</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

