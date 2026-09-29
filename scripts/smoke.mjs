// End-to-end smoke test against a running production build:
//
//   npm run build && npm start        (in one terminal)
//   npm run test:smoke                (in another; BASE_URL defaults to :3000)
//
// Needs no account and writes nothing: it only exercises what a signed-out
// visitor — or an attacker — can reach. CI runs it on every push; see
// docs/DEVOPS.md §4.
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const failures = [];

async function check(name, test) {
  try {
    await test();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const request = (path, init = {}) => fetch(`${base}${path}`, { redirect: "manual", ...init });

console.log(`Smoke testing ${base}`);

await check("the login page renders", async () => {
  const response = await request("/login");
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert((await response.text()).includes("Log in"), "no login form in the page");
});

await check("every script on the page carries this response's CSP nonce", async () => {
  const response = await request("/login");
  const csp = response.headers.get("content-security-policy") ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  assert(nonce, `no nonce in Content-Security-Policy: "${csp}"`);
  assert(!/script-src[^;]*'unsafe-inline'/.test(csp), "script-src allows 'unsafe-inline'");
  const scripts = [...(await response.text()).matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
  assert(scripts.length > 0, "no scripts found");
  const unsigned = scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`));
  assert(unsigned.length === 0, `${unsigned.length} script(s) without the nonce, e.g. ${unsigned[0]}`);
});

await check("security headers are set, and the framework isn't advertised", async () => {
  for (const path of ["/login", "/api/stripe/webhook"]) {
    const headers = (await request(path)).headers;
    for (const name of ["strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]) {
      assert(headers.get(name), `${path} is missing ${name}`);
    }
    assert(!headers.get("x-powered-by"), `${path} sends x-powered-by`);
  }
});

await check("signed-out visitors are sent to /login", async () => {
  for (const path of ["/", "/board/00000000-0000-0000-0000-000000000000"]) {
    const response = await request(path);
    assert(response.status === 307, `${path}: expected 307, got ${response.status}`);
    const location = new URL(response.headers.get("location") ?? "", base);
    assert(location.pathname === "/login", `${path} redirects to ${location}`);
  }
});

await check("the Stripe webhook is reachable and rejects unsigned events", async () => {
  const response = await request("/api/stripe/webhook", { method: "POST", body: "{}" });
  assert(response.status === 400, `expected 400 (signature check), got ${response.status}`);
});

await check("billing routes refuse cross-site form posts", async () => {
  for (const path of ["/api/stripe/checkout", "/api/stripe/portal"]) {
    const response = await request(path, { method: "POST", headers: { origin: "https://evil.example" } });
    assert(response.status === 403, `${path}: expected 403, got ${response.status}`);
  }
});

await check("billing routes still require a login", async () => {
  for (const path of ["/api/stripe/checkout", "/api/stripe/portal"]) {
    const response = await request(path, { method: "POST", headers: { origin: base } });
    const location = new URL(response.headers.get("location") ?? "", base);
    assert(response.status === 307 && location.pathname === "/login", `${path}: got ${response.status} → ${location}`);
  }
});

if (failures.length > 0) {
  console.log(`\n${failures.length} smoke check(s) failed.`);
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
