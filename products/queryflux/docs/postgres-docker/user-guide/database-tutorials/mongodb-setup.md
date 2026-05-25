# MongoDB Setup Tutorial

This tutorial will guide you through connecting to MongoDB databases using the Multi-Database Manager.

## Prerequisites

- MongoDB server (local, remote, or cloud)
- Connection credentials (if authentication is enabled)
- Network access to MongoDB server

## Connection Setup

### Step 1: Open Connection Dialog

1. Launch Multi-Database Manager
2. Click "New Connection" or press `Cmd+N`
3. Select "MongoDB" from the database type dropdown

### Step 2: Configure Connection Parameters

**Basic Settings**:
- **Connection Name**: Descriptive name for your connection
- **Host**: MongoDB server address
  - Local: `localhost` or `127.0.0.1`
  - Remote: Server IP or hostname
  - Replica Set: Comma-separated list of hosts
- **Port**: Default is `27017`
- **Database**: Target database name (optional)
- **Username**: MongoDB username (if auth enabled)
- **Password**: User password (if auth enabled)

### Step 3: Advanced Configuration

Click "Advanced" for additional options:

**Authentication**:
- **Auth Database**: Authentication database (usually 'admin')
- **Auth Mechanism**: SCRAM-SHA-1, SCRAM-SHA-256, MONGODB-CR
- **Auth Source**: Source database for authentication

**Connection Options**:
- **Connection Timeout**: Timeout in milliseconds
- **Socket Timeout**: Socket timeout in milliseconds
- **SSL**: Enable SSL/TLS encryption
- **Read Preference**: primary, secondary, nearest

**Replica Set**:
- **Replica Set Name**: Name of the replica set
- **Read Concern**: local, available, majority, linearizable
- **Write Concern**: Acknowledgment requirements

### Step 4: Test and Save

1. Click "Test Connection"
2. Verify successful connection
3. Save the connection profile

## MongoDB Connection Formats

### Standard Connection

```
mongodb://username:password@host:port/database
```

### Replica Set Connection

```
mongodb://username:password@host1:port1,host2:port2,host3:port3/database?replicaSet=myReplicaSet
```

### SSL Connection

```
mongodb://username:password@host:port/database?ssl=true
```

### Connection with Options

```
mongodb://username:password@host:port/database?authSource=admin&readPreference=secondary
```

## Docker MongoDB Setup

### Single Instance

1. Open Docker panel in Multi-Database Manager
2. Click "New Container"
3. Select "MongoDB" template
4. Configure settings:
   - **Container Name**: `mongodb-dev`
   - **Port**: `27017`
   - **Database**: Optional initial database
   - **Username**: Admin username
   - **Password**: Admin password

### Manual Docker Setup

```bash
# MongoDB without authentication
docker run --name mongodb-dev \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -d mongo:6.0

# MongoDB with authentication
docker run --name mongodb-auth \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  -e MONGO_INITDB_DATABASE=mydb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  -d mongo:6.0
```

### Replica Set Setup

For development replica set:

```bash
# Create network
docker network create mongodb-network

# Start three MongoDB instances
docker run --name mongo1 --network mongodb-network \
  -p 27017:27017 \
  -d mongo:6.0 --replSet rs0

docker run --name mongo2 --network mongodb-network \
  -p 27018:27017 \
  -d mongo:6.0 --replSet rs0

docker run --name mongo3 --network mongodb-network \
  -p 27019:27017 \
  -d mongo:6.0 --replSet rs0

# Initialize replica set
docker exec -it mongo1 mongosh --eval "
rs.initiate({
  _id: 'rs0',
  members: [
    {_id: 0, host: 'mongo1:27017'},
    {_id: 1, host: 'mongo2:27017'},
    {_id: 2, host: 'mongo3:27017'}
  ]
})
"
```

## Cloud MongoDB Setup

### MongoDB Atlas

1. Create cluster in MongoDB Atlas
2. Get connection string from Atlas dashboard
3. Whitelist your IP address
4. Create database user
5. Use connection string in Multi-Database Manager:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database
   ```

### AWS DocumentDB

1. Create DocumentDB cluster in AWS
2. Configure security groups
3. Get cluster endpoint
4. Use connection format:
   ```
   mongodb://username:password@cluster-endpoint:27017/database?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred
   ```

### Azure Cosmos DB

1. Create Cosmos DB account with MongoDB API
2. Get connection string from Azure portal
3. Use provided connection string format

## Authentication and Security

### Creating Users

Connect as admin and create users:

```javascript
// Switch to admin database
use admin

// Create admin user
db.createUser({
  user: "admin",
  pwd: "securePassword",
  roles: ["userAdminAnyDatabase", "dbAdminAnyDatabase", "readWriteAnyDatabase"]
})

