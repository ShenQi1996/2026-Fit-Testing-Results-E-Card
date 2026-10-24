import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { countFitTestsForUser } from '../../services/firebaseDb';
import { subscribeFitTestActivity } from '../../utils/fitTestActivity';
import { isAdminOrAbove } from '../../utils/roles';
import './Sidebar.css';

const Sidebar = ({ currentPage, onNavigate, isOpen }) => {
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user);
  const [testCount, setTestCount] = useState(null);

  const loadTestCount = useCallback(async () => {
    if (!user?.uid) {
      setTestCount(null);
      return;
    }

    try {
      const count = await countFitTestsForUser(user.uid);
      setTestCount(count);
    } catch (error) {
      console.error('Error loading test results count:', error);
      // Keep previous count if refresh fails.
    }
  }, [user?.uid]);

  useEffect(() => {
    loadTestCount();
  }, [currentPage, loadTestCount]);

  useEffect(() => subscribeFitTestActivity(() => {
    loadTestCount();
  }), [loadTestCount]);

  const testResultsLabel =
    testCount === null ? 'Test results' : `Test results (${testCount})`;

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-content">
        <h2 className="sidebar-title">Menu</h2>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-button ${currentPage === 'form' ? 'active' : ''}`}
            onClick={() => onNavigate('form')}
          >
            Send e-card
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
              Users
            </button>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
