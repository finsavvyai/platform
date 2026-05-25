// E2E auth helper — logs in test users via the e2e-login endpoint
// and injects JWT tokens into localStorage for Playwright tests.

import type { Page } from "@playwright/test";

const API_URL = process.env.E2E_API_URL || "https://api.pushci.dev";
const APP_URL = process.env.E2E_APP_URL || "https://app.pushci.dev";
const E2E_SECRET = process.env.E2E_TEST_SECRET || "pushci-e2e-test-2026";

export type TestPlan = "free" | "pro" | "team";

interface TestUser {
  userId: string;
  login: string;
  plan: TestPlan;
}

export const TEST_USERS: Record<string, TestUser> = {
  free: { userId: "test-free-001", login: "test_free_user", plan: "free" },
  pro: { userId: "test-pro-001", login: "test_pro_user", plan: "pro" },
  team: { userId: "test-team-001", login: "test_team_user", plan: "team" },
};

interface LoginResponse {
  token: string;
  user: { login: string; avatar_url: string; name: string; provider: string };
  plan: string;
}

export async function getTestToken(user: TestUser): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/e2e-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user.userId,
      login: user.login,
      plan: user.plan,
      e2e_secret: E2E_SECRET,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`E2E login failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<LoginResponse>;
}

export async function loginAs(page: Page, plan: TestPlan): Promise<string> {
  const user = TEST_USERS[plan];
  const session = await getTestToken(user);

  await page.goto(APP_URL);
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("pushci_token", token);
      localStorage.setItem("pushci_user", JSON.stringify(user));
      localStorage.setItem("pushci_onboarding_complete", "1");
      localStorage.setItem("pushci_welcome_dismissed", "1");
    },
    { token: session.token, user: session.user }
  );

  return session.token;
}
