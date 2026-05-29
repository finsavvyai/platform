import { test, expect } from '@playwright/test';

test.describe.skip('Offline Sync Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Mock offline state
    await page.context().setOffline(true);

    // Wait for offline indicator to appear
    await page.waitForSelector('[data-testid="offline-indicator"]', { timeout: 5000 });
  });

  test('displays offline status correctly', async ({ page }) => {
    // Check offline indicator is visible
    const offlineIndicator = page.getByTestId('offline-indicator');
    await expect(offlineIndicator).toBeVisible();

    // Check offline status text
    await expect(page.getByText('Offline Mode')).toBeVisible();
    await expect(page.getByText(/pending operations/)).toBeVisible();
  });

  test('creates connection while offline', async ({ page }) => {
    // Navigate to connections section
    await page.getByRole('button', { name: 'Add Connection' }).click();

    // Fill connection form
    await page.getByLabel('Connection Name').fill('Test Connection');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');

    // Save connection (should be queued for sync)
    await page.getByRole('button', { name: 'Save Connection' }).click();

    // Check for success message
    await expect(page.getByText(/Connection saved locally/)).toBeVisible();

    // Check that pending operations count increased
    const pendingText = await page.getByText(/(\d+) pending/).textContent();
    const pendingCount = parseInt(pendingText?.match(/\d+/)?.[0] || '0');
    expect(pendingCount).toBeGreaterThan(0);
  });

  test('executes query while offline', async ({ page }) => {
    // First ensure we have a connection (create it if needed)
    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByLabel('Connection Name').fill('Offline Test DB');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Save Connection' }).click();
    await page.waitForTimeout(1000);

    // Navigate to query editor
    await page.getByRole('tab', { name: 'Query Editor' }).click();

    // Enter a query
    await page.locator('.query-editor').fill('SELECT * FROM users LIMIT 10');

    // Execute query
    await page.getByRole('button', { name: 'Execute Query' }).click();

    // Should show offline execution message
    await expect(page.getByText(/Query queued for offline execution/)).toBeVisible();

    // Check that pending operations increased
    const pendingText = await page.getByText(/(\d+) pending/).textContent();
    const pendingCount = parseInt(pendingText?.match(/\d+/)?.[0] || '0');
    expect(pendingCount).toBeGreaterThan(0);
  });

  test('syncs operations when coming back online', async ({ page }) => {
    // First, perform some offline operations
    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByLabel('Connection Name').fill('Sync Test Connection');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Save Connection' }).click();
    await page.waitForTimeout(1000);

    // Verify we have pending operations
    await expect(page.getByText(/(\d+) pending/)).toBeVisible();

    // Mock API responses for sync
    await page.route('/api/connections', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'conn-123',
          name: 'Sync Test Connection',
          type: 'postgresql',
          status: 'connected'
        })
      });
    });

    // Come back online
    await page.context().setOffline(false);

    // Wait for sync to complete
    await expect(page.getByText('Online')).toBeVisible({ timeout: 10000 });

    // Verify sync completed successfully
    await expect(page.getByText(/No pending operations/)).toBeVisible({ timeout: 5000 });

    // Verify the connection was actually created
    await expect(page.getByText('Sync Test Connection')).toBeVisible();
  });

  test('handles sync errors gracefully', async ({ page }) => {
    // Perform offline operation
    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByLabel('Connection Name').fill('Error Test Connection');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Save Connection' }).click();
    await page.waitForTimeout(1000);

    // Mock API error response
    await page.route('/api/connections', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    // Come back online
    await page.context().setOffline(false);

    // Wait for sync to attempt
    await page.waitForTimeout(2000);

    // Should show sync error
    await expect(page.getByText(/Sync failed/)).toBeVisible();

    // Should still show pending operations
    await expect(page.getByText(/(\d+) pending/)).toBeVisible();
  });

  test('manual sync functionality', async ({ page }) => {
    // Perform offline operations
    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByLabel('Connection Name').fill('Manual Sync Test');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Save Connection' }).click();
    await page.waitForTimeout(1000);

    // Mock successful API response
    await page.route('/api/connections', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'conn-456',
          name: 'Manual Sync Test',
          type: 'postgresql',
          status: 'connected'
        })
      });
    });

    // Come back online but don't wait for auto-sync
    await page.context().setOffline(false);

    // Click manual sync button
    await page.getByRole('button', { name: 'Sync Now' }).click();

    // Should show syncing state
    await expect(page.getByText('Syncing...')).toBeVisible();

    // Should complete sync
    await expect(page.getByText('Sync Now')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/No pending operations/)).toBeVisible({ timeout: 5000 });
  });

  test('sync status persistence across page reloads', async ({ page }) => {
    // Perform offline operation
    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByLabel('Connection Name').fill('Persistent Test');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Save Connection' }).click();
    await page.waitForTimeout(1000);

    // Get pending count before reload
    const pendingText = await page.getByText(/(\d+) pending/).textContent();
    const initialCount = parseInt(pendingText?.match(/\d+/)?.[0] || '0');

    // Reload page
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('[data-testid="offline-indicator"]', { timeout: 5000 });

    // Verify pending count persisted
    const newPendingText = await page.getByText(/(\d+) pending/).textContent();
    const newCount = parseInt(newPendingText?.match(/\d+/)?.[0] || '0');
    expect(newCount).toBe(initialCount);
  });

  test('conflict resolution interface', async ({ page }) => {
    // This test would require more complex setup with conflicting data
    // For now, we'll test the basic conflict resolution UI

    // Mock a conflict scenario
    await page.addInitScript(() => {
      // Simulate a conflict in local storage
      const conflicts = [
        {
          id: 'conflict-1',
          entityType: 'connection',
          entityId: 'conn-123',
          localData: { name: 'Local Name' },
          remoteData: { name: 'Remote Name' },
          timestamp: new Date().toISOString(),
          status: 'pending'
        }
      ];
      localStorage.setItem('conflict_history', JSON.stringify(conflicts));
    });

    // Navigate to offline status screen
    await page.getByRole('button', { name: 'Offline Status' }).click();

    // Should show conflict indicator
    await expect(page.getByText(/Data conflicts detected/)).toBeVisible();

    // Click to resolve conflicts
    await page.getByRole('button', { name: 'Resolve Conflicts' }).click();

    // Should show conflict resolution interface
    await expect(page.getByText('Conflict Resolution')).toBeVisible();
    await expect(page.getByText('Local Name')).toBeVisible();
    await expect(page.getByText('Remote Name')).toBeVisible();

    // Test resolution options
    await page.getByRole('button', { name: 'Use Local Version' }).click();
    await expect(page.getByText('Conflict resolved')).toBeVisible();
  });

  test('performance during bulk operations', async ({ page }) => {
    const startTime = Date.now();

    // Create multiple connections offline
    for (let i = 1; i <= 10; i++) {
      await page.getByRole('button', { name: 'Add Connection' }).click();
      await page.getByLabel('Connection Name').fill(`Performance Test ${i}`);
      await page.getByLabel('Database Type').selectOption('postgresql');
      await page.getByLabel('Host').fill('localhost');
      await page.getByLabel('Port').fill('5432');
      await page.getByLabel('Database').fill(`testdb${i}`);
      await page.getByLabel('Username').fill('user');
      await page.getByLabel('Password').fill('password');
      await page.getByRole('button', { name: 'Save Connection' }).click();
      await page.waitForTimeout(100);
    }

    const creationTime = Date.now() - startTime;

    // Should complete bulk operations within reasonable time (5 seconds)
    expect(creationTime).toBeLessThan(5000);

    // Verify all operations are pending
    const pendingText = await page.getByText(/(\d+) pending/).textContent();
    const pendingCount = parseInt(pendingText?.match(/\d+/)?.[0] || '0');
    expect(pendingCount).toBeGreaterThanOrEqual(10);
  });

  test('cleanup of old synced operations', async ({ page }) => {
    // This test would require mocking old operations in storage
    // For now, we'll test the cleanup UI

    // Navigate to offline status screen
    await page.getByRole('button', { name: 'Offline Status' }).click();

    // Look for cleanup options
    await expect(page.getByText('Data Management')).toBeVisible();

    // Should have cleanup option
    await expect(page.getByRole('button', { name: 'Clear Old Data' })).toBeVisible();
  });
});

