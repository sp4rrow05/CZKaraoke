import { Component, type ReactNode } from 'react';

/** Shows a recovery message instead of a blank page if something throws while rendering. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Karaoke UI crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="center-screen">
        <h2>Something went wrong</h2>
        <p className="muted">Reloading the page usually fixes it. You’ll stay in your room.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
