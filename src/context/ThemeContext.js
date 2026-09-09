import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });
  const [forceLight, setForceLight] = useState(true);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const applyDark = isDarkMode && !forceLight;
    document.documentElement.classList.toggle('dark-mode', applyDark);
    document.documentElement.style.colorScheme = applyDark ? 'dark' : 'light';
  }, [isDarkMode, forceLight]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const value = {
    isDarkMode,
    toggleTheme,
    setForceLight,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

