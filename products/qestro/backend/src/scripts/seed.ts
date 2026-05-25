/**
 * Database Seed Script - Raw SQL Version
 * Creates initial user, project, and sample data for the application
 */

import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const DEMO_EMAIL = 'demo@qestro.io';
const DEMO_PASSWORD = 'Demo123!';

async function seed() {
    console.log('🌱 Starting database seed...');

    // Create direct connection
    const sql = postgres({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'questro_dev',
        username: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
        ssl: false,
        max: 1
    });

    try {
        // Check if demo user already exists
        const existingUsers = await sql`SELECT id FROM users WHERE email = ${DEMO_EMAIL} LIMIT 1`;

        let userId: string;

        if (existingUsers.length > 0) {
            console.log('✅ Demo user already exists');
            userId = existingUsers[0].id;
        } else {
            // Create demo user
            const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
            const newUsers = await sql`
                INSERT INTO users (email, password, first_name, last_name, role, subscription)
                VALUES (${DEMO_EMAIL}, ${hashedPassword}, 'Demo', 'User', 'admin', 'enterprise')
                RETURNING id
            `;

            userId = newUsers[0].id;
            console.log('✅ Created demo user:', DEMO_EMAIL);
        }

        // Check if demo project exists  
        const existingProjects = await sql`SELECT id FROM projects WHERE name = 'Demo Project' LIMIT 1`;

        let projectId: string;

        if (existingProjects.length > 0) {
            console.log('✅ Demo project already exists');
            projectId = existingProjects[0].id;
        } else {
            // Create demo project
            const newProjects = await sql`
                INSERT INTO projects (user_id, name, description, type, platform, is_active)
                VALUES (${userId}, 'Demo Project', 'Sample project for testing and demonstration', 'web', 'chrome', true)
                RETURNING id
            `;

            projectId = newProjects[0].id;
            console.log('✅ Created demo project');
        }

        // Check if sample test cases exist
        const existingCases = await sql`SELECT id FROM test_cases WHERE project_id = ${projectId} LIMIT 1`;

        if (existingCases.length === 0) {
            // Create sample test cases
            await sql`
                INSERT INTO test_cases (project_id, user_id, name, description, type, platform, test_data, tags, is_active)
                VALUES 
                    (${projectId}, ${userId}, 'Verify login with valid credentials', 'Test that users can login with correct email and password', 'Functional', 'web', '{"status": "Active", "priority": "High", "jiraIssue": "AUTH-123"}', '["login", "authentication"]', true),
                    (${projectId}, ${userId}, 'Verify login with invalid credentials', 'Test that error is shown for invalid login attempts', 'Functional', 'web', '{"status": "Active", "priority": "High"}', '["login", "negative"]', true),
                    (${projectId}, ${userId}, 'Check password reset functionality', 'Verify users can request and complete password reset', 'Functional', 'web', '{"status": "Draft", "priority": "Medium"}', '["password"]', true),
                    (${projectId}, ${userId}, 'Verify user profile update', 'Test that users can update their profile information', 'Functional', 'web', '{"status": "Active", "priority": "Medium", "jiraIssue": "USER-456"}', '["profile"]', true),
                    (${projectId}, ${userId}, 'Test checkout process with credit card', 'End-to-end test for complete checkout flow', 'E2E', 'web', '{"status": "Active", "priority": "Critical", "jiraIssue": "PAY-789"}', '["checkout", "payment"]', true)
            `;
            console.log('✅ Created 5 sample test cases');
        } else {
            console.log('✅ Sample test cases already exist');
        }

        console.log('');
        console.log('🎉 Database seed completed successfully!');
        console.log('');
        console.log('📧 Demo credentials:');
        console.log(`   Email: ${DEMO_EMAIL}`);
        console.log(`   Password: ${DEMO_PASSWORD}`);
        console.log('');

        await sql.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Seed failed:', error);
        await sql.end();
        process.exit(1);
    }
}

seed();
