import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { awsConfig, awsConfigured, cognitoIssuer } from "./aws-config";
export interface Session {
  userId: string;
  idToken: string;
}
export type AuthEvent = "SIGNED_IN" | "SIGNED_OUT";
const listeners = new Set<
  (event: AuthEvent, session: Session | null) => void
>();
let manager: UserManager | null = null;
let refreshing: Promise<User | null> | null = null;
function getManager() {
  if (!awsConfigured)
    throw new Error(
      "AWS sign-in is not configured yet. Your saved draft stays on this device.",
    );
  if (!manager) {
    manager = new UserManager({
      authority: cognitoIssuer(),
      client_id: awsConfig.clientId!,
      redirect_uri: `${location.origin}/auth/callback`,
      response_type: "code",
      scope: "openid email profile",
      automaticSilentRenew: false,
      loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: sessionStorage }),
      stateStore: new WebStorageStateStore({ store: sessionStorage }),
      metadata: {
        issuer: cognitoIssuer(),
        authorization_endpoint: `${awsConfig.domain}/oauth2/authorize`,
        token_endpoint: `${awsConfig.domain}/oauth2/token`,
        jwks_uri: `${cognitoIssuer()}/.well-known/jwks.json`,
        revocation_endpoint: `${awsConfig.domain}/oauth2/revoke`,
      },
    });
    manager.events.addUserLoaded((user) => emit("SIGNED_IN", asSession(user)));
    manager.events.addUserUnloaded(() => emit("SIGNED_OUT", null));
  }
  return manager;
}
function asSession(user: User | null): Session | null {
  // The API Gateway independently validates JWT signatures and the Lambda checks
  // verified email. Client checks only prevent displaying an expired/invalid session.
  if (
    !user ||
    user.expired ||
    !user.id_token ||
    !user.profile.sub ||
    user.profile.email_verified !== true
  )
    return null;
  return { userId: user.profile.sub, idToken: user.id_token };
}
function emit(event: AuthEvent, session: Session | null) {
  listeners.forEach((listener) => listener(event, session));
}
export function safeReturnPath(value: unknown): string {
  return typeof value === "string" &&
    /^\/(?:create|parties|profile|manage|host\/[a-zA-Z0-9-]+)$/.test(value)
    ? value
    : "/parties";
}
export const auth = {
  async getSession(): Promise<Session | null> {
    if (!awsConfigured) return null;
    const client = getManager();
    let user = await client.getUser();
    if (user?.expired && user.refresh_token) {
      refreshing ??= client.signinSilent().finally(() => {
        refreshing = null;
      });
      try {
        user = await refreshing;
      } catch {
        await client.removeUser();
        return null;
      }
    }
    return asSession(user);
  },
  subscribe(listener: (event: AuthEvent, session: Session | null) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  async signIn(email: string, returnTo = location.pathname) {
    // Only the path is saved in OIDC state. Private guest fragments never leave this tab.
    await getManager().signinRedirect({
      login_hint: email.trim(),
      state: { returnTo: safeReturnPath(returnTo) },
    });
  },
  async completeSignIn(): Promise<string> {
    const user = await getManager().signinRedirectCallback(location.href);
    if (!asSession(user)) {
      await getManager().removeUser();
      throw new Error(
        "A verified email is required to host. Please sign in again.",
      );
    }
    history.replaceState(null, "", "/auth/callback");
    return safeReturnPath(
      (user.state as { returnTo?: unknown } | undefined)?.returnTo,
    );
  },
  async signOut() {
    if (!awsConfigured) return;
    const client = getManager();
    // Local credentials are cleared even if remote revocation is temporarily unavailable.
    try {
      await client.revokeTokens(["refresh_token"]);
    } catch {
      /* Managed login logout below also clears its browser session. */
    }
    await client.removeUser();
    const url = new URL(`${awsConfig.domain}/logout`);
    url.searchParams.set("client_id", awsConfig.clientId!);
    url.searchParams.set("logout_uri", location.origin + "/");
    location.assign(url.toString());
  },
};
