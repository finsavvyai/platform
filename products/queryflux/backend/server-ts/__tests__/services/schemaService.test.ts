import { formatSchemaForPrompt } from '../../services/schemaService';
import type { SchemaInfo } from '../../types';

describe('formatSchemaForPrompt', () => {
  it('formats schema into readable text', () => {
    const schema: SchemaInfo = {
      databaseName: 'testdb',
      tables: [
        {
          name: 'users',
          schema: 'public',
          type: 'table',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'name', type: 'varchar', nullable: false, isPrimaryKey: false },
            { name: 'email', type: 'varchar', nullable: true, isPrimaryKey: false },
          ],
        },
        {
          name: 'orders',
          schema: 'public',
          type: 'table',
          columns: [
            { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
            { name: 'user_id', type: 'integer', nullable: false, isPrimaryKey: false },
            { name: 'total', type: 'decimal', nullable: false, isPrimaryKey: false },
          ],
        },
      ],
    };

    const result = formatSchemaForPrompt(schema);

    expect(result).toContain('Database: testdb');
    expect(result).toContain('Table: users');
    expect(result).toContain('id: integer NOT NULL [PK]');
    expect(result).toContain('name: varchar NOT NULL');
    expect(result).toContain('email: varchar NULL');
    expect(result).toContain('Table: orders');
    expect(result).toContain('user_id: integer NOT NULL');
  });

  it('handles empty schema', () => {
    const schema: SchemaInfo = { databaseName: 'empty', tables: [] };
    const result = formatSchemaForPrompt(schema);
    expect(result).toContain('Database: empty');
    expect(result).not.toContain('Table:');
  });
});
