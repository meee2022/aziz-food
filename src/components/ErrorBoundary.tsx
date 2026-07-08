import { Component, ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div style={{ padding: 24, fontFamily: "monospace", direction: "ltr" }}>
          <h2 style={{ color: "#b91c1c" }}>App error</h2>
          <pre id="app-error" style={{ whiteSpace: "pre-wrap", background: "#fef2f2", padding: 16, borderRadius: 8 }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
