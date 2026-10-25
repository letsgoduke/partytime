import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "../App";
import { readDemo } from "../lib/demo";
import { callApi } from "../lib/api";

vi.mock("../lib/api", () => ({
  supabase: null,
  callApi: vi.fn(),
  idempotencyKey: () => "test-request",
}));

function openApp(path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/invite/:token" element={<App />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  // jsdom lacks native dialog methods; retain the production component and modal semantics.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("invitation participation", () => {
  it("gates a supply claim behind RSVP without silently creating a claim", () => {
    openApp();
    fireEvent.click(
      screen.getAllByRole("button", { name: "I’ll bring this" })[0]!,
    );
    expect(screen.getByRole("dialog", { name: "Your RSVP" })).toBeTruthy();
    expect(readDemo().claims).toHaveLength(0);
    expect(
      screen.getByText("No account. No admission fee. Just a good time."),
    ).toBeTruthy();
  });

  it("saves an RSVP with no contribution and lets the guest contribute later", async () => {
    openApp();
    fireEvent.click(screen.getAllByRole("button", { name: "I’m coming" })[0]!);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Casey" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save my RSVP" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(readDemo().guests.some((guest) => guest.name === "Casey")).toBe(
      true,
    );
    expect(readDemo().going).toBe(19);
    expect(readDemo().pendingCents).toBe(3500);
    expect(readDemo().claims).toHaveLength(0);
    expect(
      screen.getByRole("region", { name: "Optional ways to join in" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Just coming" }));
    expect(
      screen.queryByRole("region", { name: "Optional ways to join in" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chip in" }));
    expect(
      screen.getByText(
        "Choose any amount. This saves a pledge, not a payment.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pledge $20" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(readDemo().pendingCents).toBe(5500);
    expect(readDemo().confirmedCents).toBe(21000);
    expect(screen.getByRole("status").textContent).toContain(
      "Only the host can confirm money received",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Manage my commitments" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("New pledge amount ($)"), {
      target: { value: "12.34" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save amount" }));
    await waitFor(() => expect(readDemo().pendingCents).toBe(4734));
    expect(readDemo().confirmedCents).toBe(21000);
  });

  it("shows invalid pledge errors and preserves the funding balance", async () => {
    sessionStorage.setItem(
      "demo-guest",
      JSON.stringify({ id: "casey", name: "Casey", status: "going" }),
    );
    openApp();
    fireEvent.click(screen.getByRole("button", { name: "Chip in" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Custom amount ($)"), {
      target: { value: "-5" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pledge -$5" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Enter an amount",
      ),
    );
    expect(readDemo().pendingCents).toBe(3500);
    expect(readDemo().confirmedCents).toBe(21000);
  });

  it("shows a failed private invitation response and a path back to the demo", async () => {
    vi.mocked(callApi).mockRejectedValueOnce(new Error("Invitation expired"));
    openApp("/invite/expired-token");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          name: "This invitation couldn’t be opened.",
        }),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Invitation expired")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Explore the demo" })
        .getAttribute("href"),
    ).toBe("/");
  });
});
