/**
 * Global Teardown - Runs once after all tests
 */

export default async function globalTeardown() {
    console.log('\n✅ Test suite completed.\n');

    // Clean up any global resources
    await new Promise((resolve) => setTimeout(resolve, 100));
}