// Create database-specific user
use myDatabase
db.createUser({
  user: "appUser",
  pwd: "appPassword",
  roles: ["readWrite"]
})
```

### Role-Based Access Control

Common roles:
- **read**: Read data from database
- **readWrite**: Read and write data
- **dbAdmin**: Database administration
- **userAdmin**: User management
- **clusterAdmin**: Cluster administration

### SSL/TLS Configuration

For SSL connections:
1. Enable SSL in connection dialog
2. Provide certificate files if using custom CA
3. Set SSL mode (allow, prefer, require)

## Working with MongoDB Data

### Document Structure

MongoDB stores data as BSON documents:

```javascript
{
  "_id": ObjectId("..."),
  "name": "John Doe",
  "age": 30,
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "zipcode": "10001"
  },
  "hobbies": ["reading", "swimming", "coding"]
}
```

### Data Types

Supported BSON types:
- String
- Number (Integer, Double, Decimal128)
- Boolean
- Date
- ObjectId
- Array
- Object (Embedded Document)
- Binary Data
- Regular Expression
- JavaScript Code

### Querying Data

Use the query builder or write MongoDB queries:

```javascript
// Find documents
db.collection.find({name: "John Doe"})

// Find with conditions
db.collection.find({age: {$gte: 18, $lt: 65}})

// Find with projection
db.collection.find({}, {name: 1, age: 1, _id: 0})

// Sort and limit
db.collection.find().sort({age: -1}).limit(10)
```

## Import and Export

### Supported Formats

**Import**:
- JSON documents
- CSV files (converted to documents)
- BSON dumps
- MongoDB archive files

**Export**:
- JSON documents
- CSV format
- BSON dumps
- MongoDB archive

### Import Process

1. Right-click collection in schema browser
2. Select "Import Data"
3. Choose file format and source
4. Configure field mapping
5. Set import options:
   - **Upsert**: Update existing documents
   - **Drop Collection**: Replace existing data
   - **Ignore Errors**: Continue on errors

### Export Process

1. Select collection or use custom query
2. Choose export format
3. Configure options:
   - **Pretty Print**: Format JSON output
   - **Include Metadata**: Export with type information
   - **Compression**: Compress output file

### Command Line Tools

MongoDB provides command-line tools:

```bash
# Import JSON data
mongoimport --db mydb --collection mycollection --file data.json

# Export to JSON
mongoexport --db mydb --collection mycollection --out data.json

# Create database dump
mongodump --db mydb --out backup/

# Restore from dump
mongorestore --db mydb backup/mydb/
```

## Performance Optimization

### Indexing

Create indexes for better query performance:

```javascript
// Create single field index
db.collection.createIndex({name: 1})

// Create compound index
db.collection.createIndex({name: 1, age: -1})

// Create text index for search
db.collection.createIndex({title: "text", content: "text"})

// Create partial index
db.collection.createIndex(
  {age: 1},
  {partialFilterExpression: {age: {$gte: 18}}}
)
```

### Query Optimization

Use explain to analyze queries:

```javascript
// Explain query execution
db.collection.find({name: "John"}).explain("executionStats")

// Use hint to force index usage
db.collection.find({name: "John"}).hint({name: 1})
```

### Aggregation Pipeline

For complex data processing:

```javascript
db.collection.aggregate([
  {$match: {age: {$gte: 18}}},
  {$group: {_id: "$department", avgAge: {$avg: "$age"}}},
  {$sort: {avgAge: -1}}
])
```

## Monitoring and Maintenance

### Database Statistics

```javascript
// Database stats
db.stats()

// Collection stats
db.collection.stats()

// Index stats
db.collection.getIndexes()
```

### Performance Monitoring

Use the built-in monitoring dashboard to track:
- Connection count
- Query execution times
- Index usage
- Resource utilization

### Maintenance Tasks

**Compact Collections**:
```javascript
db.runCommand({compact: "collectionName"})
```

**Repair Database**:
```javascript
db.repairDatabase()
```

**Validate Collection**:
```javascript
db.collection.validate()
```

## Troubleshooting

### Common Connection Issues

**Issue**: "Authentication failed"
**Solutions**:
1. Verify username and password
2. Check authentication database
3. Ensure user exists and has proper roles
4. Verify authentication mechanism

**Issue**: "Connection timeout"
**Solutions**:
1. Check network connectivity
2. Verify MongoDB service is running
3. Check firewall settings
4. Increase connection timeout

**Issue**: "SSL handshake failed"
**Solutions**:
1. Verify SSL certificate
2. Check SSL configuration
3. Ensure proper SSL mode
4. Update certificate trust settings

### Performance Issues

**Slow Queries**:
1. Use explain() to analyze queries
2. Check for proper indexes
3. Review query structure
4. Consider aggregation pipeline optimization

**High Memory Usage**:
1. Monitor working set size
2. Review index usage
3. Optimize document structure
4. Consider sharding for large datasets

### Data Issues

**Document Validation Errors**:
1. Check schema validation rules
2. Verify document structure
3. Review data types
4. Update validation schema if needed

## Best Practices

### Schema Design
- Embed related data when possible
- Use references for large or frequently changing data
- Design for your query patterns
- Consider document size limits (16MB)

### Indexing Strategy
- Create indexes for frequent queries
- Use compound indexes effectively
- Monitor index usage
- Remove unused indexes

### Security
- Enable authentication
- Use role-based access control
- Enable SSL/TLS for remote connections
- Regular security updates
- Monitor access logs

### Performance
- Use appropriate read/write concerns
- Implement proper error handling
- Monitor and optimize queries
- Consider sharding for horizontal scaling

## Additional Resources

- [MongoDB Official Documentation](https://docs.mongodb.com/)
- [MongoDB University](https://university.mongodb.com/)
- [MongoDB Performance Best Practices](https://docs.mongodb.com/manual/administration/analyzing-mongodb-performance/)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)

For Multi-Database Manager specific issues, contact our support team.