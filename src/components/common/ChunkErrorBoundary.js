import React from 'react';

// A lazy page whose chunk fails to download (offline, or an old tab after a new
// deploy replaced the hashed files) would otherwise blank the whole app. This
// shows a message and a reload button instead.
class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Page failed to load:', error);
  }

  handleReload() {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container">
          <div className="page-load-error" role="alert">
            <p>This page could not load. Check your connection and reload.</p>
            <button type="button" className="auth-button" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChunkErrorBoundary;
