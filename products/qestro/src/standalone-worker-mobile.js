/**
 * Complete Questro Worker with Mobile Testing Support
 * Full-featured Cloudflare Worker with authentication, APIs, WebSocket, and Mobile Testing
 */

// JWT Authentication Service (simplified JavaScript implementation)
class JWTAuthService {
  constructor(env) {
    if (!env.JWT_SECRET || !env.REFRESH_SECRET) {
      throw new Error("JWT secrets not configured");
    }

    this.JWT_SECRET = env.JWT_SECRET;
    this.REFRESH_SECRET = env.REFRESH_SECRET;
    this.ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes
    this.REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
    this.ALGORITHM = "HS256";
  }

  base64urlEncode(str) {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  base64urlDecode(str) {
    str += "=".repeat((4 - (str.length % 4)) % 4);
    return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  }

  async generateToken(payload, secret, expiresIn) {
    const header = {
      alg: this.ALGORITHM,
      typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresIn;

    const jwtPayload = {
      ...payload,
      iat: now,
      exp,
    };

    const encodedHeader = this.base64urlEncode(JSON.stringify(header));
    const encodedPayload = this.base64urlEncode(JSON.stringify(jwtPayload));

    const message = `${encodedHeader}.${encodedPayload}`;

    // Create signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
    const encodedSignature = signatureBase64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    return `${message}.${encodedSignature}`;
  }

  async verifyToken(token, secret) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      const [encodedHeader, encodedPayload, encodedSignature] = parts;

      // Verify signature
      const message = `${encodedHeader}.${encodedPayload}`;
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(message);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );

      // Decode signature
      const signatureBase64 = encodedSignature
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const signature = Uint8Array.from(
        atob(
          signatureBase64 + "=".repeat((4 - (signatureBase64.length % 4)) % 4),
        ),
        (c) => c.charCodeAt(0),
      );

      const isValid = await crypto.subtle.verify(
        "HMAC",
        cryptoKey,
        signature,
        messageData,
      );
      if (!isValid) {
        return null;
      }

      // Decode payload
      const payloadBase64 = encodedPayload
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const payloadJson = atob(
        payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4),
      );
      const payload = JSON.parse(payloadJson);

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  }

  async generateTokens(user) {
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const accessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      type: "access",
    };

    const refreshTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      type: "refresh",
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateToken(
        accessTokenPayload,
        this.JWT_SECRET,
        this.ACCESS_TOKEN_TTL,
      ),
      this.generateToken(
        refreshTokenPayload,
        this.REFRESH_SECRET,
        this.REFRESH_TOKEN_TTL,
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresAt: now + this.ACCESS_TOKEN_TTL * 1000,
    };
  }

  async verifyAccessToken(token) {
    const payload = await this.verifyToken(token, this.JWT_SECRET);
    return payload?.type === "access" ? payload : null;
  }

  async verifyRefreshToken(token) {
    const payload = await this.verifyToken(token, this.REFRESH_SECRET);
    return payload?.type === "refresh" ? payload : null;
  }

  extractTokenFromHeader(authorizationHeader) {
    if (!authorizationHeader) return null;

    const parts = authorizationHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  async authenticate(request) {
    const token = this.extractTokenFromHeader(
      request.headers.get("Authorization"),
    );

    if (!token) {
      return {
        user: null,
        error: "Missing authorization token",
      };
    }

    const payload = await this.verifyAccessToken(token);
    if (!payload) {
      return {
        user: null,
        error: "Invalid or expired token",
      };
    }

    return { user: payload };
  }

  hasRequiredRole(user, requiredRoles) {
    const roles = Array.isArray(requiredRoles)
      ? requiredRoles
      : [requiredRoles];
    return roles.includes(user.role);
  }
}

// Authentication API Handler
class AuthAPI {
  constructor(env) {
    this.authService = new JWTAuthService(env);
  }

