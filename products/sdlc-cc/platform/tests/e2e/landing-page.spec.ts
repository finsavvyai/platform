import { test, expect, Page } from "@playwright/test";

const isMobileViewport = async (page: Page) => {
  const viewport = page.viewportSize();
  return !!viewport && viewport.width < 768;
};

const openMobileMenuIfNeeded = async (page: Page) => {
  if (await isMobileViewport(page)) {
    const menuButton = page.locator("header button").first();
    await expect(menuButton).toBeVisible();
    await menuButton.click();
  }
};

test.describe("Landing Page - Live Contract", () => {
  test("loads with expected title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(
      /SDLC\.ai \| Apple-grade AI Security & Compliance/,
    );
  });

  test("shows hero heading and positioning copy", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Protect AI workflows");
    await expect(
      page.locator("text=Apple-grade UX. Enterprise-grade AI compliance."),
    ).toBeVisible();
  });

  test("has primary SEO meta description", async ({ page }) => {
    await page.goto("/");
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toContain("Modern AI compliance layer");
    expect(description).toContain("Automatic redaction");
  });

  test("has OpenGraph title and description", async ({ page }) => {
    await page.goto("/");
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content");
    expect(ogTitle).toContain("SDLC.ai");
    expect(ogDescription).toContain("policy enforcement");
  });

  test("has canonical URL set to sdlc.cc", async ({ page }) => {
    await page.goto("/");
    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute("href");
    expect(canonical).toBe("https://sdlc.cc/");
  });

  test("returns successful HTML response", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).toBeTruthy();
    expect(response!.status()).toBe(200);
    const contentType = response!.headers()["content-type"] || "";
    expect(contentType).toContain("text/html");
  });
});

test.describe("Navigation", () => {
  test("shows sticky header and brand", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(
      page.locator("header").getByText("SDLC.ai").first(),
    ).toBeVisible();
  });

  test("shows core navigation links or mobile menu", async ({ page }) => {
    await page.goto("/");
    if (await isMobileViewport(page)) {
      await expect(page.locator("header button").first()).toBeVisible();
    } else {
      await expect(page.locator('header a[href="#features"]')).toBeVisible();
      await expect(page.locator('header a[href="#openclaw"]')).toBeVisible();
      await expect(page.locator('header a[href="#pricing"]')).toBeVisible();
      await expect(page.locator('header a[href="#demo"]')).toBeVisible();
    }
  });

  test("shows auth CTAs on desktop", async ({ page }) => {
    await page.goto("/");
    if (await isMobileViewport(page)) {
      test.skip();
    }
    await expect(
      page.locator('header a[href="/sign-in"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('header a[href="/sign-up"]').first(),
    ).toBeVisible();
  });

  test("mobile menu reveals links when opened", async ({ page }) => {
    await page.goto("/");
    if (!(await isMobileViewport(page))) {
      test.skip();
    }
    await openMobileMenuIfNeeded(page);
    await expect(
      page.locator('header a[href="#features"]:visible'),
    ).toBeVisible();
    await expect(
      page.locator('header a[href="#openclaw"]:visible'),
    ).toBeVisible();
    await expect(
      page.locator('header a[href="#pricing"]:visible'),
    ).toBeVisible();
    await expect(page.locator('header a[href="#demo"]:visible')).toBeVisible();
  });
});

test.describe("Hero", () => {
  test("shows value proposition chips", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=No workflow rewrite")).toBeVisible();
    await expect(page.locator("text=Built-in evidence trail")).toBeVisible();
    await expect(page.locator("text=HIPAA/GDPR/FINRA aligned")).toBeVisible();
  });

  test("shows hero metric cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=12+").first()).toBeVisible();
    await expect(page.locator("text=<50ms").first()).toBeVisible();
    await expect(page.locator("text=100%").first()).toBeVisible();
  });

  test("has primary and secondary hero CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Start Free Trial" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "View plans" })).toBeVisible();
  });
});

test.describe("Trust Bar", () => {
  test("renders compliance badges", async ({ page }) => {
    await page.goto("/");
    // HIPAA/GDPR/FINRA appear in the trust bar AND in pricing/footer cards;
    // scope to the dedicated compliance region so the assertion is unambiguous.
    const trustBar = page.locator(
      'section[aria-label="Compliance certifications"]',
    );
    await expect(trustBar.locator("text=SOC 2 Type II")).toBeVisible();
    await expect(trustBar.locator("text=HIPAA")).toBeVisible();
    await expect(trustBar.locator("text=GDPR")).toBeVisible();
    await expect(trustBar.locator("text=FINRA")).toBeVisible();
  });

  test("shows regulated industries label", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("text=Built for regulated industries"),
    ).toBeVisible();
  });
});

test.describe("Features Section", () => {
  test("renders features heading and intro", async ({ page }) => {
    await page.goto("/");
    await page.locator("#features").scrollIntoViewIfNeeded();
    await expect(page.locator("#features h2")).toContainText(
      "Built for secure AI at scale",
    );
  });

  test("renders exactly six feature cards", async ({ page }) => {
    await page.goto("/");
    await page.locator("#features").scrollIntoViewIfNeeded();
    await expect(page.locator("#features h3")).toHaveCount(6);
  });

  test("renders expected feature card titles", async ({ page }) => {
    await page.goto("/");
    await page.locator("#features").scrollIntoViewIfNeeded();
    await expect(
      page.locator('#features h3:has-text("Model Agnostic")'),
    ).toBeVisible();
    await expect(
      page.locator('#features h3:has-text("Automatic Data Protection")'),
    ).toBeVisible();
    await expect(
      page.locator('#features h3:has-text("Compliance by Default")'),
    ).toBeVisible();
    await expect(
      page.locator('#features h3:has-text("Operational Governance")'),
    ).toBeVisible();
  });

  test("shows detailed bullet points for features", async ({ page }) => {
    await page.goto("/");
    await page.locator("#features").scrollIntoViewIfNeeded();
    await expect(page.locator("#features li")).toHaveCount(30);
  });
});

