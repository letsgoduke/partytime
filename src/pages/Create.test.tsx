import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Create from "./Create";

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  signIn: vi.fn(),
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("../lib/api", () => ({
  callApi: mocks.callApi,
  idempotencyKey: () => "create-request",
  supabase: {
    auth: {
      signInWithOtp: mocks.signIn,
      getSession: mocks.getSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: mocks.unsubscribe } },
      }),
    },
  },
}));
const values = {
  hostName: "Alex",
  title: "A lovely dinner",
  date: "2099-10-24",
  time: "19:00",
  endTime: "21:00",
  coverUrl: "https://example.com/photo.jpg",
  location: "Austin",
  address: "123 Dinner Lane",
  description: "Everyone welcome",
  budget: "300.25",
  capacity: "20",
  paymentUrl: "https://venmo.com/alex",
};
function openCreate() {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<Create />} />
        <Route path="/host/:id" element={<h1>Your party dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "host" } } },
    error: null,
  });
  mocks.callApi.mockResolvedValue({
    partyId: "party",
    inviteToken: "private-invite",
  });
});
afterEach(cleanup);

describe("party creation", () => {
  it("recovers malformed saved drafts without crashing", () => {
    localStorage.setItem(
      "together-party-draft",
      JSON.stringify({ values: { title: 123 }, needs: "invalid" }),
    );
    openCreate();
    expect(
      (screen.getByLabelText("Give it a name") as HTMLInputElement).value,
    ).toBe("");
    expect(
      screen.getByRole("heading", { name: "What’s the plan?" }),
    ).toBeTruthy();
  });

  it("validates date ordering before allowing the next step", async () => {
    localStorage.setItem(
      "together-party-draft",
      JSON.stringify({ values: { ...values, endTime: "18:00" }, needs: [] }),
    );
    openCreate();
    fireEvent.click(screen.getByRole("button", { name: "What do we need?" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "End time must be after",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "What’s the plan?" }),
    ).toBeTruthy();
  });

  it("rejects malformed image URLs and silently normalized impossible dates", async () => {
    localStorage.setItem(
      "together-party-draft",
      JSON.stringify({
        values: { ...values, coverUrl: "https://", date: "2099-02-30" },
        needs: [],
      }),
    );
    openCreate();
    fireEvent.click(screen.getByRole("button", { name: "What do we need?" }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
    );
    expect(mocks.callApi).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "What’s the plan?" }),
    ).toBeTruthy();
  });

  it("publishes restored details and validated needs with integer cents", async () => {
    localStorage.setItem(
      "together-party-draft",
      JSON.stringify({ values, needs: [] }),
    );
    openCreate();
    fireEvent.click(screen.getByRole("button", { name: "What do we need?" }));
    await screen.findByRole("heading", { name: "Many hands. Light work." });
    fireEvent.change(screen.getByLabelText("What else would help?"), {
      target: { value: "Ice" },
    });
    fireEvent.change(screen.getByLabelText("Estimated value per item ($)"), {
      target: { value: "-3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to the list" }));
    expect(screen.getByRole("status").textContent).toContain(
      "estimated item value",
    );
    fireEvent.change(screen.getByLabelText("Estimated value per item ($)"), {
      target: { value: "5.25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add to the list" }));
    expect(screen.getByText("1 × Ice")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Looking good" }));
    await screen.findByRole("heading", { name: "Almost party time." });
    fireEvent.click(
      screen.getByRole("button", { name: "Publish & invite my people" }),
    );
    await screen.findByRole("heading", { name: "Your party dashboard" });
    expect(mocks.callApi).toHaveBeenCalledWith(
      "createParty",
      expect.objectContaining({
        hostName: "Alex",
        budgetCents: 30025,
        coverUrl: values.coverUrl,
        capacity: 20,
        startsAt: new Date("2099-10-24T19:00").toISOString(),
        endsAt: new Date("2099-10-24T21:00").toISOString(),
        needs: [
          expect.objectContaining({
            title: "Ice",
            estimatedValueCents: 525,
            quantity: 1,
          }),
        ],
      }),
    );
    expect(localStorage.getItem("together-party-draft")).toBeNull();
  });

  it("handles rejected OTP requests and leaves the saved draft available", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.signIn.mockRejectedValue(new Error("Network unavailable"));
    localStorage.setItem(
      "together-party-draft",
      JSON.stringify({ values, needs: [] }),
    );
    openCreate();
    fireEvent.click(screen.getByRole("button", { name: "What do we need?" }));
    await screen.findByRole("button", { name: "Looking good" });
    fireEvent.click(screen.getByRole("button", { name: "Looking good" }));
    await screen.findByRole("heading", { name: "Almost party time." });
    fireEvent.change(screen.getByLabelText("Your email"), {
      target: { value: "alex@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send me a sign-in link" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Network unavailable",
      ),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Send me a sign-in link",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      JSON.parse(localStorage.getItem("together-party-draft")!).values.title,
    ).toBe(values.title);
  });
});
