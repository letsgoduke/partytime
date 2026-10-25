import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AuthPanel, useAuth } from "./AuthPanel";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("../lib/aws-config", () => ({ awsConfigured: true }));
vi.mock("../lib/auth", () => ({
  auth: {
    signIn: mocks.signIn,
    getSession: mocks.getSession,
    subscribe: mocks.subscribe,
  },
}));
function SessionStatus() {
  const { ready, userId } = useAuth();
  return <p>{ready ? userId || "Signed out" : "Loading"}</p>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.subscribe.mockReturnValue(mocks.unsubscribe);
  mocks.getSession.mockResolvedValue(null);
  history.replaceState(null, "", "/manage#private-guest-credential");
});
afterEach(() => {
  cleanup();
  history.replaceState(null, "", "/");
});
describe("Cognito sign-in UI", () => {
  it("keeps private guest credentials outside the return path", async () => {
    mocks.signIn.mockResolvedValue(undefined);
    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Opening secure sign-in",
      ),
    );
    expect(mocks.signIn).toHaveBeenCalledWith("guest@example.com", "/manage");
  });
  it("shows a sign-in failure and lets the guest retry", async () => {
    mocks.signIn.mockRejectedValue(new Error("Please try again"));
    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with email" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Please try again"),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Continue with email",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("finishes checking a session even if storage lookup rejects", async () => {
    mocks.getSession.mockRejectedValue(new Error("Session unavailable"));
    const view = render(<SessionStatus />);
    await screen.findByText("Signed out");
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });
  it("does not overwrite a newer sign-in event with an older session lookup", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getSession.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    mocks.subscribe.mockImplementation(
      (listener: (event: string, session: unknown) => void) => {
        listener("SIGNED_IN", { userId: "verified-user", idToken: "token" });
        return mocks.unsubscribe;
      },
    );
    render(<SessionStatus />);
    await screen.findByText("verified-user");
    resolve(null);
    await waitFor(() => expect(screen.getByText("verified-user")).toBeTruthy());
  });
});
