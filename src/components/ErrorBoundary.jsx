import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }

  render() {
    if (this.state.error) {
      return (
        <div className="surface p-8 text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">Something went wrong</p>
          <button className="btn-secondary" type="button" onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
