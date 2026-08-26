/**
 * Tiny OpenID Connect provider for local development and tests.
 * Auto-approves every login as the user given by ?login_hint=<email> (default sso@example.com).
 *
 *   node scripts/mock-oidc.mjs            # listens on http://localhost:3400
 *   OIDC_ISSUER=http://localhost:3400 OIDC_CLIENT_ID=e-learner npm run dev
 */
import http from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

export async function startMockIdp(port = 3400, clientId = "e-learner") {
  const issuer = `http://localhost:${port}`;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "mock-1", alg: "RS256", use: "sig" };
  const codes = new Map(); // code → { email, name, nonce, challenge }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, issuer);
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === "/.well-known/openid-configuration") {
      return json(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        userinfo_endpoint: `${issuer}/userinfo`,
        response_types_supported: ["code"],
        id_token_signing_alg_values_supported: ["RS256"],
        code_challenge_methods_supported: ["S256"],
      });
    }
    if (url.pathname === "/jwks") return json(200, { keys: [jwk] });

    if (url.pathname === "/authorize") {
      const email = url.searchParams.get("login_hint") || process.env.MOCK_OIDC_EMAIL || "sso@example.com";
      const name = process.env.MOCK_OIDC_NAME || "Sam Single-Sign-On";
      const code = randomBytes(16).toString("base64url");
      codes.set(code, { email, name, nonce: url.searchParams.get("nonce"), challenge: url.searchParams.get("code_challenge") });
      const back = new URL(url.searchParams.get("redirect_uri"));
      back.searchParams.set("code", code);
      back.searchParams.set("state", url.searchParams.get("state") || "");
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }

    if (url.pathname === "/token" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const p = new URLSearchParams(body);
      const entry = codes.get(p.get("code"));
      codes.delete(p.get("code"));
      if (!entry) return json(400, { error: "invalid_grant" });
      const expected = createHash("sha256").update(p.get("code_verifier") || "").digest("base64url");
      if (entry.challenge && entry.challenge !== expected) return json(400, { error: "invalid_grant", error_description: "PKCE mismatch" });
      const idToken = await new SignJWT({ email: entry.email, name: entry.name, nonce: entry.nonce })
        .setProtectedHeader({ alg: "RS256", kid: "mock-1" })
        .setIssuer(issuer)
        .setAudience(clientId)
        .setSubject(`mock|${entry.email}`)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
      return json(200, { access_token: randomBytes(8).toString("hex"), token_type: "Bearer", id_token: idToken });
    }

    if (url.pathname === "/userinfo") return json(200, {});
    json(404, { error: "not_found" });
  });

  await new Promise((resolve) => server.listen(port, resolve));
  return { issuer, close: () => new Promise((r) => server.close(r)) };
}

// Run standalone: `node scripts/mock-oidc.mjs` (no import.meta so the test runner can also import this file).
if (process.argv[1] && /mock-oidc\.mjs$/.test(process.argv[1])) {
  startMockIdp(Number(process.env.PORT) || 3400).then(({ issuer }) => console.log(`Mock OIDC provider listening at ${issuer}`));
}