test.describe("OpenClaw Section", () => {
  test("renders openclaw section and heading", async ({ page }) => {
    await page.goto("/");
    await page.locator("#openclaw").scrollIntoViewIfNeeded();
    await expect(page.locator("#openclaw h2")).toContainText(
      "Embedded OpenClaw capabilities",
    );
  });

  test("renders four OpenClaw capability groups", async ({ page }) => {
    await page.goto("/");
    await page.locator("#openclaw").scrollIntoViewIfNeeded();
    await expect(page.locator("#openclaw h3")).toHaveCount(4);
    await expect(
      page.locator('#openclaw h3:has-text("Channels")'),
    ).toBeVisible();
    await expect(
      page.locator('#openclaw h3:has-text("Node Capabilities")'),
    ).toBeVisible();
    await expect(
      page.locator('#openclaw h3:has-text("Extensions")'),
    ).toBeVisible();
    await expect(page.locator('#openclaw h3:has-text("Skills")')).toBeVisible();
  });

  test("shows representative OpenClaw capability tags", async ({ page }) => {
    await page.goto("/");
    await page.locator("#openclaw").scrollIntoViewIfNeeded();
    await expect(
      page.locator("#openclaw").getByText("discord").first(),
    ).toBeVisible();
    await expect(
      page.locator("#openclaw").getByText("voicewake").first(),
    ).toBeVisible();
    await expect(
      page.locator("#openclaw").getByText("memory-core").first(),
    ).toBeVisible();
    await expect(
      page.locator("#openclaw").getByText("github").first(),
    ).toBeVisible();
  });
});

test.describe("Pricing Section", () => {
  test("renders pricing heading and all plans", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.locator("#pricing h2")).toContainText(
      "Pricing with clear guardrails",
    );
    await expect(
      page.locator('#pricing h3:has-text("Developer")'),
    ).toBeVisible();
    await expect(page.locator('#pricing h3:has-text("Startup")')).toBeVisible();
    await expect(
      page.locator('#pricing h3:has-text("Enterprise")'),
    ).toBeVisible();
  });

  test("shows pricing values and recommended badge", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(
      page.locator("#pricing").getByText("Free").first(),
    ).toBeVisible();
    await expect(
      page.locator("#pricing").getByText("$99").first(),
    ).toBeVisible();
    await expect(
      page.locator("#pricing").getByText("Custom").first(),
    ).toBeVisible();
    await expect(
      page.locator("#pricing").getByText("Recommended"),
    ).toBeVisible();
  });

  test("renders pricing action buttons", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(
      page.locator('#pricing button:has-text("Get started")'),
    ).toHaveCount(2);
    await expect(
      page.locator('#pricing button:has-text("Contact sales")'),
    ).toHaveCount(1);
  });
});

test.describe("Demo Form", () => {
  test("renders demo form heading and all required fields", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#demo").scrollIntoViewIfNeeded();
    await expect(page.locator("#demo h2")).toContainText(
      "Book a guided rollout",
    );
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="company"]')).toBeVisible();
    await expect(page.locator('select[name="timeline"]')).toBeVisible();
    await expect(page.locator('textarea[name="useCase"]')).toBeVisible();
  });

  test("has timeline options and submit button", async ({ page }) => {
    await page.goto("/");
    await page.locator("#demo").scrollIntoViewIfNeeded();
    await expect(page.locator('select[name="timeline"] option')).toHaveCount(6);
    await expect(page.locator('#demo button[type="submit"]')).toContainText(
      "Schedule demo",
    );
    await expect(page.locator('#demo button[type="submit"]')).toBeEnabled();
  });
});

test.describe("Footer", () => {
  test("renders footer sections and links", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect(page.locator('footer h3:has-text("Product")')).toBeVisible();
    await expect(page.locator('footer h3:has-text("Contact")')).toBeVisible();
    await expect(page.locator('footer a[href="#features"]')).toBeVisible();
    await expect(page.locator('footer a[href="#openclaw"]')).toBeVisible();
    await expect(page.locator('footer a[href="#pricing"]')).toBeVisible();
  });

  test("renders footer contact mailto links and copyright", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect(
      page.locator('footer a[href="mailto:security@sdlc.finsavvyai.com"]'),
    ).toBeVisible();
    await expect(
      page.locator('footer a[href="mailto:support@sdlc.finsavvyai.com"]'),
    ).toBeVisible();
    await expect(
      page.locator('footer a[href="mailto:sales@sdlc.finsavvyai.com"]'),
    ).toBeVisible();
    await expect(page.locator("footer")).toContainText(
      "© 2026 SDLC.ai. All rights reserved.",
    );
  });
});

test.describe("Linking, Performance, Accessibility", () => {
  test("section anchors are present and reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#features")).toBeVisible();
    await expect(page.locator("#openclaw")).toBeVisible();
    await expect(page.locator("#pricing")).toBeVisible();
    await expect(page.locator("#demo")).toBeVisible();
  });

  test("clicking View plans navigates to pricing hash", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "View plans" }).click();
    await expect(page).toHaveURL(/#pricing/);
  });

  test("page load time is acceptable", async ({ page }) => {
    const started = Date.now();
    await page.goto("/");
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(7000);
  });

  test("no console errors are emitted", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });

  test("heading hierarchy and image alts are present", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("h1").count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator("h2").count()).toBeGreaterThan(0);

    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).not.toBeNull();
    }
  });
});