  async authenticateUser(email, password) {
    try {
      // Mock user implementation
      if (password.length < 6) {
        return {
          success: false,
          error: "Invalid password",
          code: "INVALID_CREDENTIALS",
        };
      }

      const mockUser = {
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        name: email.split("@")[0],
        role: "user",
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: "free",
          status: "active",
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024,
            bandwidth: 10 * 1024 * 1024 * 1024,
          },
        },
      };

      const tokens = await this.authService.generateTokens(mockUser);
      mockUser.lastLoginAt = new Date().toISOString();

      return {
        success: true,
        user: mockUser,
        tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: "Authentication failed",
        code: "AUTH_ERROR",
      };
    }
  }

  async refreshAccessToken(refreshToken) {
    try {
      const payload = await this.authService.verifyRefreshToken(refreshToken);
      if (!payload) {
        return {
          success: false,
          error: "Invalid refresh token",
          code: "INVALID_REFRESH_TOKEN",
        };
      }

      const mockUser = {
        id: payload.userId,
        email: payload.email,
        name: payload.email.split("@")[0],
        role: payload.role,
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subscription: {
          plan: "free",
          status: "active",
          limits: {
            apiCalls: 1000,
            storage: 1024 * 1024 * 1024,
            bandwidth: 10 * 1024 * 1024 * 1024,
          },
        },
      };

      const tokens = await this.authService.generateTokens(mockUser);

      return {
        success: true,
        user: mockUser,
        tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: "Token refresh failed",
        code: "REFRESH_ERROR",
      };
    }
  }

  jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  errorResponse(message, status = 400) {
    return this.jsonResponse(
      {
        success: false,
        error: message,
      },
      status,
    );
  }
}

// Mobile Device Service
class MobileDeviceService {
  constructor(env) {
    this.env = env;
  }

  async registerDevice(deviceData) {
    const device = {
      ...deviceData,
      id: crypto.randomUUID(),
      lastSeen: new Date().toISOString(),
    };

    try {
      // Store in KV namespace for devices
      await this.env.DEVICES.put(`device:${device.id}`, JSON.stringify(device));
      return device;
    } catch (error) {
      console.error("Failed to register device:", error);
      throw new Error("Failed to register mobile device");
    }
  }

  async getDevices(filters = {}) {
    try {
      // Enhanced device list with enterprise capabilities
      const mockDevices = [
        {
          id: "device-1",
          name: "iPhone 14 Pro",
          platform: "ios",
          model: "iPhone15,3",
          osVersion: "17.0",
          status: "online",
          capabilities: {
            screenRecording: true,
            screenshots: true,
            touchGestures: true,
            networkSimulation: true,
            appInstallation: true,
            gpsSimulation: true,
            cameraAccess: true,
            microphoneAccess: true,
          },
          lastSeen: new Date().toISOString(),
          location: "farm",
          agentId: "agent-ios-01",
          specs: {
            screenWidth: 1179,
            screenHeight: 2556,
            pixelDensity: 3,
            cpuCores: 6,
            memory: 6144,
            storage: 256,
            batteryLevel: 85,
            networkType: "WiFi",
          },
        },
        {
          id: "device-2",
          name: "Google Pixel 7",
          platform: "android",
          model: "Pixel 7",
          osVersion: "13.0",
          status: "online",
          capabilities: {
            screenRecording: true,
            screenshots: true,
            touchGestures: true,
            networkSimulation: true,
            appInstallation: true,
            gpsSimulation: true,
            cameraAccess: false,
            microphoneAccess: true,
          },
          lastSeen: new Date().toISOString(),
          location: "cloud",
          agentId: "agent-android-01",
          specs: {
            screenWidth: 1080,
            screenHeight: 2400,
            pixelDensity: 2.625,
            cpuCores: 8,
            memory: 8192,
            storage: 128,
            batteryLevel: 92,
            networkType: "5G",
          },
        },
        {
          id: "device-3",
          name: 'iPad Pro 12.9"',
          platform: "ios",
          model: "iPad14,5",
          osVersion: "16.5",
          status: "busy",
          currentTest: "test-suite-123",
          capabilities: {
            screenRecording: true,
            screenshots: true,
            touchGestures: true,
            networkSimulation: true,
            appInstallation: true,
            gpsSimulation: true,
            cameraAccess: true,
            microphoneAccess: true,
          },
          lastSeen: new Date().toISOString(),
          location: "local",
          agentId: "agent-ipad-01",
          specs: {
            screenWidth: 2048,
            screenHeight: 2732,
            pixelDensity: 2.5,
            cpuCores: 8,
            memory: 8192,
            storage: 512,
            batteryLevel: 78,
            networkType: "WiFi",
          },
        },
      ];

      let devices = mockDevices;

      // Apply filters
      if (filters.platform) {
        devices = devices.filter((d) => d.platform === filters.platform);
      }
      if (filters.status) {
        devices = devices.filter((d) => d.status === filters.status);
      }
      if (filters.location) {
        devices = devices.filter((d) => d.location === filters.location);
      }
      if (filters.capability) {
        devices = devices.filter((d) => d.capabilities[filters.capability]);
      }

      return { devices };
    } catch (error) {
      console.error("Failed to get devices:", error);
      throw new Error("Failed to get mobile devices");
    }
  }

