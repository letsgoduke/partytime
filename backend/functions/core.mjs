const publicActions = new Set(['invitation','rsvp','guest','claim','pledge','releaseClaim','cancelPledge','editPledge','changeRsvp','confirmAttendance']);
const hostActions = new Set([...publicActions,'linkGuest','createParty','dashboard','listParties','confirmPayment','verifyClaim','attendance','finalize','rotateInvite','updateParty','postUpdate','profile','dispute','revokeGuest']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const header = (event, name) => Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
const failure = (status, message) => Object.assign(new Error(message), { status });

/** Trust only API Gateway's verified authorizer context. Never decode client JWTs without verification. */
export function verifiedIdentity(event, config) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!config.issuer || !config.clientId) throw failure(503, 'Authentication is not configured');
  if (!claims || claims.token_use !== 'id' || claims.iss !== config.issuer || claims.aud !== config.clientId ||
      !uuid.test(claims.sub ?? '') || ![true, 'true'].includes(claims.email_verified) ||
      typeof claims.email !== 'string' || claims.email.length > 320 || !claims.email.includes('@') ||
      /[\r\n]/.test(claims.email) || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Date.now()/1000) {
    throw failure(401, 'A verified Cognito email identity is required');
  }
  return { id: claims.sub, email: claims.email };
}

export function createHandler({ getClient, config }) {
  return async (event) => {
    const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
    if (config.origin) Object.assign(headers, { 'access-control-allow-origin': config.origin, vary: 'Origin' });
    const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
    let client;
    let transaction = false;
    try {
      const host = event.routeKey === 'POST /host';
      if (!host && event.routeKey !== 'POST /guest') throw failure(404, 'Route not found');
      if (header(event, 'origin') && header(event, 'origin') !== config.origin) throw failure(403, 'Origin not allowed');
      const raw = event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '';
      if (typeof raw !== 'string' || Buffer.byteLength(raw) > 100000) throw failure(413, 'Request is too large');
      let request;
      try { request = JSON.parse(raw); } catch { throw failure(400, 'A JSON request is required'); }
      if (!request || typeof request !== 'object' || Array.isArray(request) || typeof request.action !== 'string' ||
          !request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) throw failure(400, 'Action and object payload are required');
      if (!(host ? hostActions : publicActions).has(request.action)) throw failure(403, 'Action is not available on this route');
      const identity = host ? verifiedIdentity(event, config) : null;
      client = await getClient();
      await client.query('BEGIN'); transaction = true;
      await client.query("SET LOCAL statement_timeout = '8000ms'");
      await client.query("SET LOCAL lock_timeout = '3000ms'");
      // Runtime login has only this identity-bootstrap permission before switching to a browser-equivalent role.
      if (identity) await client.query('SELECT identity.bootstrap_user($1::uuid,$2::text)', [identity.id, identity.email]);
      await client.query(host ? 'SET LOCAL ROLE app_user' : 'SET LOCAL ROLE app_guest');
      await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [identity?.id ?? '']);
      const result = await client.query('SELECT public.party_api($1::text,$2::jsonb) AS data', [request.action, JSON.stringify(request.payload)]);
      await client.query('COMMIT'); transaction = false;
      return respond(200, { data: result.rows[0].data });
    } catch (error) {
      if (client && transaction) { try { await client.query('ROLLBACK'); } catch { /* release(true) discards this connection */ } }
      const status = error.status ?? ({'42501':403,'22023':400,'22P02':400,'23514':400,'23502':400,'23505':409,'54000':429,'55P03':409,'40P01':409,'57014':503,'P0001':409})[error.code] ?? 503;
      // PostgreSQL errors can contain row data and SQL. Expose only intentionally raised business messages.
      const message = error.status || ['42501','22023','P0001','54000'].includes(error.code) ? error.message : status === 503 ? 'Service is temporarily unavailable' : 'The request could not be completed';
      return respond(status, { error: { message, retryable: [409,429,503].includes(status) } });
    } finally {
      if (client) client.release(transaction);
    }
  };
}
