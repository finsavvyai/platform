/**
 * Test script for authentication endpoints
 */

const BASE_URL = "https://qestro.broad-dew-49ad.workers.dev";

async function testAuth() {
  console.log("🧪 Testing Authentication Endpoints\n");

  // Test 1: Login
  console.log("1. Testing login endpoint...");
  try {
    const loginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "testpassword123"
      })
    });

    const loginData = await loginResponse.json();
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Response:`, loginData);

    if (loginData.success && loginData.tokens) {
      const { accessToken, refreshToken } = loginData.tokens;
      console.log(`   ✅ Login successful!`);
      console.log(`   📝 Access token: ${accessToken.substring(0, 50)}...`);
      console.log(`   🔄 Refresh token: ${refreshToken.substring(0, 50)}...`);

      // Test 2: Get profile with access token
      console.log("\n2. Testing profile endpoint with access token...");
      try {
        const profileResponse = await fetch(`${BASE_URL}/api/v1/auth/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          }
        });

        const profileData = await profileResponse.json();
        console.log(`   Status: ${profileResponse.status}`);
        console.log(`   Response:`, profileData);

        if (profileData.success) {
          console.log(`   ✅ Profile access successful!`);
        } else {
          console.log(`   ❌ Profile access failed: ${profileData.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Profile request error: ${error.message}`);
      }

      // Test 3: Access protected route
      console.log("\n3. Testing protected route...");
      try {
        const protectedResponse = await fetch(`${BASE_URL}/api/v1/protected`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          }
        });

        const protectedData = await protectedResponse.json();
        console.log(`   Status: ${protectedResponse.status}`);
        console.log(`   Response:`, protectedData);

        if (protectedData.success) {
          console.log(`   ✅ Protected route access successful!`);
        } else {
          console.log(`   ❌ Protected route access failed: ${protectedData.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Protected route request error: ${error.message}`);
      }

      // Test 4: Token refresh
      console.log("\n4. Testing token refresh...");
      try {
        const refreshResponse = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refreshToken: refreshToken
          })
        });

        const refreshData = await refreshResponse.json();
        console.log(`   Status: ${refreshResponse.status}`);
        console.log(`   Response:`, refreshData);

        if (refreshData.success) {
          console.log(`   ✅ Token refresh successful!`);
          console.log(`   📝 New access token: ${refreshData.tokens.accessToken.substring(0, 50)}...`);
        } else {
          console.log(`   ❌ Token refresh failed: ${refreshData.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Token refresh error: ${error.message}`);
      }

      // Test 5: Logout
      console.log("\n5. Testing logout...");
      try {
        const logoutResponse = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          }
        });

        const logoutData = await logoutResponse.json();
        console.log(`   Status: ${logoutResponse.status}`);
        console.log(`   Response:`, logoutData);

        if (logoutData.success) {
          console.log(`   ✅ Logout successful!`);
        } else {
          console.log(`   ❌ Logout failed: ${logoutData.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Logout error: ${error.message}`);
      }

    } else {
      console.log(`   ❌ Login failed: ${loginData.error}`);
    }
  } catch (error) {
    console.log(`   ❌ Login request error: ${error.message}`);
  }

  // Test 6: Test unauthorized access
  console.log("\n6. Testing unauthorized access to protected route...");
  try {
    const unauthorizedResponse = await fetch(`${BASE_URL}/api/v1/protected`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    });

    const unauthorizedData = await unauthorizedResponse.json();
    console.log(`   Status: ${unauthorizedResponse.status}`);
    console.log(`   Response:`, unauthorizedData);

    if (unauthorizedResponse.status === 401) {
      console.log(`   ✅ Unauthorized access correctly blocked!`);
    } else {
      console.log(`   ❌ Unauthorized access not properly handled`);
    }
  } catch (error) {
    console.log(`   ❌ Unauthorized access test error: ${error.message}`);
  }

  // Test 7: Test invalid token
  console.log("\n7. Testing invalid token...");
  try {
    const invalidTokenResponse = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        "Authorization": "Bearer invalid.token.here",
        "Content-Type": "application/json",
      }
    });

    const invalidTokenData = await invalidTokenResponse.json();
    console.log(`   Status: ${invalidTokenResponse.status}`);
    console.log(`   Response:`, invalidTokenData);

    if (invalidTokenResponse.status === 401) {
      console.log(`   ✅ Invalid token correctly rejected!`);
    } else {
      console.log(`   ❌ Invalid token not properly handled`);
    }
  } catch (error) {
    console.log(`   ❌ Invalid token test error: ${error.message}`);
  }

  console.log("\n🎉 Authentication testing complete!");
}

// Run the tests
testAuth().catch(console.error);
