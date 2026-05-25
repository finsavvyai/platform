/**
 * Dump File Analyzer Tests
 *
 * Comprehensive test suite for the Dump File Analyzer component.
 */

import { DumpFileAnalyzer } from '../processors/DumpFileAnalyzer';
import { mockConfig, mockDumpFiles, createMockFile } from './setup';

describe('DumpFileAnalyzer', () => {
  let analyzer: DumpFileAnalyzer;

  beforeEach(() => {
    analyzer = new DumpFileAnalyzer(mockConfig);
  });

  describe('SQL File Analysis', () => {
    test('should analyze simple SQL schema', async () => {
      const file = createMockFile(mockDumpFiles.simpleSQL, 'simple.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result).toEqual(
        expect.objectContaining({
          fileName: 'simple.sql',
          fileType: 'sql',
          size: expect.any(Number),
          tableCount: expect.any(Number),
          totalRows: expect.any(Number),
          estimatedSchema: expect.objectContaining({
            databaseName: expect.any(String),
            version: expect.any(String),
            tables: expect.any(Array),
            relationships: expect.any(Array),
            dataTypes: expect.any(Array),
            normalizationLevel: expect.any(String)
          }),
          dataPatterns: expect.any(Array),
          indexes: expect.any(Array),
          constraints: expect.any(Array),
          triggers: expect.any(Array),
          storedProcedures: expect.any(Array),
          complexity: expect.any(String)
        })
      );

      expect(result.tableCount).toBe(2); // users and posts tables
      expect(result.complexity).toBe('simple');
    });

    test('should analyze complex SQL schema', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'complex.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.tableCount).toBe(5); // customers, categories, products, orders, order_items
      expect(result.indexes.length).toBeGreaterThan(0);
      expect(result.constraints.length).toBeGreaterThan(0);
      expect(result.complexity).toMatch(/^(moderate|complex)$/);
    });

    test('should extract table relationships correctly', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'relationships.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.estimatedSchema.relationships.length).toBeGreaterThan(0);

      const relationships = result.estimatedSchema.relationships;
      expect(relationships.some(rel =>
        rel.sourceTable === 'order_items' &&
        rel.targetTable === 'orders'
      )).toBe(true);
    });

    test('should analyze table structures correctly', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'structure.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const ordersTable = result.estimatedSchema.tables.find(t => t.name === 'orders');
      expect(ordersTable).toBeDefined();
      expect(ordersTable?.columns.length).toBeGreaterThan(0);
      expect(ordersTable?.primaryKeys.length).toBeGreaterThan(0);
      expect(ordersTable?.foreignKeys.length).toBeGreaterThan(0);
    });

    test('should analyze data types correctly', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'datatypes.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.estimatedSchema.dataTypes.length).toBeGreaterThan(0);

      const dataTypes = result.estimatedSchema.dataTypes;
      expect(dataTypes.some(dt => dt.dataType.toLowerCase().includes('varchar'))).toBe(true);
      expect(dataTypes.some(dt => dt.dataType.toLowerCase().includes('integer'))).toBe(true);
      expect(dataTypes.some(dt => dt.dataType.toLowerCase().includes('timestamp'))).toBe(true);
    });

    test('should detect normalization level', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'normalization.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.estimatedSchema.normalizationLevel).toMatch(/^(1nf|2nf|3nf|bcnf)$/);
    });
  });

  describe('JSON File Analysis', () => {
    test('should analyze JSON schema structure', async () => {
      const file = createMockFile(mockDumpFiles.jsonStructure, 'schema.json', 'application/json');
      const result = await analyzer.analyze(file);

      expect(result.fileType).toBe('json');
      expect(result.tableCount).toBeGreaterThan(0);
    });

    test('should handle nested JSON structures', async () => {
      const nestedJSON = JSON.stringify({
        users: {
          profile: {
            personal: { name: 'string', age: 'number' },
            preferences: { theme: 'string', notifications: 'boolean' }
          }
        }
      });

      const file = createMockFile(nestedJSON, 'nested.json', 'application/json');
      const result = await analyzer.analyze(file);

      expect(result).toBeDefined();
      expect(result.complexity).toMatch(/^(moderate|complex)$/);
    });
  });

  describe('CSV File Analysis', () => {
    test('should analyze CSV structure', async () => {
      const file = createMockFile(mockDumpFiles.csvContent, 'data.csv', 'text/csv');
      const result = await analyzer.analyze(file);

      expect(result.fileType).toBe('csv');
      expect(result.tableCount).toBe(1);

      const table = result.estimatedSchema.tables[0];
      expect(table.columns.length).toBe(4); // id, name, email, created_at
      expect(table.estimatedRows).toBe(3);
    });

    test('should infer data types from CSV content', async () => {
      const file = createMockFile(mockDumpFiles.csvContent, 'types.csv', 'text/csv');
      const result = await analyzer.analyze(file);

      const table = result.estimatedSchema.tables[0];
      const idColumn = table.columns.find(c => c.name === 'id');
      const nameColumn = table.columns.find(c => c.name === 'name');
      const dateColumn = table.columns.find(c => c.name === 'created_at');

      expect(idColumn?.type).toMatch(/integer|number/);
      expect(nameColumn?.type).toMatch(/varchar|string/);
      expect(dateColumn?.type).toMatch(/timestamp|datetime/);
    });
  });

  describe('Data Pattern Recognition', () => {
    test('should detect temporal data patterns', async () => {
      const temporalSQL = `
        CREATE TABLE events (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          event_date DATE
        );
        CREATE INDEX idx_events_created_at ON events(created_at);
      `;

      const file = createMockFile(temporalSQL, 'temporal.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const temporalPattern = result.dataPatterns.find(p => p.type === 'temporal');
      expect(temporalPattern).toBeDefined();
      expect(temporalPattern?.confidence).toBeGreaterThan(0.7);
    });

    test('should detect hierarchical data patterns', async () => {
      const hierarchicalSQL = `
        CREATE TABLE categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          parent_id INTEGER REFERENCES categories(id),
          level INTEGER,
          path TEXT
        );
      `;

      const file = createMockFile(hierarchicalSQL, 'hierarchical.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const hierarchicalPattern = result.dataPatterns.find(p => p.type === 'hierarchical');
      expect(hierarchicalPattern).toBeDefined();
      expect(hierarchicalPattern?.confidence).toBeGreaterThan(0.6);
    });

    test('should detect network/graph patterns', async () => {
      const networkSQL = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        );
        CREATE TABLE friendships (
          user_id INTEGER REFERENCES users(id),
          friend_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, friend_id)
        );
        CREATE TABLE user_follows (
          follower_id INTEGER REFERENCES users(id),
          following_id INTEGER REFERENCES users(id),
          PRIMARY KEY (follower_id, following_id)
        );
      `;

      const file = createMockFile(networkSQL, 'network.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const networkPattern = result.dataPatterns.find(p => p.type === 'network');
      expect(networkPattern).toBeDefined();
      expect(networkPattern?.confidence).toBeGreaterThan(0.7);
    });

    test('should detect document patterns', async () => {
      const documentSQL = `
        CREATE TABLE articles (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          content TEXT,
          metadata JSONB,
          tags TEXT[]
        );
      `;

      const file = createMockFile(documentSQL, 'document.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const documentPattern = result.dataPatterns.find(p => p.type === 'document');
      expect(documentPattern).toBeDefined();
      expect(documentPattern?.confidence).toBeGreaterThan(0.5);
    });

    test('should detect geospatial patterns', async () => {
      const geoSQL = `
        CREATE TABLE locations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          coordinates POINT
        );
      `;

      const file = createMockFile(geoSQL, 'geo.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const geoPattern = result.dataPatterns.find(p => p.type === 'geospatial');
      expect(geoPattern).toBeDefined();
      expect(geoPattern?.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Index Analysis', () => {
    test('should extract index definitions', async () => {
      const indexSQL = `
        CREATE TABLE products (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          category_id INTEGER,
          price DECIMAL(10,2)
        );
        CREATE INDEX idx_products_name ON products(name);
        CREATE UNIQUE INDEX idx_products_category_name ON products(category_id, name);
        CREATE INDEX idx_products_price ON products(price) WHERE price > 100;
      `;

      const file = createMockFile(indexSQL, 'indexes.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.indexes.length).toBe(3);

      const nameIndex = result.indexes.find(i => i.name === 'idx_products_name');
      expect(nameIndex).toBeDefined();
      expect(nameIndex?.columns).toContain('name');
      expect(nameIndex?.unique).toBe(false);

      const uniqueIndex = result.indexes.find(i => i.name === 'idx_products_category_name');
      expect(uniqueIndex?.unique).toBe(true);
    });

    test('should estimate index selectivity', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'selectivity.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      result.indexes.forEach(index => {
        expect(index.estimatedSelectivity).toBeGreaterThan(0);
        expect(index.estimatedSelectivity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Constraint Analysis', () => {
    test('should extract primary key constraints', async () => {
      const file = createMockFile(mockDumpFiles.simpleSQL, 'constraints.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const pkConstraints = result.constraints.filter(c => c.type === 'primary_key');
      expect(pkConstraints.length).toBeGreaterThan(0);

      pkConstraints.forEach(constraint => {
        expect(constraint.columns.length).toBeGreaterThan(0);
        expect(constraint.enforced).toBe(true);
      });
    });

    test('should extract foreign key constraints', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'foreign_keys.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const fkConstraints = result.constraints.filter(c => c.type === 'foreign_key');
      expect(fkConstraints.length).toBeGreaterThan(0);

      fkConstraints.forEach(constraint => {
        expect(constraint.columns.length).toBe(1);
        expect(constraint.definition).toContain('REFERENCES');
      });
    });

    test('should extract unique constraints', async () => {
      const uniqueSQL = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          username VARCHAR(255) UNIQUE,
          CONSTRAINT unique_phone UNIQUE (phone)
        );
      `;

      const file = createMockFile(uniqueSQL, 'unique.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const uniqueConstraints = result.constraints.filter(c => c.type === 'unique');
      expect(uniqueConstraints.length).toBe(3);
    });
  });

  describe('Complexity Assessment', () => {
    test('should assess simple complexity correctly', async () => {
      const simpleSQL = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        );
      `;

      const file = createMockFile(simpleSQL, 'simple.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.complexity).toBe('simple');
    });

    test('should assess moderate complexity correctly', async () => {
      const file = createMockFile(mockDumpFiles.simpleSQL, 'moderate.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.complexity).toMatch(/^(simple|moderate)$/);
    });

    test('should assess high complexity correctly', async () => {
      const complexSQL = `
        CREATE TABLE table1 (id SERIAL PRIMARY KEY, data TEXT);
        CREATE TABLE table2 (id SERIAL PRIMARY KEY, table1_id INTEGER REFERENCES table1(id), data TEXT);
        CREATE TABLE table3 (id SERIAL PRIMARY KEY, table2_id INTEGER REFERENCES table2(id), data TEXT);
        CREATE TABLE table4 (id SERIAL PRIMARY KEY, table3_id INTEGER REFERENCES table3(id), data TEXT);
        CREATE TABLE table5 (id SERIAL PRIMARY KEY, table4_id INTEGER REFERENCES table4(id), data TEXT);

        CREATE TRIGGER trigger1 BEFORE INSERT ON table1 FOR EACH ROW EXECUTE FUNCTION func1();
        CREATE TRIGGER trigger2 BEFORE UPDATE ON table2 FOR EACH ROW EXECUTE FUNCTION func2();
        CREATE TRIGGER trigger3 AFTER DELETE ON table3 FOR EACH ROW EXECUTE FUNCTION func3();

        CREATE PROCEDURE proc1()
        LANGUAGE plpgsql
        AS $$
        BEGIN
          -- Complex procedure logic
        END;
        $$;

        CREATE PROCEDURE proc2()
        LANGUAGE plpgsql
        AS $$
        BEGIN
          -- More complex logic
        END;
        $$;
      `;

      const file = createMockFile(complexSQL, 'very_complex.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      expect(result.complexity).toMatch(/^(complex|very_complex)$/);
    });
  });

  describe('Error Handling', () => {
    test('should reject files that are too large', async () => {
      const largeContent = 'x'.repeat(101 * 1024 * 1024); // 101MB
      const largeFile = createMockFile(largeContent, 'large.sql', 'application/sql');

      await expect(analyzer.analyze(largeFile)).rejects.toThrow('File size exceeds 100MB limit');
    });

    test('should reject unsupported file formats', async () => {
      const unsupportedFile = createMockFile('some data', 'data.xyz', 'application/octet-stream');

      await expect(analyzer.analyze(unsupportedFile)).rejects.toThrow('Unsupported file format: .xyz');
    });

    test('should handle malformed SQL gracefully', async () => {
      const malformedSQL = 'INVALID SQL SYNTAX HERE';
      const file = createMockFile(malformedSQL, 'malformed.sql', 'application/sql');

      const result = await analyzer.analyze(file);
      expect(result).toBeDefined();
      expect(result.complexity).toBe('simple');
    });

    test('should handle empty files', async () => {
      const emptyFile = createMockFile('', 'empty.sql', 'application/sql');

      const result = await analyzer.analyze(empty);
      expect(result).toBeDefined();
      expect(result.tableCount).toBe(0);
    });

    test('should handle JSON parse errors', async () => {
      const invalidJSON = '{ invalid json content }';
      const file = createMockFile(invalidJSON, 'invalid.json', 'application/json');

      await expect(analyzer.analyze(file)).rejects.toThrow('Invalid JSON format');
    });
  });

  describe('Performance Estimates', () => {
    test('should estimate row counts from INSERT statements', async () => {
      const file = createMockFile(mockDumpFiles.simpleSQL, 'rows.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      result.estimatedSchema.tables.forEach(table => {
        expect(table.estimatedRows).toBeGreaterThan(0);
      });
    });

    test('should estimate table sizes correctly', async () => {
      const file = createMockFile(mockDumpFiles.complexSQL, 'sizes.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      result.estimatedSchema.tables.forEach(table => {
        expect(table.estimatedSize).toBeGreaterThan(0);
      });
    });

    test('should estimate growth rates', async () => {
      const logTableSQL = `
        CREATE TABLE audit_logs (
          id SERIAL PRIMARY KEY,
          action VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const file = createMockFile(logTableSQL, 'growth.sql', 'application/sql');
      const result = await analyzer.analyze(file);

      const logTable = result.estimatedSchema.tables.find(t => t.name === 'audit_logs');
      expect(logTable?.growthRate).toBe('high');
    });
  });

  describe('File Type Detection', () => {
    test('should detect SQL files correctly', async () => {
      const file = createMockFile('CREATE TABLE test (id INT);', 'test.sql');
      const result = await analyzer.analyze(file);
      expect(result.fileType).toBe('sql');
    });

    test('should detect JSON files correctly', async () => {
      const file = createMockFile('{"test": "data"}', 'test.json');
      const result = await analyzer.analyze(file);
      expect(result.fileType).toBe('json');
    });

    test('should detect CSV files correctly', async () => {
      const file = createMockFile('id,name\n1,test', 'test.csv');
      const result = await analyzer.analyze(file);
      expect(result.fileType).toBe('csv');
    });

    test('should detect file type from content when extension is ambiguous', async () => {
      const file = createMockFile('CREATE TABLE test (id INT);', 'test.dump');
      const result = await analyzer.analyze(file);
      expect(result.fileType).toBe('sql');
    });
  });
});
