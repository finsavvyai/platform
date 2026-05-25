#!/usr/bin/env tsx

/**
 * Database Seeding Script for Qestro Platform
 *
 * This script generates comprehensive test data for development environment.
 * It creates users, projects, test cases, recordings, and other necessary data
 * to support development and testing of the Qestro platform.
 *
 * Usage:
 *   npm run seed          # Seed all data
 *   npm run seed:users    # Seed only users
 *   npm run seed:clean    # Clean all data
 */

import { drizzle } from "drizzle-orm/d1";
import { migrate } from "drizzle-orm/d1/migrator";
import { eq, and, inArray } from "drizzle-orm";
import * as schema from "../src/schema/index.js";
import { nanoid } from "nanoid";

// Type definitions
type SeedConfig = {
  users: number;
  projectsPerUser: number;
  testCasesPerProject: number;
  recordingSessionsPerProject: number;
  testRunsPerTestCase: number;
  teams: number;
  integrationsPerUser: number;
};

type SeedContext = {
  db: ReturnType<typeof drizzle>;
  config: SeedConfig;
  createdIds: {
    users: string[];
    projects: string[];
    testCases: string[];
    testSuites: string[];
    recordingSessions: string[];
    teams: string[];
  };
};

// Default seed configuration
const DEFAULT_CONFIG: SeedConfig = {
  users: 10,
  projectsPerUser: 3,
  testCasesPerProject: 8,
  recordingSessionsPerProject: 5,
  testRunsPerTestCase: 5,
  teams: 3,
  integrationsPerUser: 2,
};

// Utility functions
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

function randomTimestamp(start: Date, end: Date): number {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  ).getTime();
}

