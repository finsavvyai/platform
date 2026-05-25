// Test Template for End-to-End Tests (TypeScript + Playwright)
// Location: SDLC/tests/e2e/

import { test, expect, Page } from '@playwright/test';

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:8080';

// Test users
const ADMIN_USER = {
  email: 'admin@test.com',
  password: 'Test123!@#',
};

const REGULAR_USER = {
  email: 'user@test.com',
  password: 'Test123!@#',
};

// ============================================
// E2E TEST - User Authentication Flow
// ============================================

test.describe('User Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('User can sign up with email', async ({ page }) => {
    // Navigate to signup
    await page.click('text=Sign Up');

    // Fill signup form
    await page.fill('[name="email"]', 'newuser@test.com');
    await page.fill('[name="password"]', 'Test123!@#');
    await page.fill('[name="confirmPassword"]', 'Test123!@#');
    await page.fill('[name="name"]', 'New User');

    // Submit
    await page.click('button[type="submit"]');

    // Assert: Verification message shown
    await expect(page.locator('text=Check your email')).toBeVisible();
  });

  test('User receives verification email', async ({ page, request }) => {
    // Sign up
    await page.click('text=Sign Up');
    await page.fill('[name="email"]', 'verify@test.com');
    await page.fill('[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');

    // Check email API (mock or real)
    const response = await request.get(`${API_URL}/test/emails/latest`);
    const email = await response.json();

    expect(email.to).toBe('verify@test.com');
    expect(email.subject).toContain('Verify');
    expect(email.body).toContain('verification-token');
  });

  test('User can verify email and activate account', async ({ page }) => {
    // Navigate to verification link (simulated)
    const verificationToken = 'test-token-123';
    await page.goto(`${BASE_URL}/verify/${verificationToken}`);

    // Assert: Success message
    await expect(page.locator('text=Email verified')).toBeVisible();

    // Assert: Redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('User can login with credentials', async ({ page }) => {
    // Navigate to login
    await page.click('text=Login');

    // Fill login form
    await page.fill('[name="email"]', REGULAR_USER.email);
    await page.fill('[name="password"]', REGULAR_USER.password);

    // Submit
    await page.click('button[type="submit"]');

    // Assert: Redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('User can access protected resources', async ({ page }) => {
    // Login first
    await loginAsUser(page, REGULAR_USER);

    // Navigate to protected route
    await page.goto(`${BASE_URL}/documents`);

    // Assert: Can access
    await expect(page.locator('h1')).toContainText('Documents');
  });

  test('User cannot access without authentication', async ({ page }) => {
    // Try to access protected route
    await page.goto(`${BASE_URL}/documents`);

    // Assert: Redirected to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('text=Please log in')).toBeVisible();
  });

  test('User session expires after timeout', async ({ page, context }) => {
    // Login
    await loginAsUser(page, REGULAR_USER);

    // Mock session expiration by clearing cookies
    await context.clearCookies();

    // Try to access protected route
    await page.goto(`${BASE_URL}/documents`);

    // Assert: Redirected to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('User can refresh token', async ({ page, request }) => {
    // Login and get refresh token
    await loginAsUser(page, REGULAR_USER);

    // Wait for token to expire (or mock expiration)
    await page.evaluate(() => {
      localStorage.setItem('tokenExpiry', String(Date.now() - 1000));
    });

    // Make API request (should trigger refresh)
    await page.goto(`${BASE_URL}/api/documents`);

    // Assert: Request succeeded (token was refreshed)
    const response = await page.waitForResponse(r => r.url().includes('/api/documents'));
    expect(response.status()).toBe(200);
  });
});

// ============================================
// E2E TEST - Document Processing Flow
// ============================================

