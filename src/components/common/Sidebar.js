import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getFitTestListSnapshot,
  loadFitTestList,
  subscribeFitTestList,
} from '../../services/fitTestListStore';
import { isAccessWindowOpen, isAdminOrAbove, isFaculty } from '../../utils/roles';
import './Sidebar.css';

const Sidebar = ({ currentPage, onNavigate, isOpen }) => {
  const { user } = useAuth();
  const isAdmin = isAdminOrAbove(user);
  const faculty = isFaculty(user);
  const [listSnapshot, setListSnapshot] = useState(getFitTestListSnapshot);
  const schoolKey = faculty ? (user?.school || '') : '';
  const windowOpen = !faculty || isAccessWindowOpen(user);
  const countReady = Boolean(user?.uid)
    && windowOpen
    && listSnapshot.loaded
    && listSnapshot.key
    && (
      faculty
        ? listSnapshot.key === `faculty:${user.uid}:${schoolKey}`
        : listSnapshot.key === `tester:${user.uid}`
    );
  const testCount = countReady ? listSnapshot.count : null;

  useEffect(() => subscribeFitTestList(setListSnapshot), []);

  useEffect(() => {
    if (!user?.uid || !windowOpen) return undefined;
    loadFitTestList(user);
    return undefined;
  }, [user, faculty, schoolKey, windowOpen, currentPage]);

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
