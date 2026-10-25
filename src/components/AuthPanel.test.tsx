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
  onChange: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  supabase: {
    auth: {
      signInWithOtp: mocks.signIn,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onChange,
    },
  },
}));
function SessionStatus() {
  const { ready, userId } = useAuth();
  return <p>{ready ? userId || "Signed out" : "Loading"}</p>;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.onChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  });
  history.replaceState(null, "", "/manage#private-guest-credential");
});
afterEach(() => {
  cleanup();
  history.replaceState(null, "", "/");
});

describe("email authentication", () => {
  it("keeps guest management credentials out of email redirect URLs", async () => {
    mocks.signIn.mockResolvedValue({ error: null });
    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a sign-in link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Check your email",
      ),
    );
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "guest@example.com",
      options: { emailRedirectTo: location.origin + "/manage" },
    });
  });
  it("recovers from thrown network errors and allows retry", async () => {
    mocks.signIn.mockRejectedValue(new Error("Please try again"));
    render(<AuthPanel />);
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "guest@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send a sign-in link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Please try again"),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Send a sign-in link",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
  it("finishes checking a session even when storage or network lookup rejects", async () => {
    mocks.getSession.mockRejectedValue(new Error("Session unavailable"));
    const view = render(<SessionStatus />);
    await screen.findByText("Signed out");
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });
  it("preserves newer auth events when an earlier session request resolves late", async () => {
    let resolveSession!: (value: unknown) => void;
    mocks.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    mocks.onChange.mockImplementation(
      (
        callback: (event: string, session: { user: { id: string } }) => void,
      ) => {
        callback("SIGNED_IN", { user: { id: "verified-user" } });
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    );
    render(<SessionStatus />);
    await screen.findByText("verified-user");
    resolveSession({ data: { session: null }, error: null });
    await waitFor(() => expect(screen.getByText("verified-user")).toBeTruthy());
  });
});