test.describe('Document Processing Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await loginAsUser(page, REGULAR_USER);
  });

  test('Upload document successfully', async ({ page }) => {
    // Navigate to upload
    await page.goto(`${BASE_URL}/documents/upload`);

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('test-data/sample.pdf');

    // Add metadata
    await page.fill('[name="title"]', 'Test Document');
    await page.fill('[name="description"]', 'This is a test');

    // Submit
    await page.click('button:text("Upload")');

    // Assert: Success message
    await expect(page.locator('text=Upload successful')).toBeVisible();
  });

  test('Document is processed and chunked', async ({ page, request }) => {
    // Upload document
    const uploadResponse = await request.post(`${API_URL}/api/documents`, {
      multipart: {
        file: {
          name: 'sample.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF content'),
        },
      },
    });

    const { documentId } = await uploadResponse.json();

    // Wait for processing
    await page.waitForTimeout(5000);

    // Check processing status
    const statusResponse = await request.get(
      `${API_URL}/api/documents/${documentId}/status`
    );
    const status = await statusResponse.json();

    expect(status.processed).toBe(true);
    expect(status.chunks).toBeGreaterThan(0);
  });

  test('Embeddings are generated', async ({ page, request }) => {
    // Upload and process document
    const uploadResponse = await request.post(`${API_URL}/api/documents`, {
      multipart: { file: { name: 'sample.pdf', buffer: Buffer.from('PDF content') } },
    });
    const { documentId } = await uploadResponse.json();

    // Wait for embeddings
    await page.waitForTimeout(10000);

    // Check embeddings
    const embeddingsResponse = await request.get(
      `${API_URL}/api/documents/${documentId}/embeddings`
    );
    const embeddings = await embeddingsResponse.json();

    expect(embeddings.length).toBeGreaterThan(0);
    expect(embeddings[0].vector.length).toBe(1536); // OpenAI dimension
  });

  test('Document is searchable via RAG', async ({ page }) => {
    // Upload and wait for processing
    await uploadTestDocument(page, 'Machine learning basics');

    // Navigate to search
    await page.goto(`${BASE_URL}/search`);

    // Search for content
    await page.fill('[name="query"]', 'What is machine learning?');
    await page.click('button:text("Search")');

    // Assert: Results shown
    await expect(page.locator('.search-result')).toBeVisible();
    await expect(page.locator('.search-result')).toContainText('Machine learning');
  });

  test('Query returns relevant results', async ({ page }) => {
    // Upload multiple documents
    await uploadTestDocument(page, 'Machine learning is a subset of AI');
    await uploadTestDocument(page, 'Deep learning uses neural networks');
    await uploadTestDocument(page, 'Python is a programming language');

    // Search
    await page.goto(`${BASE_URL}/search`);
    await page.fill('[name="query"]', 'Tell me about neural networks');
    await page.click('button:text("Search")');

    // Assert: Relevant doc appears first
    const firstResult = page.locator('.search-result').first();
    await expect(firstResult).toContainText('Deep learning');
  });

  test('Citations include correct sources', async ({ page }) => {
    // Upload document
    await uploadTestDocument(page, 'Quantum computing uses qubits');

    // Query
    await page.goto(`${BASE_URL}/search`);
    await page.fill('[name="query"]', 'What are qubits?');
    await page.click('button:text("Search")');

    // Assert: Citations shown
    await expect(page.locator('.citation')).toBeVisible();
    await expect(page.locator('.citation')).toContainText('Quantum computing');

    // Click citation
    await page.click('.citation');

    // Assert: Document opened
    await expect(page.locator('.document-viewer')).toBeVisible();
  });
});

// ============================================
// E2E TEST - RAG Query Flow
// ============================================

test.describe('RAG Query Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await loginAsUser(page, REGULAR_USER);

    // Upload test documents
    await uploadTestDocument(page, 'AI is transforming technology');
    await uploadTestDocument(page, 'Machine learning enables predictions');
  });

  test('User asks question and gets response with citations', async ({ page }) => {
    // Navigate to RAG interface
    await page.goto(`${BASE_URL}/rag`);

    // Ask question
    await page.fill('[name="question"]', 'What is AI?');
    await page.click('button:text("Ask")');

    // Wait for response
    await page.waitForSelector('.rag-response');

    // Assert: Response shown
    const response = page.locator('.rag-response');
    await expect(response).toContainText('AI');

    // Assert: Citations present
    const citations = page.locator('.citation');
    await expect(citations).toHaveCount({ gte: 1 });
  });

  test('Complex query with multi-step reasoning', async ({ page }) => {
    await page.goto(`${BASE_URL}/rag`);

    // Ask complex question
    await page.fill(
      '[name="question"]',
      'Compare machine learning and deep learning, then explain which is better for image recognition'
    );
    await page.click('button:text("Ask")');

    // Wait for response
    await page.waitForSelector('.rag-response', { timeout: 30000 });

    // Assert: Comprehensive response
    const response = page.locator('.rag-response');
    await expect(response).toContainText('machine learning');
    await expect(response).toContainText('deep learning');
    await expect(response).toContainText('image recognition');
  });

  test('Streaming response displays progressively', async ({ page }) => {
    await page.goto(`${BASE_URL}/rag`);

    await page.fill('[name="question"]', 'Explain AI in detail');
    await page.click('button:text("Ask")');

    // Assert: Response appears gradually
    let previousLength = 0;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const currentText = await page.locator('.rag-response').textContent();
      const currentLength = currentText?.length || 0;

      expect(currentLength).toBeGreaterThanOrEqual(previousLength);
      previousLength = currentLength;
    }
  });

  test('User can provide feedback', async ({ page }) => {
    await page.goto(`${BASE_URL}/rag`);

    // Get response
    await page.fill('[name="question"]', 'What is AI?');
    await page.click('button:text("Ask")');
    await page.waitForSelector('.rag-response');

    // Provide feedback
    await page.click('button[aria-label="Thumbs up"]');

    // Assert: Feedback recorded
    await expect(page.locator('text=Thank you for your feedback')).toBeVisible();
  });

  test('User can view source documents', async ({ page }) => {
    await page.goto(`${BASE_URL}/rag`);

    await page.fill('[name="question"]', 'What is AI?');
    await page.click('button:text("Ask")');
    await page.waitForSelector('.citation');

    // Click to view source
    await page.click('.citation .view-source');

    // Assert: Document viewer opens
    await expect(page.locator('.document-viewer')).toBeVisible();
    await expect(page.locator('.document-content')).toBeVisible();
  });
});

