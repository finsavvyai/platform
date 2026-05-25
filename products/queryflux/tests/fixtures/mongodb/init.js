// MongoDB Test Database Schema
// Create test collections and indexes for QueryFlux testing

db = db.getSiblingDB('queryflux_test');

// Create users collection
db.users.insertMany([
    {
        _id: ObjectId("507f1f77bcf86cd799439011"),
        username: "testuser",
        email: "test@example.com",
        created_at: new Date(),
        is_active: true
    },
    {
        _id: ObjectId("507f1f77bcf86cd799439012"),
        username: "admin",
        email: "admin@example.com",
        created_at: new Date(),
        is_active: true
    }
]);

// Create connections collection
db.connections.insertMany([
    {
        _id: ObjectId("507f1f77bcf86cd799439013"),
        user_id: ObjectId("507f1f77bcf86cd799439011"),
        name: "Test PostgreSQL",
        database_type: "postgresql",
        host: "localhost",
        port: 5432,
        database_name: "queryflux_test",
        username: "testuser",
        password_encrypted: "encrypted_password",
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        _id: ObjectId("507f1f77bcf86cd799439014"),
        user_id: ObjectId("507f1f77bcf86cd799439011"),
        name: "Test Redis",
        database_type: "redis",
        host: "localhost",
        port: 6379,
        created_at: new Date(),
        updated_at: new Date()
    }
]);

// Create queries collection
db.queries.insertMany([
    {
        _id: ObjectId("507f1f77bcf86cd799439015"),
        user_id: ObjectId("507f1f77bcf86cd799439011"),
        connection_id: ObjectId("507f1f77bcf86cd799439013"),
        query_text: "SELECT * FROM users WHERE is_active = true",
        query_type: "SELECT",
        execution_time_ms: 45,
        rows_affected: 2,
        executed_at: new Date()
    },
    {
        _id: ObjectId("507f1f77bcf86cd799439016"),
        user_id: ObjectId("507f1f77bcf86cd799439011"),
        connection_id: ObjectId("507f1f77bcf86cd799439013"),
        query_text: "SELECT COUNT(*) FROM connections",
        query_type: "AGGREGATE",
        execution_time_ms: 12,
        rows_affected: 1,
        executed_at: new Date()
    }
]);

// Create indexes
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ created_at: 1 });
db.users.createIndex({ is_active: 1 });

db.connections.createIndex({ user_id: 1 });
db.connections.createIndex({ database_type: 1 });
db.connections.createIndex({ created_at: 1 });

db.queries.createIndex({ user_id: 1 });
db.queries.createIndex({ connection_id: 1 });
db.queries.createIndex({ executed_at: 1 });
db.queries.createIndex({ query_type: 1 });

// Create text indexes for search
db.users.createIndex({ username: "text", email: "text" });
db.connections.createIndex({ name: "text", database_type: "text" });
db.queries.createIndex({ query_text: "text" });