function randomEmail(
  firstName: string,
  lastName: string,
  domain: string = "qestro.dev",
): string {
  const randomNum = Math.floor(Math.random() * 999);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomNum}@${domain}`;
}

function generateId(): string {
  return nanoid();
}

// Data templates
const FIRST_NAMES = [
  "Alex",
  "Sam",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Avery",
  "Quinn",
  "Sage",
  "River",
  "Skyler",
  "Dakota",
  "Phoenix",
  "Rowan",
  "Blake",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
];

const COMPANY_NAMES = [
  "TechCorp Solutions",
  "Digital Innovations Ltd",
  "Cloud Systems Inc",
  "AppDev Masters",
  "TestPro Enterprises",
  "QA Wizards",
  "MobileFirst Tech",
  "WebDev Solutions",
  "Agile Testing Co",
  "DevOps Masters",
  "StartupHub",
];

const PROJECT_NAMES = [
  "E-commerce Mobile App",
  "Banking Web Portal",
  "Social Media Platform",
  "Healthcare Management System",
  "Educational Platform",
  "Food Delivery App",
  "Travel Booking Website",
  "Fitness Tracking App",
  "News Portal",
  "Project Management Tool",
  "CRM System",
  "HR Management Platform",
];

const PROJECT_DESCRIPTIONS = [
  "End-to-end testing for critical user flows",
  "Automated regression testing suite",
  "Performance and load testing scenarios",
  "Cross-platform compatibility testing",
  "Security and vulnerability testing",
  "User acceptance testing scenarios",
  "Integration testing with third-party services",
  "Accessibility testing compliance",
];

const TEST_CASE_NAMES = [
  "User Registration Flow",
  "Login Authentication",
  "Password Reset",
  "Search Functionality",
  "Filter and Sort",
  "Add to Cart",
  "Checkout Process",
  "Payment Processing",
  "Profile Management",
  "Settings Configuration",
  "File Upload",
  "Data Export",
  "Report Generation",
  "Notification System",
  "Dashboard Navigation",
  "Form Validation",
  "API Integration",
];

const TEST_PLATFORMS = {
  mobile: ["iOS 15.4", "iOS 16.0", "Android 12", "Android 13"],
  web: ["Chrome 108", "Firefox 107", "Safari 16", "Edge 108"],
};

const INTEGRATION_TYPES = [
  "slack",
  "teams",
  "discord",
  "email",
  "webhook",
  "github",
  "jira",
];

// Password hashing utility (simplified for seed data)
async function hashPassword(password: string): Promise<string> {
  // In a real implementation, use bcrypt or argon2
  // For seed data, we'll use a simple hash
  return `hashed_${password}_${Date.now()}`;
}

// User creation functions
async function createAdminUser(ctx: SeedContext): Promise<string> {
  const userId = generateId();
  const hashedPassword = await hashPassword("admin123");

  const user = {
    id: userId,
    email: "admin@qestro.dev",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    role: "admin",
    subscription: "enterprise",
    isEmailVerified: 1,
    lastLoginAt: randomTimestamp(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date(),
    ),
    createdAt: randomTimestamp(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(),
    ),
    updatedAt: new Date().getTime(),
  };

  await ctx.db.insert(schema.users).values(user);
  ctx.createdIds.users.push(userId);

  console.log(`✓ Created admin user: ${user.email}`);
  return userId;
}

async function createRegularUsers(ctx: SeedContext): Promise<string[]> {
  const userIds: string[] = [];

  // Create users with different roles and subscriptions
  const userTypes = [
    {
      role: "user",
      subscription: "free",
      count: Math.floor(ctx.config.users * 0.4),
    },
    {
      role: "user",
      subscription: "pro",
      count: Math.floor(ctx.config.users * 0.4),
    },
    {
      role: "user",
      subscription: "enterprise",
      count: Math.floor(ctx.config.users * 0.15),
    },
    {
      role: "admin",
      subscription: "pro",
      count: Math.floor(ctx.config.users * 0.05),
    },
  ];

  for (const userType of userTypes) {
    for (let i = 0; i < userType.count; i++) {
      const userId = generateId();
      const firstName = randomChoice(FIRST_NAMES);
      const lastName = randomChoice(LAST_NAMES);
      const email = randomEmail(firstName, lastName);
      const hashedPassword = await hashPassword("password123");

      const user = {
        id: userId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        role: userType.role,
        subscription: userType.subscription,
        isEmailVerified: randomBoolean(0.8) ? 1 : 0,
        lastLoginAt: randomBoolean(0.7)
          ? randomTimestamp(
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              new Date(),
            )
          : null,
        createdAt: randomTimestamp(
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          new Date(),
        ),
        updatedAt: new Date().getTime(),
      };

      await ctx.db.insert(schema.users).values(user);
      userIds.push(userId);
      ctx.createdIds.users.push(userId);

      console.log(
        `✓ Created user: ${email} (${userType.role}, ${userType.subscription})`,
      );
    }
  }

  return userIds;
}

// Project creation functions
async function createProjects(
  ctx: SeedContext,
  userIds: string[],
): Promise<string[]> {
  const projectIds: string[] = [];

  for (const userId of userIds) {
    for (let i = 0; i < ctx.config.projectsPerUser; i++) {
      const projectId = generateId();
      const projectType = randomChoice(["mobile", "web", "hybrid"]);
      const platform =
        projectType === "mobile"
          ? randomChoice(["ios", "android"])
          : projectType === "web"
            ? randomChoice(["chrome", "firefox", "safari", "edge"])
            : randomChoice(["ios", "android", "chrome"]);

      const project = {
        id: projectId,
        userId,
        name: randomChoice(PROJECT_NAMES),
        description: randomChoice(PROJECT_DESCRIPTIONS),
        type: projectType,
        platform,
        settings: JSON.stringify({
          theme: "light",
          language: "en",
          notifications: true,
          autoSave: true,
          timeout: 30000,
          retries: 3,
        }),
        isActive: randomBoolean(0.9) ? 1 : 0,
        createdAt: randomTimestamp(
          new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          new Date(),
        ),
        updatedAt: new Date().getTime(),
      };

      await ctx.db.insert(schema.projects).values(project);
      projectIds.push(projectId);
      ctx.createdIds.projects.push(projectId);

      console.log(`✓ Created project: ${project.name} (${projectType})`);
    }
  }

  return projectIds;
}

// Test suite creation functions
async function createTestSuites(
  ctx: SeedContext,
  projectIds: string[],
): Promise<string[]> {
  const suiteIds: string[] = [];

  for (const projectId of projectIds) {
    // Create 2-3 test suites per project
    const numSuites = randomNumber(2, 3);

    for (let i = 0; i < numSuites; i++) {
      const suiteId = generateId();
      const project = await ctx.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)
        .then((rows) => rows[0]);

      const suiteType = project?.type || "web";

      const suite = {
        id: suiteId,
        projectId,
        userId: project?.userId || ctx.createdIds.users[0],
        name: `${suiteType === "mobile" ? "Mobile" : suiteType === "web" ? "Web" : "Hybrid"} Test Suite ${i + 1}`,
        description: `Comprehensive test suite for ${suiteType} application testing`,
        type: suiteType,
        testCases: JSON.stringify([]), // Will be populated when test cases are created
        settings: JSON.stringify({
          parallel: true,
          maxRetries: 2,
          timeout: 60000,
          screenshots: true,
          videos: randomBoolean(0.6),
        }),
        schedule: randomBoolean(0.3)
          ? JSON.stringify({
              enabled: true,
              cron: `0 ${randomNumber(0, 23)} * * ${randomNumber(1, 5)}`, // Random schedule
              timezone: "UTC",
            })
          : null,
        isActive: randomBoolean(0.8) ? 1 : 0,
        lastRunAt: randomBoolean(0.5)
          ? randomTimestamp(
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              new Date(),
            )
          : null,
        createdAt: randomTimestamp(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(),
        ),
        updatedAt: new Date().getTime(),
      };

      await ctx.db.insert(schema.testSuites).values(suite);
      suiteIds.push(suiteId);
      ctx.createdIds.testSuites.push(suiteId);

      console.log(`✓ Created test suite: ${suite.name}`);
    }
  }

  return suiteIds;
}

// Test case creation functions
async function createTestCases(
  ctx: SeedContext,
  projectIds: string[],
): Promise<string[]> {
  const testCaseIds: string[] = [];

  for (const projectId of projectIds) {
    // Get project details
    const project = await ctx.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!project) continue;

    // Create test cases for each project
    for (let i = 0; i < ctx.config.testCasesPerProject; i++) {
      const testCaseId = generateId();
      const testCaseName = randomChoice(TEST_CASE_NAMES);

      // Generate test data based on platform
      let testData;
      if (project.type === "mobile") {
        testData = {
          platform: "maestro",
          version: "1.0",
          flows: [
            {
              name: testCaseName,
              steps: generateMaestroSteps(project.platform || "ios"),
            },
          ],
        };
      } else {
        testData = {
          platform: "playwright",
          version: "1.0",
          tests: [
            {
              name: testCaseName,
              steps: generatePlaywrightSteps(),
            },
          ],
        };
      }

      const testCase = {
        id: testCaseId,
        projectId,
        sessionId: null, // Will be linked if created from recording
        userId: project.userId,
        name: testCaseName,
        description: `Automated test case for ${testCaseName}`,
        type: project.type,
        platform: project.platform,
        testData: JSON.stringify(testData),
        expectedResults: JSON.stringify([
          "Action completes successfully",
          "No error messages displayed",
          "Expected UI elements are present",
        ]),
        tags: JSON.stringify(
          randomChoices(
            ["smoke", "regression", "critical", "sanity", "e2e"],
            2,
          ),
        ),
        isActive: randomBoolean(0.95) ? 1 : 0,
        createdAt: randomTimestamp(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          new Date(),
        ),
        updatedAt: new Date().getTime(),
      };

      await ctx.db.insert(schema.testCases).values(testCase);
      testCaseIds.push(testCaseId);
      ctx.createdIds.testCases.push(testCaseId);

      console.log(`✓ Created test case: ${testCase.name}`);
    }
  }

  return testCaseIds;
}

// Helper functions to generate test steps
function generateMaestroSteps(platform: string): any[] {
  const steps = [];
  const numSteps = randomNumber(3, 8);

  for (let i = 0; i < numSteps; i++) {
    const stepTypes = [
      "tapOn",
      "inputText",
      "swipe",
      "assertVisible",
      "launchApp",
    ];
    const stepType = randomChoice(stepTypes);

    let step;
    switch (stepType) {
      case "tapOn":
        step = {
          type: "tapOn",
          value: randomChoice([
            "Login",
            "Submit",
            "Continue",
            "Next",
            "OK",
            "Cancel",
          ]),
        };
        break;
      case "inputText":
        step = {
          type: "inputText",
          value: "test@example.com",
          selector: randomChoice([
            "#email",
            "#username",
            'input[type="email"]',
          ]),
        };
        break;
      case "swipe":
        step = {
          type: "swipe",
          direction: randomChoice(["up", "down", "left", "right"]),
          duration: 500,
        };
        break;
      case "assertVisible":
        step = {
          type: "assertVisible",
          value: randomChoice(["Welcome", "Dashboard", "Success", "Profile"]),
        };
        break;
      case "launchApp":
        step = {
          type: "launchApp",
          appId: randomChoice(["com.example.app", "com.test.app"]),
        };
        break;
    }

    steps.push(step);
  }

  return steps;
}

function generatePlaywrightSteps(): any[] {
  const steps = [];
  const numSteps = randomNumber(3, 8);

  for (let i = 0; i < numSteps; i++) {
    const stepTypes = [
      "goto",
      "click",
      "fill",
      "type",
      "waitForSelector",
      "expect",
    ];
    const stepType = randomChoice(stepTypes);

    let step;
    switch (stepType) {
      case "goto":
        step = {
          type: "goto",
          url: randomChoice(["/login", "/dashboard", "/profile", "/settings"]),
        };
        break;
      case "click":
        step = {
          type: "click",
          selector: randomChoice([
            "#login",
            'button[type="submit"]',
            ".nav-item",
          ]),
        };
        break;
      case "fill":
        step = {
          type: "fill",
          selector: randomChoice(["#email", "#password", "#username"]),
          value: randomChoice(["test@example.com", "password123", "testuser"]),
        };
        break;
      case "type":
        step = {
          type: "type",
          selector: randomChoice(["#search", 'input[type="text"]']),
          value: "search query",
        };
        break;
      case "waitForSelector":
        step = {
          type: "waitForSelector",
          selector: randomChoice([".loading", ".success", "#result"]),
        };
        break;
      case "expect":
        step = {
          type: "expect",
          selector: randomChoice(["h1", ".title", ".message"]),
          text: randomChoice(["Welcome", "Success", "Error", "Complete"]),
        };
        break;
    }

    steps.push(step);
  }

  return steps;
}

// Recording actions creation
async function createRecordedActions(ctx: SeedContext, sessionIds: string[]) {
  for (const sessionId of sessionIds) {
    const session = await ctx.db
      .select()
      .from(schema.recordingSessions)
      .where(eq(schema.recordingSessions.id, sessionId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!session) continue;

    const numActions = session.actionsCount || randomNumber(5, 20);
    const startTime = session.startTime || Date.now();

    for (let i = 0; i < numActions; i++) {
      const actionId = generateId();
      const actionType = randomChoice([
        "tap",
        "type",
        "swipe",
        "scroll",
        "assert",
        "wait",
        "screenshot",
        "navigate",
      ]);
      const timestamp = startTime + i * 2000; // 2 seconds between actions

      const action = {
        id: actionId,
        sessionId,
        sequenceNumber: i + 1,
        type: actionType,
        timestamp,
        coordinates:
          actionType === "tap" || actionType === "swipe"
            ? JSON.stringify({
                x: randomNumber(50, 350),
                y: randomNumber(100, 600),
              })
            : null,
        text:
          actionType === "type"
            ? randomChoice(["test@example.com", "password123", "Hello World"])
            : null,
        element:
          actionType === "tap" || actionType === "type"
            ? randomChoice([
                "#email",
                "#password",
                ".btn-primary",
                'button[type="submit"]',
              ])
            : null,
        selector: randomChoice([
          "#login",
          ".submit-btn",
          '[data-testid="submit"]',
        ]),
        screenshot:
          actionType === "screenshot"
            ? `screenshots/${generateId()}.png`
            : null,
        metadata: JSON.stringify({
          duration: randomNumber(100, 2000),
          confidence: randomNumber(0.8, 1.0),
          deviceOrientation: randomChoice(["portrait", "landscape"]),
        }),
        createdAt: timestamp,
      };

      await ctx.db.insert(schema.recordedActions).values(action);
    }
  }

  console.log(`✓ Created recorded actions for ${sessionIds.length} sessions`);
}

// Link test cases to test suites
async function linkTestCasesToSuites(ctx: SeedContext) {
  const testSuites = await ctx.db.select().from(schema.testSuites);

  for (const suite of testSuites) {
    // Get test cases for the same project
    const testCases = await ctx.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.projectId, suite.projectId));

    if (testCases.length === 0) continue;

    // Assign 2-5 test cases to each suite
    const numCases = Math.min(randomNumber(2, 5), testCases.length);
    const selectedCases = testCases
      .sort(() => 0.5 - Math.random())
      .slice(0, numCases)
      .map((tc) => tc.id);

    // Update the test suite with test case IDs
    await ctx.db
      .update(schema.testSuites)
      .set({ testCases: JSON.stringify(selectedCases) })
      .where(eq(schema.testSuites.id, suite.id));
  }

  console.log(`✓ Linked test cases to ${testSuites.length} test suites`);
}

// Recording sessions creation
async function createRecordingSessions(
  ctx: SeedContext,
  projectIds: string[],
): Promise<string[]> {
  const sessionIds: string[] = [];

  for (const projectId of projectIds.slice(
    0,
    Math.ceil(projectIds.length * 0.6),
  )) {
    // 60% of projects
    const project = await ctx.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!project) continue;

    const numSessions = randomNumber(1, ctx.config.recordingSessionsPerProject);

    for (let i = 0; i < numSessions; i++) {
      const sessionId = generateId();
      const startTime = randomTimestamp(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
      );
      const duration = randomNumber(30, 300) * 1000; // 30 seconds to 5 minutes

      const session = {
        id: sessionId,
        projectId,
        userId: project.userId,
        name: `Recording Session ${i + 1}`,
        type: project.type,
        platform: project.platform,
        status: randomChoice([
          "completed",
          "completed",
          "completed",
          "error",
          "processing",
        ]),
        startTime,
        endTime: startTime + duration,
        duration: Math.floor(duration / 1000),
        actionsCount: randomNumber(5, 25),
        metadata: JSON.stringify({
          device:
            project.type === "mobile"
              ? randomChoice(["iPhone 13", "Samsung Galaxy S22"])
              : "Desktop",
          resolution:
            project.type === "mobile"
              ? randomChoice(["390x844", "428x926", "1080x2400"])
              : randomChoice(["1920x1080", "1366x768", "1440x900"]),
          browser:
            project.type === "web"
              ? randomChoice(["Chrome", "Firefox", "Safari"])
              : null,
        }),
        artifacts: JSON.stringify({
          screenshots: randomNumber(0, 10),
          videos: randomBoolean(0.5) ? 1 : 0,
          logs: 1,
        }),
        exportFormats: JSON.stringify(
          randomChoices(["maestro", "playwright", "json"], 2),
        ),
        createdAt: startTime,
        updatedAt: new Date().getTime(),
      };

      await ctx.db.insert(schema.recordingSessions).values(session);
      sessionIds.push(sessionId);
      ctx.createdIds.recordingSessions.push(sessionId);

      console.log(`✓ Created recording session: ${session.name}`);
    }
  }

  return sessionIds;
}

// Main seeding function
async function seedDatabase(config: SeedConfig = DEFAULT_CONFIG) {
  console.log("🌱 Starting database seeding...\n");

  // Initialize database connection
  const d1Database = globalThis.D1_DATABASE;
  if (!d1Database) {
    throw new Error(
      "D1_DATABASE not found. Make sure you're running this with wrangler.",
    );
  }

  const db = drizzle(d1Database, { schema });

  const ctx: SeedContext = {
    db,
    config,
    createdIds: {
      users: [],
      projects: [],
      testCases: [],
      testSuites: [],
      recordingSessions: [],
      teams: [],
    },
  };

  try {
    // Clean existing data (in reverse order of dependencies)
    console.log("🧹 Cleaning existing data...");
    await cleanDatabase(ctx);

    // Create data in dependency order
    console.log("\n👥 Creating users...");
    await createAdminUser(ctx);
    await createRegularUsers(ctx);

    console.log("\n📁 Creating projects...");
    await createProjects(ctx, ctx.createdIds.users);

    console.log("\n📋 Creating test suites...");
    await createTestSuites(ctx, ctx.createdIds.projects);

    console.log("\n🧪 Creating test cases...");
    await createTestCases(ctx, ctx.createdIds.projects);

    console.log("\n📹 Creating recording sessions...");
    await createRecordingSessions(ctx, ctx.createdIds.projects);

    console.log("\n🎬 Creating recorded actions...");
    await createRecordedActions(ctx, ctx.createdIds.recordingSessions);

    console.log("\n🔗 Linking test cases to test suites...");
    await linkTestCasesToSuites(ctx);

    console.log("\n✅ Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Users: ${ctx.createdIds.users.length}`);
    console.log(`   Projects: ${ctx.createdIds.projects.length}`);
    console.log(`   Test Suites: ${ctx.createdIds.testSuites.length}`);
    console.log(`   Test Cases: ${ctx.createdIds.testCases.length}`);
    console.log(
      `   Recording Sessions: ${ctx.createdIds.recordingSessions.length}`,
    );
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Clean database function
async function cleanDatabase(ctx: SeedContext) {
  // Note: Delete in reverse order of foreign key dependencies
  const tables = [
    { name: "recorded_actions", table: schema.recordedActions },
    { name: "recording_sessions", table: schema.recordingSessions },
    { name: "test_runs", table: schema.testRuns },
    { name: "test_cases", table: schema.testCases },
    { name: "test_suites", table: schema.testSuites },
    { name: "integrations", table: schema.integrations },
    { name: "api_keys", table: schema.apiKeys },
    { name: "projects", table: schema.projects },
    { name: "users", table: schema.users },
  ];

  for (const { name, table } of tables) {
    try {
      await ctx.db.delete(table);
      console.log(`  ✓ Cleared ${name}`);
    } catch (error) {
      console.log(`  ⚠ Could not clear ${name}: ${error.message}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "clean":
        const cleanCtx: SeedContext = {
          db: drizzle(globalThis.D1_DATABASE, { schema }),
          config: DEFAULT_CONFIG,
          createdIds: {
            users: [],
            projects: [],
            testCases: [],
            testSuites: [],
            recordingSessions: [],
            teams: [],
          },
        };
        await cleanDatabase(cleanCtx);
        console.log("\n✅ Database cleaned successfully!");
        break;

      case "users":
        await seedDatabase({
          ...DEFAULT_CONFIG,
          users: parseInt(args[1]) || DEFAULT_CONFIG.users,
        });
        break;

      default:
        await seedDatabase(DEFAULT_CONFIG);
    }
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Export for use in tests
export {
  seedDatabase,
  cleanDatabase,
  DEFAULT_CONFIG,
  type SeedConfig,
  type SeedContext,
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
