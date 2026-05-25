// Seed test users for E2E tests via the e2e-login API endpoint.
// Usage: npx tsx e2e/seed-test-users.ts
//
// Env vars:
//   E2E_API_URL   — API base URL (default: https://api.pushci.dev)
//   E2E_TEST_SECRET — must match the API's E2E_TEST_SECRET

const API_URL = process.env.E2E_API_URL || "https://api.pushci.dev";
const SECRET = process.env.E2E_TEST_SECRET || "pushci-e2e-test-2026";

interface TestUser {
  user_id: string;
  login: string;
  plan: "free" | "pro" | "team";
}

const USERS: TestUser[] = [
  { user_id: "test-free-001", login: "test_free_user", plan: "free" },
  { user_id: "test-pro-001", login: "test_pro_user", plan: "pro" },
  { user_id: "test-team-001", login: "test_team_user", plan: "team" },
];

async function seedUser(user: TestUser): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/e2e-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...user, e2e_secret: SECRET }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to seed ${user.login}: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { token: string; plan: string };
  console.log(
    `Seeded ${user.login} (plan=${data.plan}) token=${data.token.slice(0, 20)}...`
  );
}

async function main() {
  console.log(`Seeding test users against ${API_URL}`);
  for (const user of USERS) {
    await seedUser(user);
  }
  console.log("All test users seeded successfully.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
