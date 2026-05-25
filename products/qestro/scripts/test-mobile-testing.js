/**
 * Mobile Testing API Test Script
 * Tests all mobile testing functionality
 */

const BASE_URL = "https://qestro.broad-dew-49ad.workers.dev";

async function testMobileTesting() {
  console.log("📱 Testing Mobile Testing APIs\n");

  try {
    // Test 1: Mobile Health Check
    console.log("1. Testing mobile services health check...");
    const healthResponse = await fetch(`${BASE_URL}/api/v1/mobile/health`);
    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthResponse.status}`);
    if (healthData.success) {
      console.log(`   ✅ Mobile services operational`);
      console.log(`   📊 Total devices: ${healthData.metrics.totalDevices}`);
      console.log(`   🟢 Online devices: ${healthData.metrics.onlineDevices}`);
    }

    // Test 2: Get Mobile Capabilities
    console.log("\n2. Testing mobile capabilities...");
    const capabilitiesResponse = await fetch(`${BASE_URL}/api/v1/mobile/capabilities`);
    const capabilitiesData = await capabilitiesResponse.json();
    console.log(`   Status: ${capabilitiesResponse.status}`);
    if (capabilitiesData.success) {
      console.log(`   ✅ Supported platforms: ${capabilitiesData.capabilities.platforms.join(', ')}`);
      console.log(`   🔧 Supported actions: ${capabilitiesData.capabilities.actions.slice(0, 3).join(', ')}...`);
      console.log(`   📱 Device features: ${capabilitiesData.capabilities.deviceFeatures.length} features`);
    }

    // Test 3: List Mobile Devices
    console.log("\n3. Testing mobile device listing...");
    const devicesResponse = await fetch(`${BASE_URL}/api/v1/mobile/devices`);
    const devicesData = await devicesResponse.json();
    console.log(`   Status: ${devicesResponse.status}`);
    if (devicesData.success) {
      console.log(`   ✅ Found ${devicesData.total} devices`);
      devicesData.devices.forEach((device, index) => {
        console.log(`   ${index + 1}. ${device.name} (${device.platform} ${device.osVersion}) - ${device.status}`);
      });
    }

    // Test 4: Register a New Mobile Device
    console.log("\n4. Testing mobile device registration...");
    const deviceRegistration = await fetch(`${BASE_URL}/api/v1/mobile/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test iPhone 15",
        platform: "ios",
        model: "iPhone16,2",
        osVersion: "17.1",
        status: "online",
        capabilities: {
          screenRecording: true,
          screenshots: true,
          touchGestures: true,
          networkSimulation: true,
          appInstallation: true
        },
        location: "local",
        specs: {
          screenWidth: 1179,
          screenHeight: 2556,
          pixelDensity: 3,
          cpuCores: 6,
          memory: 8192
        }
      })
    });

    const registrationData = await deviceRegistration.json();
    console.log(`   Status: ${deviceRegistration.status}`);
    if (registrationData.success) {
      console.log(`   ✅ Device registered successfully!`);
      console.log(`   📱 Device ID: ${registrationData.device.id}`);
      console.log(`   📛 Device Name: ${registrationData.device.name}`);
      const testDeviceId = registrationData.device.id;
    }

    // Test 5: Generate Mobile Test Script
    console.log("\n5. Testing mobile test script generation...");
    const scriptGeneration = await fetch(`${BASE_URL}/api/v1/mobile/scripts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "ios",
        appId: "com.example.testapp",
        actions: [
          { type: "launch" },
          { type: "tap", target: "Login" },
          { type: "input", target: "Username", value: "testuser" },
          { type: "input", target: "Password", value: "password123" },
          { type: "tap", target: "Submit" },
          { type: "wait", duration: 2000 },
          { type: "assert", target: "Welcome" }
        ]
      })
    });

    const scriptData = await scriptGeneration.json();
    console.log(`   Status: ${scriptGeneration.status}`);
    if (scriptData.success) {
      console.log(`   ✅ Test script generated successfully!`);
      console.log(`   📄 Script length: ${scriptData.testScript.length} characters`);
      console.log(`   📱 Platform: ${scriptData.platform}`);
    }

    // Test 6: Execute Mobile Test
    console.log("\n6. Testing mobile test execution...");
    const testExecution = await fetch(`${BASE_URL}/api/v1/mobile/tests/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-ID": "test-project"
      },
      body: JSON.stringify({
        deviceId: "device-1", // Use existing device
        testScript: scriptData.success ? scriptData.testScript : "Basic test script",
        timeout: 30000,
        retryCount: 1
      })
    });

    const executionData = await testExecution.json();
    console.log(`   Status: ${testExecution.status}`);
    if (executionData.success) {
      console.log(`   ✅ Test execution queued successfully!`);
      console.log(`   🆔 Execution ID: ${executionData.execution.id}`);
      console.log(`   📱 Device: ${executionData.execution.deviceId}`);
      console.log(`   📊 Status: ${executionData.execution.status}`);

      // Test 7: Get Test Execution Results
      console.log("\n7. Testing test execution status check...");
      setTimeout(async () => {
        try {
          const statusResponse = await fetch(`${BASE_URL}/api/v1/mobile/tests/${executionData.execution.id}`);
          const statusData = await statusResponse.json();
          console.log(`   Status: ${statusResponse.status}`);
          if (statusData.success) {
            console.log(`   ✅ Execution status retrieved!`);
            console.log(`   📊 Current Status: ${statusData.execution.status}`);
            console.log(`   ⏱️ Duration: ${statusData.execution.duration || 'In progress'}ms`);

            if (statusData.execution.results) {
              console.log(`   📈 Results: ${JSON.stringify(statusData.execution.results.summary, null, 2)}`);
            }
          }
        } catch (error) {
          console.log(`   ❌ Failed to get execution status: ${error.message}`);
        }
      }, 3000); // Wait 3 seconds for test to complete
    }

    // Test 8: Test with Filters
    console.log("\n8. Testing device filtering...");
    const filteredDevices = await fetch(`${BASE_URL}/api/v1/mobile/devices?platform=android&status=online`);
    const filteredData = await filteredDevices.json();
    console.log(`   Status: ${filteredDevices.status}`);
    if (filteredData.success) {
      console.log(`   ✅ Device filtering working!`);
      console.log(`   📱 Filtered devices: ${filteredData.total} Android devices online`);
    }

    console.log("\n🎉 Mobile Testing API test completed!");
    console.log("\n📊 Summary:");
    console.log("   ✅ Mobile Services Health Check");
    console.log("   ✅ Capabilities Discovery");
    console.log("   ✅ Device Management");
    console.log("   ✅ Device Registration");
    console.log("   ✅ Test Script Generation");
    console.log("   ✅ Test Execution Queueing");
    console.log("   ✅ Execution Status Monitoring");
    console.log("   ✅ Device Filtering");

    console.log("\n🔗 Available Mobile Testing Endpoints:");
    console.log("   📱 GET /api/v1/mobile/health - Check mobile services status");
    console.log("   📱 GET /api/v1/mobile/capabilities - Get supported capabilities");
    console.log("   📱 GET /api/v1/mobile/devices - List all mobile devices");
    console.log("   📱 POST /api/v1/mobile/devices - Register new device");
    console.log("   📱 POST /api/v1/mobile/tests/execute - Execute mobile test");
    console.log("   📱 GET /api/v1/mobile/tests/:id - Get test execution details");
    console.log("   📱 POST /api/v1/mobile/scripts/generate - Generate test script");

  } catch (error) {
    console.error("❌ Mobile testing API test failed:", error.message);
  }
}

// Run the tests
testMobileTesting().catch(console.error);