// ============================================
// E2E TEST - Admin Management
// ============================================

test.describe('Admin Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await loginAsUser(page, ADMIN_USER);
  });

  test('Admin can create user', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);

    // Click create user
    await page.click('button:text("Create User")');

    // Fill form
    await page.fill('[name="email"]', 'newadmin@test.com');
    await page.fill('[name="name"]', 'New Admin');
    await page.selectOption('[name="role"]', 'admin');

    // Submit
    await page.click('button:text("Create")');

    // Assert: User created
    await expect(page.locator('text=User created successfully')).toBeVisible();
    await expect(page.locator('text=newadmin@test.com')).toBeVisible();
  });

  test('Admin can assign roles', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);

    // Find user and edit
    await page.click(`tr:has-text("${REGULAR_USER.email}") button:text("Edit")`);

    // Change role
    await page.selectOption('[name="role"]', 'moderator');
    await page.click('button:text("Save")');

    // Assert: Role updated
    await expect(page.locator('text=Role updated')).toBeVisible();
  });

  test('Admin can view audit logs', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/audit`);

    // Assert: Logs displayed
    await expect(page.locator('.audit-log-entry')).toHaveCount({ gte: 1 });

    // Filter logs
    await page.selectOption('[name="action"]', 'login');
    await page.click('button:text("Filter")');

    // Assert: Filtered results
    const entries = page.locator('.audit-log-entry');
    await expect(entries.first()).toContainText('login');
  });

  test('Admin can suspend user', async ({ page, context }) => {
    await page.goto(`${BASE_URL}/admin/users`);

    // Suspend user
    await page.click(`tr:has-text("${REGULAR_USER.email}") button:text("Suspend")`);
    await page.click('button:text("Confirm")');

    // Assert: User suspended
    await expect(page.locator('text=User suspended')).toBeVisible();

    // Open new tab and try to login as suspended user
    const newPage = await context.newPage();
    await newPage.goto(BASE_URL);

    await newPage.fill('[name="email"]', REGULAR_USER.email);
    await newPage.fill('[name="password"]', REGULAR_USER.password);
    await newPage.click('button[type="submit"]');

    // Assert: Login blocked
    await expect(newPage.locator('text=Account suspended')).toBeVisible();
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function loginAsUser(page: Page, user: { email: string; password: string }) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[name="email"]', user.email);
  await page.fill('[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

async function uploadTestDocument(page: Page, content: string) {
  await page.goto(`${BASE_URL}/documents/upload`);

  // Create test file
  const buffer = Buffer.from(content);
  await page.setInputFiles('input[type="file"]', {
    name: 'test.txt',
    mimeType: 'text/plain',
    buffer,
  });

  await page.fill('[name="title"]', 'Test Doc');
  await page.click('button:text("Upload")');
  await page.waitForSelector('text=Upload successful');

  // Wait for processing
  await page.waitForTimeout(5000);
}

// Run tests with:
// npx playwright test
// npx playwright test --headed  (with browser visible)
// npx playwright test --debug  (with debugger)
// npx playwright test --project=chromium  (specific browser)
