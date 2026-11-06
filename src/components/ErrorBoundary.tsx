"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional retry action (e.g. refetch). Defaults to reloading the page. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Optional secondary action, e.g. switching video server. */
  onSwitchServer?: () => void;
  switchLabel?: string;
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/** Client-side error boundary with inline recovery actions. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || "Kesalahan tidak diketahui" };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, message: "" });
    if (this.props.onRetry) {
      this.props.onRetry();
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        className="card"
        style={{ padding: 24, textAlign: "center", maxWidth: 480, margin: "24px auto" }}
        role="alert"
      >
        <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">⚠️</div>
        <h3 style={{ margin: "0 0 8px" }}>{this.props.title || "Terjadi kesalahan"}</h3>
        <p style={{ color: "var(--text-soft)", fontSize: 14, margin: "0 0 16px" }}>
          {this.state.message || "Kami sedang memperbaiki. Silakan coba lagi."}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            {this.props.retryLabel || "Coba Lagi"}
          </button>
          {this.props.onSwitchServer ? (
            <button type="button" className="btn btn-ghost" onClick={this.props.onSwitchServer}>
              {this.props.switchLabel || "Ganti Server"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}
