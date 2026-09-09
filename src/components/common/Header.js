import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import BrandMark from './BrandMark';
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
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <BrandMark compact={false} />
        </div>
        <div className="header-right">
          <button onClick={toggleTheme} className="theme-toggle-button" title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          {user && (
            <div className="user-info">
              <span className="user-name-mobile">👤</span>
              <span className="user-name">Welcome, {user.name}</span>
              <button onClick={onEditAccount} className="edit-account-button" title="Account Settings">
                <span className="button-text">Account Settings</span>
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
