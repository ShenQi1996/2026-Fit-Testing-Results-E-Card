import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUserFitTests } from '../../services/firebaseDb';
import './Sidebar.css';

const Sidebar = ({ currentPage, onNavigate, isOpen }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [testCount, setTestCount] = useState(null);

  const loadTestCount = useCallback(async () => {
    if (!user?.uid) {
      setTestCount(null);
      return;
    }

    try {
      const tests = await getUserFitTests(user.uid);
      setTestCount(Array.isArray(tests) ? tests.length : 0);
    } catch (error) {
      console.error('Error loading test results count:', error);
      // Keep previous count if refresh fails.
    }
  }, [user?.uid]);

  useEffect(() => {
    loadTestCount();
  }, [loadTestCount, currentPage]);

  const testResultsLabel =
    testCount === null ? '📋 Test Results' : `📋 Test Results (${testCount})`;

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-content">
        <h2 className="sidebar-title">Navigation</h2>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-button ${currentPage === 'form' ? 'active' : ''}`}
            onClick={() => onNavigate('form')}
          >
            📧 Send E-Card
          </button>
          <button
            className={`sidebar-button ${currentPage === 'results' ? 'active' : ''}`}
            onClick={() => onNavigate('results')}
          >
            <span className="sidebar-button-label">{testResultsLabel}</span>
          </button>
          {isAdmin && (
            <button
              className={`sidebar-button ${currentPage === 'users' ? 'active' : ''}`}
              onClick={() => onNavigate('users')}
            >
              👥 Users Management
            </button>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