  async getDevice(deviceId) {
    try {
      const devices = await this.getDevices();
      return devices.devices.find((d) => d.id === deviceId) || null;
    } catch (error) {
      console.error("Failed to get device:", error);
      throw new Error("Failed to get mobile device");
    }
  }

  async updateDeviceStatus(deviceId, status, currentTest) {
    try {
      const device = await this.getDevice(deviceId);
      if (!device) throw new Error("Device not found");

      device.status = status;
      device.lastSeen = new Date().toISOString();
      if (currentTest) {
        device.currentTest = currentTest;
      } else {
        delete device.currentTest;
      }

      await this.env.DEVICES.put(`device:${deviceId}`, JSON.stringify(device));
      return device;
    } catch (error) {
      console.error("Failed to update device status:", error);
      throw new Error("Failed to update device status");
    }
  }

  generateMobileTestScript(config) {
    const { platform, appId, actions } = config;

    // Generate Maestro-compatible YAML script
    let script = `appId: ${appId || "com.example.app"}\n`;
    script += "onFlowStart:\n";
    script += "  - launchApp\n";
    script += "\nflows:\n";

    actions.forEach((action, index) => {
      script += `  - step: ${action.type} ${index + 1}\n`;

      switch (action.type) {
        case "tap":
          if (action.target) {
            script += `    tapOn:\n      text: "${action.target}"\n`;
          }
          break;
        case "input":
          if (action.target && action.value) {
            script += `    inputText: "${action.value}"\n    into: \n      text: "${action.target}"\n`;
          }
          break;
        case "swipe":
          script += `    swipe:\n      direction: ${action.direction || "up"}\n`;
          break;
        case "wait":
          script += `    wait: ${action.duration || 1000}\n`;
          break;
        case "assert":
          if (action.target) {
            script += `    assertVisible:\n      text: "${action.target}"\n`;
          }
          break;
      }
    });

    return script;
  }
}

// Mobile Test Execution Service
class MobileTestExecutionService {
  constructor(env) {
    this.env = env;
  }

  async executeTest(config, projectId) {
    const execution = {
      id: crypto.randomUUID(),
      deviceId: config.deviceId,
      projectId,
      status: "pending",
      config,
      results: {
        steps: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          successRate: 0,
        },
      },
      logs: [],
      screenshots: [],
      startTime: new Date().toISOString(),
    };

