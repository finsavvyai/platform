// MongoDB test database initialization script
// Creates test collections and documents for integration testing

// Switch to test database
db = db.getSiblingDB('test_db');

// Create test collections
db.createCollection('test_table');
db.createCollection('schema_test');
db.createCollection('departments');
db.createCollection('employees');
db.createCollection('index_test');
db.createCollection('array_test');
db.createCollection('nested_test');

// Insert sample data into test_table
db.test_table.insertMany([
  {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    salary: 75000.00,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    metadata: {
      department: 'engineering',
      level: 'senior',
      skills: ['javascript', 'python', 'react']
    },
    tags: ['developer', 'fullstack']
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    age: 28,
    salary: 68000.00,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    metadata: {
      department: 'design',
      level: 'mid',
      skills: ['ui', 'ux', 'figma']
    },
    tags: ['designer', 'ui']
  },
  {
    name: 'Bob Johnson',
    email: 'bob@example.com',
    age: 35,
    salary: 82000.00,
    is_active: false,
    created_at: new Date(),
    updated_at: new Date(),
    metadata: {
      department: 'engineering',
      level: 'lead',
      skills: ['java', 'spring', 'microservices']
    },
    tags: ['developer', 'backend', 'manager']
  },
  {
    name: 'Alice Brown',
    email: 'alice@example.com',
    age: 32,
    salary: 72000.00,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    metadata: {
      department: 'product',
      level: 'senior',
      skills: ['strategy', 'analytics', 'roadmap']
    },
    tags: ['product', 'strategy']
  },
  {
    name: 'Charlie Wilson',
    email: 'charlie@example.com',
    age: 29,
    salary: 65000.00,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    metadata: {
      department: 'engineering',
      level: 'junior',
      skills: ['html', 'css', 'javascript']
    },
    tags: ['developer', 'frontend']
  }
]);

// Insert department data
db.departments.insertMany([
  { name: 'Engineering', manager_id: null, created_at: new Date() },
  { name: 'Design', manager_id: null, created_at: new Date() },
  { name: 'Product', manager_id: null, created_at: new Date() },
  { name: 'Marketing', manager_id: null, created_at: new Date() },
  { name: 'Sales', manager_id: null, created_at: new Date() }
]);

// Insert employee data
db.employees.insertMany([
  {
    name: 'John Doe',
    department_id: 1,
    salary: 75000.00,
    hire_date: new Date('2020-01-15'),
    skills: ['javascript', 'python', 'react'],
    performance: {
      rating: 4.5,
      reviews: [
        { date: new Date('2023-01-01'), rating: 4, reviewer: 'manager1' },
        { date: new Date('2023-06-01'), rating: 5, reviewer: 'manager2' }
      ]
    }
  },
  {
    name: 'Jane Smith',
    department_id: 2,
    salary: 68000.00,
    hire_date: new Date('2021-03-20'),
    skills: ['ui', 'ux', 'figma'],
    performance: {
      rating: 4.2,
      reviews: [
        { date: new Date('2023-02-01'), rating: 4, reviewer: 'manager1' }
      ]
    }
  },
  {
    name: 'Bob Johnson',
    department_id: 1,
    salary: 82000.00,
    hire_date: new Date('2019-06-10'),
    skills: ['java', 'spring', 'microservices'],
    performance: {
      rating: 4.8,
      reviews: [
        { date: new Date('2023-01-15'), rating: 5, reviewer: 'manager1' },
        { date: new Date('2023-07-01'), rating: 5, reviewer: 'manager2' }
      ]
    }
  },
  {
    name: 'Alice Brown',
    department_id: 3,
    salary: 72000.00,
    hire_date: new Date('2020-09-05'),
    skills: ['strategy', 'analytics', 'roadmap'],
    performance: {
      rating: 4.6,
      reviews: [
        { date: new Date('2023-03-01'), rating: 5, reviewer: 'manager1' }
      ]
    }
  },
  {
    name: 'Charlie Wilson',
    department_id: 1,
    salary: 65000.00,
    hire_date: new Date('2022-02-14'),
    skills: ['html', 'css', 'javascript'],
    performance: {
      rating: 4.0,
      reviews: []
    }
  }
]);

// Insert schema test data
db.schema_test.insertMany([
  {
    text_col: 'Sample text',
    int_col: 42,
    float_col: 3.14159,
    date_col: new Date('2023-01-01'),
    time_col: new Date('2023-01-01T14:30:00Z'),
    timestamp_col: new Date(),
    bool_col: true,
    uuid_col: '550e8400-e29b-41d4-a716-446655440000',
    array_col: [1, 2, 3, 'four', { nested: 'object' }],
    null_col: null,
    undefined_col: undefined
  }
]);

// Create indexes for testing
db.test_table.createIndex({ email: 1 }, { unique: true });
db.test_table.createIndex({ name: 1 });
db.test_table.createIndex({ created_at: -1 });
db.test_table.createIndex({ 'metadata.department': 1 });
db.test_table.createIndex({ tags: 1 });

db.employees.createIndex({ department_id: 1 });
db.employees.createIndex({ salary: -1 });
db.employees.createIndex({ hire_date: -1 });
db.employees.createIndex({ 'performance.rating': -1 });
db.employees.createIndex({ skills: 1 });

// Create compound index
db.test_table.createIndex({ age: 1, salary: -1 });

// Create text index for search testing
db.test_table.createIndex({
  name: 'text',
  'metadata.skills': 'text',
  tags: 'text'
});

// Create geospatial index for location testing
db.locations_test.insertMany([
  {
    name: 'Office 1',
    location: { type: 'Point', coordinates: [-73.9857, 40.7484] }, // NYC
    address: '123 Main St, New York, NY'
  },
  {
    name: 'Office 2',
    location: { type: 'Point', coordinates: [-118.2437, 34.0522] }, // LA
    address: '456 Oak Ave, Los Angeles, CA'
  }
]);
db.locations_test.createIndex({ location: '2dsphere' });

// Create collection for testing aggregation pipelines
db.sales_test.insertMany([
  { product: 'laptop', quantity: 2, price: 1200, date: new Date('2023-01-01'), region: 'north' },
  { product: 'mouse', quantity: 5, price: 25, date: new Date('2023-01-02'), region: 'south' },
  { product: 'keyboard', quantity: 3, price: 75, date: new Date('2023-01-03'), region: 'east' },
  { product: 'monitor', quantity: 1, price: 300, date: new Date('2023-01-04'), region: 'west' },
  { product: 'laptop', quantity: 1, price: 1500, date: new Date('2023-01-05'), region: 'central' }
]);

// Create TTL index for testing document expiration
db.ttl_test.insertMany([
  { data: 'expires in 60 seconds', created_at: new Date() },
  { data: 'expires in 2 minutes', created_at: new Date(Date.now() - 30 * 1000) }
]);
db.ttl_test.createIndex({ created_at: 1 }, { expireAfterSeconds: 60 });

// Print summary
print('MongoDB test database initialized successfully');
print('Collections created: ' + db.getCollectionNames().join(', '));
print('Documents in test_table: ' + db.test_table.countDocuments());
print('Documents in employees: ' + db.employees.countDocuments());
print('Documents in departments: ' + db.departments.countDocuments());