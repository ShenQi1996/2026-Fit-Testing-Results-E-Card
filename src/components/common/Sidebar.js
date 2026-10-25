import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { countFacultyFitTests, countFitTestsForUser } from '../../services/firebaseDb';
import { subscribeFitTestActivity } from '../../utils/fitTestActivity';
import { isAdminOrAbove, isFaculty } from '../../utils/roles';
import './Sidebar.css';

export const SIDEBAR_COUNT_CACHE_MS = 30 * 1000;

const Sidebar = ({ currentPage, onNavigate, isOpen }) => {
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user);
  const faculty = isFaculty(user);
  const [testCount, setTestCount] = useState(null);
  const countCache = useRef({ uid: '', at: 0 });
  const schoolKey = faculty ? (user?.school || '') : '';

  const loadTestCount = useCallback(async (force = false) => {
    if (!user?.uid) {
      setTestCount(null);
      countCache.current = { uid: '', at: 0 };
      return;
    }

    const cacheKey = faculty ? `${user.uid}:${schoolKey}` : user.uid;
    const cached = countCache.current.uid === cacheKey
      && Date.now() - countCache.current.at < SIDEBAR_COUNT_CACHE_MS;
    if (!force && cached) return;

    try {
      const count = faculty
        ? await countFacultyFitTests(user)
        : await countFitTestsForUser(user.uid);
      countCache.current = { uid: cacheKey, at: Date.now() };
      setTestCount(count);
    } catch (error) {
      console.error('Error loading test results count:', error);
      // Keep previous count if refresh fails.
    }
  }, [user, faculty, schoolKey]);

  useEffect(() => {
    loadTestCount(false);
  }, [currentPage, loadTestCount]);

  useEffect(() => subscribeFitTestActivity(() => {
    loadTestCount(true);
  }), [loadTestCount]);

  const testResultsLabel =
    testCount === null ? 'Test results' : `Test results (${testCount})`;

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-content">
        <h2 className="sidebar-title">Menu</h2>
        <nav className="sidebar-nav">
          {!faculty && (
            <button
              className={`sidebar-button ${currentPage === 'form' ? 'active' : ''}`}
              onClick={() => onNavigate('form')}
            >
              Send e-card
            </button>
          )}
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