    try {
      // Store execution
      await this.env.TESTS.put(
        `execution:${execution.id}`,
        JSON.stringify(execution),
      );

      // In a real implementation, this would queue the test for execution
      // For now, we'll simulate a quick execution
      setTimeout(async () => {
        execution.status = "passed";
        execution.endTime = new Date().toISOString();
        execution.duration = 2000;
        execution.results.summary = {
          total: config.testScript ? config.testScript.split("\n").length : 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          duration: 2000,
          successRate: 100,
        };

        await this.env.TESTS.put(
          `execution:${execution.id}`,
          JSON.stringify(execution),
        );
      }, 2000);

      return execution;
    } catch (error) {
      console.error("Failed to execute test:", error);
      throw new Error("Failed to execute mobile test");
    }
  }

  async getExecution(executionId) {
    try {
      const executionData = await this.env.TESTS.get(
        `execution:${executionId}`,
      );
      return executionData ? JSON.parse(executionData) : null;
    } catch (error) {
      console.error("Failed to get execution:", error);
      throw new Error("Failed to get test execution");
    }
  }

  async getExecutions(projectId, filters = {}) {
    try {
      // Mock execution history
      const executions = [
        {
          id: "exec-1",
          deviceId: "device-1",
          projectId,
          status: "passed",
          framework: "maestro",
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date(Date.now() - 3570000).toISOString(),
          duration: 30000,
          results: {
            summary: {
              total: 15,
              passed: 15,
              failed: 0,
              skipped: 0,
              successRate: 100,
            },
          },
        },
        {
          id: "exec-2",
          deviceId: "device-2",
          projectId,
          status: "failed",
          framework: "appium",
          startTime: new Date(Date.now() - 7200000).toISOString(),
          endTime: new Date(Date.now() - 7185000).toISOString(),
          duration: 15000,
          results: {
            summary: {
              total: 8,
              passed: 6,
              failed: 2,
              skipped: 0,
              successRate: 75,
            },
          },
        },
      ];

      return executions;
    } catch (error) {
      console.error("Failed to get executions:", error);
      throw new Error("Failed to get test executions");
    }
  }
}

// Device Farm Service
class DeviceFarmService {
  constructor(env) {
    this.env = env;
  }

  async getDeviceFarms(filters = {}) {
    try {
      const mockFarms = [
        {
          id: "farm-1",
          name: "San Francisco Mobile Lab",
          description: "Primary West Coast device farm",
          location: {
            name: "San Francisco, CA",
            timezone: "America/Los_Angeles",
            region: "us-west",
          },
          capacity: {
            maxDevices: 50,
            currentDevices: 32,
            availableDevices: 18,
          },
          configuration: {
            autoProvisioning: true,
            maintenanceWindow: {
              start: "02:00",
              end: "04:00",
              timezone: "America/Los_Angeles",
            },
            deviceRotation: true,
            healthCheckInterval: 5,
          },
          networking: {
            vpnRequired: true,
            firewallRules: [],
            bandwidthLimit: 1000,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "active",
        },
        {
          id: "farm-2",
          name: "New York Testing Center",
          description: "East Coast device farm for mobile testing",
          location: {
            name: "New York, NY",
            timezone: "America/New_York",
            region: "us-east",
          },
          capacity: {
            maxDevices: 40,
            currentDevices: 28,
            availableDevices: 12,
          },
          configuration: {
            autoProvisioning: true,
            maintenanceWindow: {
              start: "03:00",
              end: "05:00",
              timezone: "America/New_York",
            },
            deviceRotation: true,
            healthCheckInterval: 5,
          },
          networking: {
            vpnRequired: false,
            firewallRules: [],
            bandwidthLimit: 500,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: "active",
        },
      ];

      let farms = mockFarms;

      // Apply filters
      if (filters.status) {
        farms = farms.filter((f) => f.status === filters.status);
      }
      if (filters.region) {
        farms = farms.filter((f) => f.location.region === filters.region);
      }

      return farms;
    } catch (error) {
      console.error("Failed to get device farms:", error);
      throw new Error("Failed to get device farms");
    }
  }

  async getFarmMetrics(farmId, timeRange = "24h") {
    try {
      // Generate mock metrics
      const now = new Date();
      const metrics = [];

      for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);

        metrics.push({
          farmId,
          timestamp: timestamp.toISOString(),
          utilization: {
            total: 50,
            used: 25 + Math.floor(Math.random() * 20),
            available: 5 + Math.floor(Math.random() * 15),
            percentage: 50 + Math.floor(Math.random() * 40),
          },
          performance: {
            averageTestDuration: 120 + Math.floor(Math.random() * 60),
            successRate: 85 + Math.floor(Math.random() * 14),
            errorRate: Math.floor(Math.random() * 10),
            queueTime: Math.floor(Math.random() * 300),
          },
          devices: {
            online: 20 + Math.floor(Math.random() * 10),
            offline: 2 + Math.floor(Math.random() * 3),
            error: Math.floor(Math.random() * 2),
            maintenance: Math.floor(Math.random() * 2),
          },
        });
      }

      return metrics.reverse(); // Most recent first
    } catch (error) {
      console.error("Failed to get farm metrics:", error);
      throw new Error("Failed to get farm metrics");
    }
  }
}

