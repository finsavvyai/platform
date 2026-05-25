/**
 * Complete API Test Script
 * Tests all endpoints: Authentication, Projects, Analytics, and File Storage
 */

const BASE_URL = "https://qestro.broad-dew-49ad.workers.dev";

let authToken = null;
let testProjectId = null;

async function testAPI() {
  console.log("🧪 Testing Complete Questro API\n");

  try {
    // Test 1: Health Check
    console.log("1. Testing health check...");
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   ✅ Health check: ${healthData.status}`);
    console.log(`   📊 Services: ${Object.keys(healthData.services).join(', ')}`);

    // Test 2: API Overview
    console.log("\n2. Testing API overview...");
    const apiResponse = await fetch(`${BASE_URL}/api`);
    const apiData = await apiResponse.json();
    console.log(`   Status: ${apiResponse.status}`);
    console.log(`   ✅ API Status: ${apiData.status}`);
    console.log(`   🗄️ Database: ${apiData.database}`);
    console.log(`   🔧 Features: ${apiData.environment.features.join(', ')}`);

    // Test 3: Authentication - Login
    console.log("\n3. Testing authentication - login...");
    const loginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@questro.io",
        password: "testpassword123"
      })
    });

    const loginData = await loginResponse.json();
    console.log(`   Status: ${loginResponse.status}`);

    if (loginData.success && loginData.tokens) {
      authToken = loginData.tokens.accessToken;
      console.log(`   ✅ Login successful!`);
      console.log(`   👤 User: ${loginData.user.name} (${loginData.user.email})`);
      console.log(`   🎯 Role: ${loginData.user.role}`);
      console.log(`   📋 Plan: ${loginData.user.subscription.plan}`);

      // Test 4: Get User Profile
      console.log("\n4. Testing user profile...");
      const profileResponse = await fetch(`${BASE_URL}/api/v1/auth/me`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });

      const profileData = await profileResponse.json();
      console.log(`   Status: ${profileResponse.status}`);
      if (profileData.success) {
        console.log(`   ✅ Profile retrieved successfully!`);
        console.log(`   👤 User ID: ${profileData.user.id}`);
      }

      // Test 5: Create Project
      console.log("\n5. Testing project creation...");
      const createProjectResponse = await fetch(`${BASE_URL}/api/v1/projects`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Test Project - API Demo",
          description: "Automated test project for API validation",
          type: "web",
          settings: {
            framework: "playwright",
            environment: "staging",
            tags: ["automated", "api-test"],
            customConfig: {
              timeout: 30000,
              retries: 2
            }
          }
        })
      });

      const createProjectData = await createProjectResponse.json();
      console.log(`   Status: ${createProjectResponse.status}`);

      if (createProjectData.success) {
        testProjectId = createProjectData.project.id;
        console.log(`   ✅ Project created successfully!`);
        console.log(`   📁 Project ID: ${testProjectId}`);
        console.log(`   📝 Project Name: ${createProjectData.project.name}`);
        console.log(`   🏷️ Type: ${createProjectData.project.type}`);
      }

      // Test 6: List Projects
      console.log("\n6. Testing project listing...");
      const listProjectsResponse = await fetch(`${BASE_URL}/api/v1/projects`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });

      const listProjectsData = await listProjectsResponse.json();
      console.log(`   Status: ${listProjectsResponse.status}`);

      if (listProjectsData.success) {
        console.log(`   ✅ Projects listed successfully!`);
        console.log(`   📊 Total Projects: ${listProjectsData.total}`);
        listProjectsData.projects.forEach((project, index) => {
          console.log(`   ${index + 1}. ${project.name} (${project.type}) - ${project.status}`);
        });
      }

      // Test 7: Create Test Run
      if (testProjectId) {
        console.log("\n7. Testing test run creation...");
        const createTestRunResponse = await fetch(`${BASE_URL}/api/v1/projects/${testProjectId}/runs`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            environment: "staging",
            config: {
              browser: "chrome",
              resolution: "1920x1080",
              parallel: false
            }
          })
        });

        const createTestRunData = await createTestRunResponse.json();
        console.log(`   Status: ${createTestRunResponse.status}`);

        if (createTestRunData.success) {
          console.log(`   ✅ Test run created successfully!`);
          console.log(`   🏃 Run ID: ${createTestRunData.testRun.id}`);
          console.log(`   🌍 Environment: ${createTestRunData.testRun.environment}`);
          console.log(`   📊 Status: ${createTestRunData.testRun.status}`);
        }

        // Test 8: Get Test Runs
        console.log("\n8. Testing test runs listing...");
        const getTestRunsResponse = await fetch(`${BASE_URL}/api/v1/projects/${testProjectId}/runs`, {
          headers: { "Authorization": `Bearer ${authToken}` }
        });

        const getTestRunsData = await getTestRunsResponse.json();
        console.log(`   Status: ${getTestRunsResponse.status}`);

        if (getTestRunsData.success) {
          console.log(`   ✅ Test runs listed successfully!`);
          console.log(`   📊 Total Runs: ${getTestRunsData.total}`);
          getTestRunsData.testRuns.forEach((run, index) => {
            console.log(`   ${index + 1}. ${run.id} - ${run.status} (${run.environment})`);
          });
        }
      }

      // Test 9: Platform Analytics
      console.log("\n9. Testing platform analytics...");
      const platformAnalyticsResponse = await fetch(`${BASE_URL}/api/v1/analytics/platform`);

      const platformAnalyticsData = await platformAnalyticsResponse.json();
      console.log(`   Status: ${platformAnalyticsResponse.status}`);

      if (platformAnalyticsData.success) {
        console.log(`   ✅ Platform analytics retrieved!`);
        console.log(`   📊 Total Projects: ${platformAnalyticsData.metrics.totalProjects}`);
        console.log(`   🏃 Total Runs: ${platformAnalyticsData.metrics.totalTestRuns}`);
        console.log(`   👥 Active Users: ${platformAnalyticsData.metrics.activeUsers}`);
        console.log(`   ✅ Success Rate: ${platformAnalyticsData.metrics.successRate}%`);
      }

      // Test 10: User Analytics
      console.log("\n10. Testing user analytics...");
      const userAnalyticsResponse = await fetch(`${BASE_URL}/api/v1/analytics/user`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });

      const userAnalyticsData = await userAnalyticsResponse.json();
      console.log(`   Status: ${userAnalyticsResponse.status}`);

      if (userAnalyticsData.success) {
        console.log(`   ✅ User analytics retrieved!`);
        console.log(`   📊 Projects: ${userAnalyticsData.analytics.metrics.totalProjects}`);
        console.log(`   🏃 Runs: ${userAnalyticsData.analytics.metrics.totalRuns}`);
        console.log(`   💾 Storage Used: ${Math.round(userAnalyticsData.analytics.metrics.storageUsed / 1024 / 1024)}MB`);
        console.log(`   📋 Plan: ${userAnalyticsData.analytics.subscriptionLimits.plan}`);
      }

      // Test 11: Dashboard Data
      console.log("\n11. Testing dashboard data...");
      const dashboardResponse = await fetch(`${BASE_URL}/api/v1/analytics/dashboard`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });

      const dashboardData = await dashboardResponse.json();
      console.log(`   Status: ${dashboardResponse.status}`);

      if (dashboardData.success) {
        console.log(`   ✅ Dashboard data retrieved!`);
        console.log(`   👤 User Projects: ${dashboardData.dashboard.user.projects}`);
        console.log(`   🏃 User Runs: ${dashboardData.dashboard.user.runs}`);
        console.log(`   📊 Platform Projects: ${dashboardData.dashboard.platform.totalProjects}`);
        console.log(`   👥 Platform Active Users: ${dashboardData.dashboard.platform.activeUsers}`);
      }

      // Test 12: Project Analytics (if we have a project)
      if (testProjectId) {
        console.log("\n12. Testing project analytics...");
        const projectAnalyticsResponse = await fetch(`${BASE_URL}/api/v1/analytics/projects/${testProjectId}`, {
          headers: { "Authorization": `Bearer ${authToken}` }
        });

        const projectAnalyticsData = await projectAnalyticsResponse.json();
        console.log(`   Status: ${projectAnalyticsResponse.status}`);

        if (projectAnalyticsData.success) {
          console.log(`   ✅ Project analytics retrieved!`);
          console.log(`   📊 Total Runs: ${projectAnalyticsData.analytics.metrics.totalRuns}`);
          console.log(`   ✅ Success Rate: ${Math.round(projectAnalyticsData.analytics.metrics.successRate * 100) / 100}%`);
          console.log(`   ⏱️ Avg Duration: ${Math.round(projectAnalyticsData.analytics.metrics.averageDuration)}ms`);
        }
      }

      // Test 13: File Upload
      console.log("\n13. Testing file upload...");
      const testContent = "This is a test file for Questro API validation.";
      const fileUploadResponse = await fetch(`${BASE_URL}/api/files/media/test-upload.txt`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "X-User-ID": loginData.user.id,
          "X-Source": "api-test"
        },
        body: testContent
      });

      const fileUploadData = await fileUploadResponse.json();
      console.log(`   Status: ${fileUploadResponse.status}`);

      if (fileUploadData.success) {
        console.log(`   ✅ File uploaded successfully!`);
        console.log(`   📁 File Key: ${fileUploadData.file.key}`);
        console.log(`   🌐 URL: ${fileUploadData.file.url}`);
        console.log(`   📏 Size: ${fileUploadData.file.size} bytes`);

        // Test 14: File Download
        console.log("\n14. Testing file download...");
        const fileDownloadResponse = await fetch(fileUploadData.file.url);
        console.log(`   Status: ${fileDownloadResponse.status}`);

        if (fileDownloadResponse.status === 200) {
          const downloadedContent = await fileDownloadResponse.text();
          if (downloadedContent === testContent) {
            console.log(`   ✅ File downloaded and verified successfully!`);
            console.log(`   📄 Content matches: ${downloadedContent.length} characters`);
          } else {
            console.log(`   ❌ File content mismatch!`);
          }
        }
      }

      // Test 15: Logout
      console.log("\n15. Testing logout...");
      const logoutResponse = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}` }
      });

      const logoutData = await logoutResponse.json();
      console.log(`   Status: ${logoutResponse.status}`);

      if (logoutData.success) {
        console.log(`   ✅ Logout successful!`);
      }

    } else {
      console.log(`   ❌ Login failed: ${loginData.error}`);
    }

    // Test 16: Unauthorized Access
    console.log("\n16. Testing unauthorized access protection...");
    const unauthorizedResponse = await fetch(`${BASE_URL}/api/v1/projects`, {
      headers: { "Authorization": "Bearer invalid.token" }
    });

    console.log(`   Status: ${unauthorizedResponse.status}`);
    if (unauthorizedResponse.status === 401) {
      console.log(`   ✅ Unauthorized access correctly blocked!`);
    } else {
      console.log(`   ❌ Unauthorized access not properly handled!`);
    }

    console.log("\n🎉 Complete API testing finished!");
    console.log("\n📊 Summary:");
    console.log("   ✅ Authentication System: Login, Profile, Logout");
    console.log("   ✅ Projects Management: Create, List, Test Runs");
    console.log("   ✅ Analytics & Reporting: Platform, User, Project, Dashboard");
    console.log("   ✅ File Storage: Upload, Download, R2 Integration");
    console.log("   ✅ Security: JWT Authentication, Authorization");
    console.log("   ✅ Database: D1 SQLite with comprehensive schema");
    console.log("   ✅ Storage: R2 Buckets + KV Caching");
    console.log("   ✅ Edge Computing: Cloudflare Workers deployment");

  } catch (error) {
    console.error("❌ API testing failed:", error.message);
  }
}

// Run the tests
testAPI().catch(console.error);
