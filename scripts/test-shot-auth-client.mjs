import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../apps/desktop/src/lib/auth-client.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const id = "123e4567-e89b-42d3-a456-426614174000";
const previousToken = `abrt_${id}.${"a".repeat(43)}`;
const rotatedToken = `abrt_${id}.${"b".repeat(43)}`;
const exports = {};
let saved = previousToken;
let scenario = "product-denial";
const runtime = {
  readRefreshToken: async () => saved,
  storeRefreshToken: async (value) => { saved = value; },
  deleteRefreshToken: async () => { saved = null; },
  revokeProductAccess: async () => {},
};
runInNewContext(outputText, {
  exports,
  require: (name) => {
    assert.equal(name, "@/lib/native-runtime");
    return { isNativeRuntime: () => true, nativeRuntime: runtime };
  },
  process: { env: {} }, AbortController, Headers, setTimeout, clearTimeout,
  fetch: async (url, init) => {
    if (!url.endsWith("/refresh")) return Response.json({ error: "Policy could not be verified" }, { status: 401 });
    assert.equal(JSON.parse(init.body).refreshToken, scenario === "product-denial" ? previousToken : rotatedToken);
    if (scenario === "proxy-error") return new Response("Service unavailable", { status: 403 });
    if (scenario === "expired") return Response.json({ error: "Desktop session expired" }, { status: 401 });
    return Response.json({
      accessToken: "test-access-token",
      accessTokenExpiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      refreshToken: rotatedToken,
      desktopSessionId: id,
      sessionGeneration: 1,
      user: { id: "test-user", username: "user", email: "user@example.test", role: "USER" },
      membership: { status: "active", plan: "Premium" },
    });
  },
});

await assert.rejects(exports.refreshSession(), /Policy could not be verified/);
assert.equal(saved, rotatedToken, "Product policy errors must preserve the rotated credential");
scenario = "proxy-error";
await assert.rejects(exports.refreshSession(), /403/);
assert.equal(saved, rotatedToken, "Non-Hub error responses must preserve the credential");
scenario = "expired";
assert.equal((await exports.refreshSession()).user, null);
assert.equal(saved, null, "A rejected refresh credential must be removed");
console.log("Shot refresh credential persistence checks passed.");
