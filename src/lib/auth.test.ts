import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  removeUser: vi.fn(),
  revokeTokens: vi.fn(),
  userLoaded: vi.fn(),
  userUnloaded: vi.fn(),
}));
vi.mock("oidc-client-ts", () => ({
  WebStorageStateStore: class {},
  UserManager: class {
    events = {
      addUserLoaded: mocks.userLoaded,
      addUserUnloaded: mocks.userUnloaded,
    };
    signinRedirect = mocks.signinRedirect;
    signinRedirectCallback = mocks.signinRedirectCallback;
    getUser = mocks.getUser;
    signinSilent = mocks.signinSilent;
    removeUser = mocks.removeUser;
    revokeTokens = mocks.revokeTokens;
  },
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv(
    "VITE_AWS_API_URL",
    "https://example.execute-api.us-east-1.amazonaws.com",
  );
  vi.stubEnv("VITE_AWS_REGION", "us-east-1");
  vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "us-east-1_example");
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "client");
  vi.stubEnv(
    "VITE_COGNITO_DOMAIN",
    "https://example.auth.us-east-1.amazoncognito.com",
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("Cognito session boundary", () => {
  it("never includes a private guest fragment in the sign-in return path", async () => {
    const { auth } = await import("./auth");
    await auth.signIn("guest@example.com", "/manage#private-credential");
    expect(mocks.signinRedirect).toHaveBeenCalledWith({
      login_hint: "guest@example.com",
      nonce: expect.any(String),
      state: { returnTo: "/parties" },
    });
  });
  it("rejects external and protocol-relative return destinations", async () => {
    const { safeReturnPath } = await import("./auth");
    expect(safeReturnPath("//attacker.test")).toBe("/parties");
    expect(safeReturnPath("https://attacker.test")).toBe("/parties");
    expect(safeReturnPath("/create")).toBe("/create");
  });
  it("requires verified email before returning a client session", async () => {
    mocks.getUser.mockResolvedValue({
      id_token: "token",
      expired: false,
      profile: { sub: "host", email_verified: false },
    });
    const { auth } = await import("./auth");
    expect(await auth.getSession()).toBeNull();
  });
  it("refreshes an expired session once for concurrent requests", async () => {
    mocks.getUser.mockResolvedValue({
      expired: true,
      refresh_token: "refresh",
    });
    mocks.signinSilent.mockResolvedValue({
      expired: false,
      id_token: "fresh",
      profile: { sub: "host", email_verified: true },
    });
    const { auth } = await import("./auth");
    const sessions = await Promise.all([auth.getSession(), auth.getSession()]);
    expect(mocks.signinSilent).toHaveBeenCalledTimes(1);
    expect(sessions[0]).toEqual({ userId: "host", idToken: "fresh" });
  });
  it("clears a failed refresh and requires a new sign-in", async () => {
    mocks.getUser.mockResolvedValue({
      expired: true,
      refresh_token: "refresh",
    });
    mocks.signinSilent.mockRejectedValue(new Error("Expired"));
    const { auth } = await import("./auth");
    expect(await auth.getSession()).toBeNull();
    expect(mocks.removeUser).toHaveBeenCalled();
  });
});
