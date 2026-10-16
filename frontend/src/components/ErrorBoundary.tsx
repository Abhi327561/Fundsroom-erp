import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches render crashes (e.g. a chart library failure) and shows a
// retryable message instead of a blank white page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Page crashed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-layout">
          <main className="content">
            <div className="empty-state">
              <h3>Something went wrong on this page</h3>
              <p className="muted">{this.state.error.message}</p>
              <div style={{ marginTop: 12 }}>
                <button onClick={() => window.location.reload()}>↻ Reload page</button>
              </div>
            </div>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