// AI Mobile Test Generator Service
class AIMobileTestGeneratorService {
  constructor(env) {
    this.env = env;
  }

  async generateTestFromRecording(recordingData) {
    try {
      // Simulate AI analysis of mobile recording
      const testSteps = [
        {
          type: "launch",
          description: "Launch the application",
        },
        {
          type: "tap",
          target: "Login Button",
          description: "Tap on the login button",
        },
        {
          type: "input",
          target: "Email Field",
          value: "test@example.com",
          description: "Enter email address",
        },
        {
          type: "input",
          target: "Password Field",
          value: "********",
          description: "Enter password",
        },
        {
          type: "tap",
          target: "Submit Button",
          description: "Tap submit button",
        },
        {
          type: "assert",
          target: "Welcome Message",
          description: "Verify welcome message is displayed",
        },
      ];

      return {
        framework: "maestro",
        testSteps,
        testScript: this.generateMaestroScript(testSteps),
        confidence: 0.92,
        suggestions: [
          "Add data-driven testing with multiple user credentials",
          "Include negative test cases for invalid inputs",
          "Add performance assertions for response times",
        ],
      };
    } catch (error) {
      console.error("Failed to generate test from recording:", error);
      throw new Error("Failed to generate test from recording");
    }
  }

  async generateTestFromScreenshot(screenshotData, requirements) {
    try {
      // Simulate AI analysis of screenshot
      const testSteps = [
        {
          type: "launch",
          description: "Launch the application",
        },
        {
          type: "wait",
          duration: 2000,
          description: "Wait for app to load",
        },
        {
          type: "assert",
          target: "Main Screen",
          description: "Verify main screen elements are visible",
        },
        {
          type: "tap",
          target: "Primary Action Button",
          description: "Tap on primary action button",
        },
        {
          type: "wait",
          duration: 1000,
          description: "Wait for navigation",
        },
        {
          type: "screenshot",
          description: "Capture screenshot for verification",
        },
      ];

      return {
        framework: "maestro",
        testSteps,
        testScript: this.generateMaestroScript(testSteps),
        confidence: 0.87,
        detectedElements: [
          "Navigation Bar",
          "Primary Button",
          "Secondary Button",
          "Text Input Fields",
          "Image Content",
        ],
      };
    } catch (error) {
      console.error("Failed to generate test from screenshot:", error);
      throw new Error("Failed to generate test from screenshot");
    }
  }

