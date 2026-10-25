import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/button";
/** Keep an unexpected render failure recoverable without logging private URLs or credentials. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Production telemetry must redact all guest capabilities before adding a logger. */
  }
  render() {
    if (this.state.failed)
      return (
        <main className="loading">
          <h1>Let’s get you back to the good stuff.</h1>
          <p>
            Something unexpected happened. Your saved draft is still on this
            device.
          </p>
          <Button onClick={() => location.reload()}>Reload Together</Button>
        </main>
      );
    return this.props.children;
  }
}
