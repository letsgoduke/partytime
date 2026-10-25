import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../functions/core.mjs";
const config = {
  issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
  clientId: "testclient",
  origin: "https://party.example",
};
const id = "10000000-0000-0000-0000-000000000001";
function event(action = "profile", host = true, payload = {}) {
  return {
    routeKey: host ? "POST /host" : "POST /guest",
    headers: { origin: config.origin },
    body: JSON.stringify({ action, payload }),
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: id,
            iss: config.issuer,
            aud: config.clientId,
            token_use: "id",
            email: "host@example.test",
            email_verified: "true",
            exp: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      },
    },
  };
}
function fixture(failAt) {
  const queries = [];
  const releases = [];
  let connections = 0;
  const handler = createHandler({
    config,
    getClient: async () => {
      connections++;
      return {
        query: async (sql, values) => {
          queries.push({ sql, values });
          if (sql === failAt)
            throw Object.assign(new Error("private-row-do-not-leak"), {
              code: "23514",
            });
          return { rows: [{ data: { ok: true } }] };
        },
        release: (destroy) => releases.push(destroy),
      };
    },
  });
  return {
    handler,
    queries,
    releases,
    get connections() {
      return connections;
    },
  };
}
test("host identity comes from verified context; transaction sets local role and clears on commit", async () => {
  const f = fixture();
  const response = await f.handler(event());
  assert.equal(response.statusCode, 200);
  assert.deepEqual(f.queries[3], {
    sql: "SELECT identity.bootstrap_user($1::uuid,$2::text)",
    values: [id, "host@example.test"],
  });
  assert.equal(f.queries[4].sql, "SET LOCAL ROLE app_user");
  assert.deepEqual(f.queries[5].values, [id]);
  assert.equal(f.queries.at(-1).sql, "COMMIT");
  assert.deepEqual(f.releases, [false]);
});
test("public route cannot call host actions or account linking", async () => {
  for (const action of [
    "createParty",
    "confirmPayment",
    "finalize",
    "linkGuest",
    "reverse_score",
  ]) {
    const f = fixture();
    assert.equal((await f.handler(event(action, false))).statusCode, 403);
    assert.equal(f.connections, 0);
  }
});
test("public guest request ignores spoofed identity fields", async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(event("rsvp", false, { hostId: id, profileId: id })))
      .statusCode,
    200,
  );
  assert.equal(
    f.queries.some((q) => q.sql.includes("bootstrap_user")),
    false,
  );
  assert.equal(f.queries[3].sql, "SET LOCAL ROLE app_guest");
  assert.deepEqual(f.queries[4].values, [""]);
});
test("missing, unverified, expired, wrong issuer/client, and access tokens are rejected", async () => {
  for (const mutation of [
    (e) => delete e.requestContext.authorizer,
    (e) => (e.requestContext.authorizer.jwt.claims.email_verified = "false"),
    (e) => (e.requestContext.authorizer.jwt.claims.exp = 1),
    (e) => (e.requestContext.authorizer.jwt.claims.iss = "other"),
    (e) => (e.requestContext.authorizer.jwt.claims.aud = "other"),
    (e) => (e.requestContext.authorizer.jwt.claims.token_use = "access"),
  ]) {
    const e = event();
    mutation(e);
    const f = fixture();
    assert.equal((await f.handler(e)).statusCode, 401);
    assert.equal(f.connections, 0);
  }
});
test("failed queries rollback, discard connection, and hide row details", async () => {
  const f = fixture("SELECT public.party_api($1::text,$2::jsonb) AS data");
  const response = await f.handler(event());
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.includes("private-row"), false);
  assert.equal(f.queries.at(-1).sql, "ROLLBACK");
  assert.deepEqual(f.releases, [true]);
});
test("bad origin, malformed JSON, oversized payload, unknown route rejected before DB", async () => {
  const inputs = [
    { ...event(), headers: { origin: "https://evil.example" } },
    { ...event(), body: "{" },
    { ...event(), body: "x".repeat(100001) },
    { ...event(), routeKey: "POST /migrate" },
  ];
  for (const e of inputs) {
    const f = fixture();
    assert.ok((await f.handler(e)).statusCode >= 400);
    assert.equal(f.connections, 0);
  }
});
test("sequential guest and host calls use isolated local identities", async () => {
  const f = fixture();
  await f.handler(event());
  await f.handler(event("guest", false));
  const identities = f.queries
    .filter((q) => q.sql.includes("set_config"))
    .map((q) => q.values[0]);
  assert.deepEqual(identities, [id, ""]);
});

test("explicit development origin is opt-in and response matches validated origin; nonbrowser requests work", async () => {
  let connections = 0;
  const client = {
    query: async () => ({ rows: [{ data: { ok: true } }] }),
    release: () => {},
  };
  const e = event("invitation", false);
  e.headers.origin = "http://localhost:5173";
  const handler = createHandler({
    config: { ...config, allowedOrigins: ["http://localhost:5173"] },
    getClient: async () => {
      connections++;
      return client;
    },
  });
  const response = await handler(e);
  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
  const production = fixture();
  assert.equal((await production.handler(e)).statusCode, 403);
  delete e.headers.origin;
  assert.equal((await handler(e)).statusCode, 200);
  assert.equal(connections, 2);
});