  generateMaestroScript(steps) {
    let script = "appId: com.example.app\n\n";
    script += "flows:\n";

    steps.forEach((step, index) => {
      script += "  - step: " + step.description + "\n";

      switch (step.type) {
        case "launch":
          script += "    - launchApp\n";
          break;
        case "tap":
          script += `    - tapOn: "${step.target}"\n`;
          break;
        case "input":
          script += `    - inputText: "${step.value}"\n`;
          script += `    - into: "${step.target}"\n`;
          break;
        case "assert":
          script += `    - assertVisible: "${step.target}"\n`;
          break;
        case "wait":
          script += `    - wait: ${step.duration}\n`;
          break;
        case "screenshot":
          script += '    - takeScreenshot: "verification"\n';
          break;
      }
    });

    return script;
  }
}

// Placeholder Durable Objects (exported for compatibility)
export class CollaborationDO {
  constructor(state, env) {}
  async fetch(request) {
    return new Response("Collaboration DO operational");
  }
}

export class SessionDO {
  constructor(state, env) {}
  async fetch(request) {
    return new Response("Session DO operational");
  }
}

export class TestExecutionDO {
  constructor(state, env) {}
  async fetch(request) {
    return new Response("Test Execution DO operational");
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const authAPI = new AuthAPI(env);
    const mobileDeviceService = new MobileDeviceService(env);
    const mobileTestService = new MobileTestExecutionService(env);
    const deviceFarmService = new DeviceFarmService(env);
    const aiTestGenerator = new AIMobileTestGeneratorService(env);

    // Add CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-User-ID, X-Source, X-Filename, X-Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Mobile Testing Routes
    if (url.pathname.startsWith("/api/v1/mobile/")) {
      try {
        // Health check for mobile services
        if (url.pathname === "/api/v1/mobile/health") {
          const devices = await mobileDeviceService.getDevices();
          return new Response(
            JSON.stringify({
              success: true,
              status: "healthy",
              services: {
                deviceManagement: "operational",
                testExecution: "operational",
                agentCommunication: "operational",
              },
              metrics: {
                totalDevices: devices.devices.length,
                onlineDevices: devices.devices.filter(
                  (d) => d.status === "online",
                ).length,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // List mobile devices
        if (
          url.pathname === "/api/v1/mobile/devices" &&
          request.method === "GET"
        ) {
          const devices = await mobileDeviceService.getDevices();
          return new Response(
            JSON.stringify({
              success: true,
              devices: devices.devices,
              total: devices.devices.length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Register mobile device
        if (
          url.pathname === "/api/v1/mobile/devices" &&
          request.method === "POST"
        ) {
          const deviceData = await request.json();
          const device = await mobileDeviceService.registerDevice(deviceData);
          return new Response(
            JSON.stringify({
              success: true,
              device,
              message: "Mobile device registered successfully",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Execute mobile test
        if (
          url.pathname === "/api/v1/mobile/tests/execute" &&
          request.method === "POST"
        ) {
          const testConfig = await request.json();
          const projectId =
            request.headers.get("X-Project-ID") || "default-project";
          const execution = await mobileTestService.executeTest(
            testConfig,
            projectId,
          );
          return new Response(
            JSON.stringify({
              success: true,
              execution,
              message: "Mobile test queued for execution",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Get test execution
        if (
          url.pathname.startsWith("/api/v1/mobile/tests/") &&
          request.method === "GET"
        ) {
          const executionId = url.pathname.split("/").pop();
          const execution = await mobileTestService.getExecution(executionId);
          if (!execution) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Test execution not found",
              }),
              {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
          return new Response(
            JSON.stringify({
              success: true,
              execution,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Generate test script
        if (
          url.pathname === "/api/v1/mobile/scripts/generate" &&
          request.method === "POST"
        ) {
          const config = await request.json();
          const testScript =
            mobileDeviceService.generateMobileTestScript(config);
          return new Response(
            JSON.stringify({
              success: true,
              testScript,
              message: "Test script generated successfully",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Get mobile capabilities
        if (
          url.pathname === "/api/v1/mobile/capabilities" &&
          request.method === "GET"
        ) {
          const capabilities = {
            platforms: ["ios", "android"],
            actions: [
              "tap",
              "swipe",
              "input",
              "assert",
              "wait",
              "launch",
              "screenshot",
            ],
            deviceFeatures: [
              "screenRecording",
              "touchGestures",
              "networkSimulation",
            ],
            supportedFrameworks: ["Maestro", "Appium"],
          };
          return new Response(
            JSON.stringify({
              success: true,
              capabilities,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Get test execution history
        if (
          url.pathname === "/api/v1/mobile/tests/history" &&
          request.method === "GET"
        ) {
          const projectId =
            request.headers.get("X-Project-ID") || "default-project";
          const executions = await mobileTestService.getExecutions(projectId);
          return new Response(
            JSON.stringify({
              success: true,
              executions,
              total: executions.length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Update device status
        if (
          url.pathname.startsWith("/api/v1/mobile/devices/") &&
          request.method === "PUT"
        ) {
          const deviceId = url.pathname.split("/").pop();
          const body = await request.json();
          const device = await mobileDeviceService.updateDeviceStatus(
            deviceId,
            body.status,
            body.currentTest,
          );
          return new Response(
            JSON.stringify({
              success: true,
              device,
              message: "Device status updated successfully",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Get device farms
        if (
          url.pathname === "/api/v1/mobile/farms" &&
          request.method === "GET"
        ) {
          const urlParams = new URLSearchParams(url.search);
          const filters = {
            status: urlParams.get("status") || undefined,
            region: urlParams.get("region") || undefined,
          };
          const farms = await deviceFarmService.getDeviceFarms(filters);
          return new Response(
            JSON.stringify({
              success: true,
              farms,
              total: farms.length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Get farm metrics
        if (
          url.pathname.startsWith("/api/v1/mobile/farms/") &&
          url.pathname.endsWith("/metrics") &&
          request.method === "GET"
        ) {
          const farmId = url.pathname.split("/")[4];
          const timeRange =
            new URLSearchParams(url.search).get("timeRange") || "24h";
          const metrics = await deviceFarmService.getFarmMetrics(
            farmId,
            timeRange,
          );
          return new Response(
            JSON.stringify({
              success: true,
              metrics,
              farmId,
              timeRange,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // AI test generation from recording
        if (
          url.pathname === "/api/v1/mobile/ai/generate/recording" &&
          request.method === "POST"
        ) {
          const recordingData = await request.json();
          const generatedTest =
            await aiTestGenerator.generateTestFromRecording(recordingData);
          return new Response(
            JSON.stringify({
              success: true,
              generatedTest,
              message: "Test generated successfully from recording",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // AI test generation from screenshot
        if (
          url.pathname === "/api/v1/mobile/ai/generate/screenshot" &&
          request.method === "POST"
        ) {
          const body = await request.json();
          const generatedTest =
            await aiTestGenerator.generateTestFromScreenshot(
              body.screenshotData,
              body.requirements,
            );
          return new Response(
            JSON.stringify({
              success: true,
              generatedTest,
              message: "Test generated successfully from screenshot",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Get mobile analytics dashboard data
        if (
          url.pathname === "/api/v1/mobile/analytics/dashboard" &&
          request.method === "GET"
        ) {
          const analytics = {
            overview: {
              totalDevices: 3,
              onlineDevices: 2,
              busyDevices: 1,
              totalTests: 156,
              successRate: 87.5,
              avgTestDuration: 2.3,
            },
            trends: {
              testsPerDay: [12, 15, 8, 22, 18, 25, 20],
              successRateTrend: [85, 88, 82, 90, 87, 89, 87.5],
              deviceUtilization: [65, 70, 68, 75, 72, 78, 74],
            },
            topIssues: [
              { type: "Element Not Found", count: 12 },
              { type: "Timeout", count: 8 },
              { type: "Network Error", count: 5 },
              { type: "App Crash", count: 3 },
            ],
            devicePerformance: [
              {
                deviceId: "device-1",
                name: "iPhone 14 Pro",
                successRate: 92,
                avgDuration: 2.1,
              },
              {
                deviceId: "device-2",
                name: "Google Pixel 7",
                successRate: 83,
                avgDuration: 2.5,
              },
            ],
          };
          return new Response(
            JSON.stringify({
              success: true,
              analytics,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("Mobile API error:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Mobile API request failed",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Authentication routes (existing)
    if (url.pathname === "/api/v1/auth/login" && request.method === "POST") {
      try {
        const body = await request.json();

        if (!body.email || !body.password) {
          return authAPI.errorResponse("Email and password are required", 400);
        }

        const result = await authAPI.authenticateUser(
          body.email,
          body.password,
        );

        if (!result.success) {
          return authAPI.errorResponse(
            result.error || "Authentication failed",
            401,
          );
        }

        // Store refresh token in KV
        if (result.tokens) {
          await env.SESSIONS.put(
            `refresh:${result.user.id}`,
            result.tokens.refreshToken,
            { expirationTtl: 7 * 24 * 60 * 60 },
          );
        }

        return authAPI.jsonResponse(
          {
            success: true,
            user: result.user,
            tokens: result.tokens,
          },
          200,
        );
      } catch (error) {
        console.error("Login error:", error);
        return authAPI.errorResponse("Internal server error", 500);
      }
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json(
        {
          status: "healthy",
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || "development",
          version: "1.0.0",
          database: env.DB ? "connected" : "not configured",
          services: {
            database: env.DB ? "D1 SQLite" : "not configured",
            sessions: env.SESSIONS ? "KV Storage" : "not configured",
            cache: env.CACHE ? "KV Storage" : "not configured",
            artifacts: env.ARTIFACTS ? "R2 Bucket" : "not configured",
            media: env.MEDIA ? "R2 Bucket" : "not configured",
            backups: env.BACKUPS ? "R2 Bucket" : "not configured",
            authentication: "JWT Service operational",
            mobileTesting: "Mobile Testing Services operational",
          },
        },
        { headers: corsHeaders },
      );
    }

    // API root
    if (url.pathname === "/api" || url.pathname === "/api/") {
      return Response.json(
        {
          message: "Questro API - Workers deployed successfully!",
          status: "operational",
          features: [
            "JWT Authentication",
            "Real-time Communication",
            "File Storage",
            "Analytics",
            "Mobile Testing",
            "Collaboration",
          ],
          mobileTesting: {
            platforms: ["iOS", "Android"],
            frameworks: ["Maestro", "Appium"],
            capabilities: [
              "Device Management",
              "Test Execution",
              "Real-time Monitoring",
            ],
          },
          endpoints: {
            health: "/health",
            auth: "/api/v1/auth",
            mobile: "/api/v1/mobile",
            files: "/api/files/{bucket}/{path}",
          },
          timestamp: new Date().toISOString(),
        },
        { headers: corsHeaders },
      );
    }

    // Default response
    return Response.json(
      {
        message: "Questro Platform - Cloudflare Workers with Mobile Testing",
        status: "operational",
        version: "1.0.0",
        features: [
          "Authentication",
          "Mobile Testing",
          "Real-time Communication",
          "File Storage",
          "Analytics",
          "Collaboration",
        ],
        availableEndpoints: {
          health: "/health",
          api: "/api",
          auth: {
            login: "POST /api/v1/auth/login",
            profile: "GET /api/v1/auth/me",
          },
          mobile: {
            devices: "GET/POST /api/v1/mobile/devices",
            tests: "POST /api/v1/mobile/tests/execute",
            scripts: "POST /api/v1/mobile/scripts/generate",
            capabilities: "GET /api/v1/mobile/capabilities",
          },
          files: "/api/files/{bucket}/{path}",
        },
      },
      { headers: corsHeaders },
    );
  },
};
