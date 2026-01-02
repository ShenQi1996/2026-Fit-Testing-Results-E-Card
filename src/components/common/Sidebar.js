import React from 'react';
import './Sidebar.css';

const Sidebar = ({ currentPage, onNavigate }) => {
  return (
    <aside className="sidebar">
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
            📋 Test Results
          </button>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;