test.describe.skip('Sync Error Recovery', () => {
  test('recovers from network interruption during sync', async ({ page }) => {
    // Start offline
    await page.context().setOffline(true);

    // Create offline operation
    await page.getByRole('button', { name: 'Add Connection' }).click();
    await page.getByLabel('Connection Name').fill('Recovery Test');
    await page.getByLabel('Database Type').selectOption('postgresql');
    await page.getByLabel('Host').fill('localhost');
    await page.getByLabel('Port').fill('5432');
    await page.getByLabel('Database').fill('testdb');
    await page.getByLabel('Username').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Save Connection' }).click();
    await page.waitForTimeout(1000);

    // Come online
    await page.context().setOffline(false);

    // Intercept the request and make it fail
    await page.route('/api/connections', async route => {
      // Simulate network failure
      await route.abort('failed');
    });

    // Wait for sync to fail
    await page.waitForTimeout(2000);

    // Verify sync failed
    await expect(page.getByText(/Sync failed/)).toBeVisible();

    // Remove the failure and allow success
    await page.unroute('/api/connections');
    await page.route('/api/connections', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'conn-recovery',
          name: 'Recovery Test',
          type: 'postgresql',
          status: 'connected'
        })
      });
    });

    // Retry sync
    await page.getByRole('button', { name: 'Retry Sync' }).click();

    // Should eventually succeed
    await expect(page.getByText(/No pending operations/)).toBeVisible({ timeout: 10000 });
  });
});
