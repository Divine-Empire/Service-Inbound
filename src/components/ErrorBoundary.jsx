import { Component } from "react";
import { AlertTriangle } from "lucide-react";

// Catches a render crash in one page so the sidebar/header stay usable.
// Layout keys it by pathname, so navigating to another page clears the error.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
        <p className="text-lg font-semibold text-slate-800">This page ran into a problem.</p>
        <p className="max-w-md text-sm text-slate-500">{this.state.error.message || "Unexpected error"}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reload page
        </button>
      </div>
    );
  }
}
