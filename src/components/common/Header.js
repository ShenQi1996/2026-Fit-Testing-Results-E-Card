import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Header.css';

const Header = ({ onEditAccount }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">Fit Testing Results E-Card</h1>
        </div>
        <div className="header-right">
          <button onClick={toggleTheme} className="theme-toggle-button" title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          {user && (
            <div className="user-info">
              <span className="user-name">Welcome, {user.name}</span>
              <button onClick={onEditAccount} className="edit-account-button">
                Edit Account
              </button>
              <button onClick={logout} className="logout-button">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

