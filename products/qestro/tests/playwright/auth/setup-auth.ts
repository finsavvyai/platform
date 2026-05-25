/**
 * Authentication Setup for Different User Roles
 * Creates authentication states for various user types
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TestDataManager } from '../utils/TestDataManager';

export async function setupAuthentication(config: FullConfig) {
  console.log('🔐 Setting up authentication states...');
  
  const authDir = path.join(__dirname);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const testDataManager = new TestDataManager();
  
  try {
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
    
    // Create different user types
    const userTypes = [
      { role: 'admin' as const, filename: 'admin.json' },
      { role: 'tester' as const, filename: 'tester.json' },
      { role: 'viewer' as const, filename: 'viewer.json' },
      { role: 'user' as const, filename: 'user.json' }
    ];

    for (const userType of userTypes) {
      console.log(`Setting up ${userType.role} authentication...`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        // Create test user
        const userData = testDataManager.generateRandomUser(userType.role);
        const user = await testDataManager.createUser(userData);
        
        // Navigate to login page
        await page.goto(`${baseURL}/login`);
        
        // Perform login
        await page.fill('[data-testid=email]', user.email);
        await page.fill('[data-testid=password]', user.password);
        await page.click('[data-testid=login-button]');
        
        // Wait for successful login
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        
        // Save authentication state
        await context.storageState({ path: path.join(authDir, userType.filename) });
        
        console.log(`✅ ${userType.role} authentication state saved`);
        
        // Store user info for reference
        const userInfoPath = path.join(authDir, `${userType.role}-info.json`);
        fs.writeFileSync(userInfoPath, JSON.stringify({
          email: user.email,
          password: user.password,
          role: user.role,
          id: user.id
        }, null, 2));
        
      } catch (error) {
        console.warn(`⚠️  Failed to set up ${userType.role} authentication:`, error.message);
        
        // Create empty auth state as fallback
        const emptyState = {
          cookies: [],
          origins: []
        };
        fs.writeFileSync(path.join(authDir, userType.filename), JSON.stringify(emptyState, null, 2));
      } finally {
        await context.close();
      }
    }
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
  } finally {
    await browser.close();
    await testDataManager.cleanup();
  }
  
  console.log('✅ Authentication setup completed');
}

/**
 * Clean up authentication files
 */
export async function cleanupAuthentication() {
  console.log('🧹 Cleaning up authentication states...');
  
  const authDir = path.join(__dirname);
  if (fs.existsSync(authDir)) {
    const files = fs.readdirSync(authDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(authDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Removed ${file}`);
        } catch (error) {
          console.warn(`Failed to remove ${file}:`, error);
        }
      }
    }
  }
  
  console.log('✅ Authentication cleanup completed');
}

/**
 * Get user info for a specific role
 */
export function getUserInfo(role: 'admin' | 'tester' | 'viewer' | 'user'): any {
  const authDir = path.join(__dirname);
  const userInfoPath = path.join(authDir, `${role}-info.json`);
  
  try {
    const userInfo = fs.readFileSync(userInfoPath, 'utf-8');
    return JSON.parse(userInfo);
  } catch (error) {
    console.warn(`Failed to get user info for ${role}:`, error);
    return null;
  }
}

/**
 * Verify authentication state exists
 */
export function hasAuthenticationState(role: 'admin' | 'tester' | 'viewer' | 'user'): boolean {
  const authDir = path.join(__dirname);
  const authFilePath = path.join(authDir, `${role}.json`);
  
  return fs.existsSync(authFilePath);
}

/**
 * Create authentication state for custom user
 */
export async function createCustomAuthState(
  user: { email: string; password: string; role: string },
  filename: string,
  baseURL: string = 'http://localhost:3000'
): Promise<boolean> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto(`${baseURL}/login`);
    
    await page.fill('[data-testid=email]', user.email);
    await page.fill('[data-testid=password]', user.password);
    await page.click('[data-testid=login-button]');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    const authDir = path.join(__dirname);
    await context.storageState({ path: path.join(authDir, filename) });
    
    return true;
  } catch (error) {
    console.error(`Failed to create custom auth state for ${user.email}:`, error);
    return false;
  } finally {
    await context.close();
    await browser.close();
  }
}