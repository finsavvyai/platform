export interface Table {
  name: string;
  schema?: string;
  columns: Column[];
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface AutocompleteItem {
  label: string;
  type: 'keyword' | 'table' | 'column' | 'function' | 'snippet';
  description?: string;
  insertText: string;
  detail?: string;
  documentation?: string;
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'ALL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER',
  'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'AS', 'WITH',
  'UNION', 'INTERSECT', 'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
  'CASCADE', 'RESTRICT', 'NO ACTION', 'SET NULL', 'SET DEFAULT'
];

const SQL_FUNCTIONS = [
  { name: 'COUNT', signature: 'COUNT(expression)', description: 'Returns the number of rows' },
  { name: 'SUM', signature: 'SUM(expression)', description: 'Returns the sum of values' },
  { name: 'AVG', signature: 'AVG(expression)', description: 'Returns the average value' },
  { name: 'MIN', signature: 'MIN(expression)', description: 'Returns the minimum value' },
  { name: 'MAX', signature: 'MAX(expression)', description: 'Returns the maximum value' },
  { name: 'UPPER', signature: 'UPPER(string)', description: 'Converts string to uppercase' },
  { name: 'LOWER', signature: 'LOWER(string)', description: 'Converts string to lowercase' },
  { name: 'TRIM', signature: 'TRIM(string)', description: 'Removes leading and trailing spaces' },
  { name: 'LENGTH', signature: 'LENGTH(string)', description: 'Returns the length of a string' },
  { name: 'SUBSTRING', signature: 'SUBSTRING(string, start, length)', description: 'Extracts a substring' },
  { name: 'CONCAT', signature: 'CONCAT(string1, string2, ...)', description: 'Concatenates strings' },
  { name: 'NOW', signature: 'NOW()', description: 'Returns current date and time' },
  { name: 'DATE', signature: 'DATE(expression)', description: 'Extracts the date part' },
  { name: 'YEAR', signature: 'YEAR(date)', description: 'Returns the year' },
  { name: 'MONTH', signature: 'MONTH(date)', description: 'Returns the month' },
  { name: 'DAY', signature: 'DAY(date)', description: 'Returns the day' },
  { name: 'COALESCE', signature: 'COALESCE(value1, value2, ...)', description: 'Returns first non-null value' },
  { name: 'CAST', signature: 'CAST(expression AS type)', description: 'Converts expression to specified type' },
];

const SQL_SNIPPETS = [
  {
    label: 'select',
    insertText: 'SELECT * FROM ',
    description: 'Basic SELECT statement'
  },
  {
    label: 'select where',
    insertText: 'SELECT * FROM ${1:table} WHERE ${2:condition}',
    description: 'SELECT with WHERE clause'
  },
  {
    label: 'inner join',
    insertText: 'INNER JOIN ${1:table} ON ${2:condition}',
    description: 'INNER JOIN clause'
  },
  {
    label: 'left join',
    insertText: 'LEFT JOIN ${1:table} ON ${2:condition}',
    description: 'LEFT JOIN clause'
  },
  {
    label: 'insert',
    insertText: 'INSERT INTO ${1:table} (${2:columns}) VALUES (${3:values})',
    description: 'INSERT statement'
  },
  {
    label: 'update',
    insertText: 'UPDATE ${1:table} SET ${2:column} = ${3:value} WHERE ${4:condition}',
    description: 'UPDATE statement'
  },
  {
    label: 'delete',
    insertText: 'DELETE FROM ${1:table} WHERE ${2:condition}',
    description: 'DELETE statement'
  },
  {
    label: 'create table',
    insertText: `CREATE TABLE \${1:table_name} (
  id SERIAL PRIMARY KEY,
  \${2:column_name} \${3:data_type},
  created_at TIMESTAMP DEFAULT NOW()
)`,
    description: 'CREATE TABLE statement'
  },
];

export class SQLAutocomplete {
  private tables: Table[] = [];
  private currentSchema?: string;

  setTables(tables: Table[]) {
    this.tables = tables;
  }

  setCurrentSchema(schema: string) {
    this.currentSchema = schema;
  }

  getTables(): Table[] {
    return this.tables;
  }

  getTableByName(tableName: string): Table | undefined {
    return this.tables.find(t =>
      t.name.toLowerCase() === tableName.toLowerCase()
    );
  }

  getSuggestions(text: string, cursorPosition: number): AutocompleteItem[] {
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastWord = this.getLastWord(textBeforeCursor);
    const context = this.getContext(textBeforeCursor);

    const suggestions: AutocompleteItem[] = [];

    // Check if user is typing @ for table reference
    if (lastWord.startsWith('@')) {
      const searchTerm = lastWord.substring(1).toLowerCase();
      return this.tables
        .filter(t => t.name.toLowerCase().includes(searchTerm))
        .map(t => ({
          label: `@${t.name}`,
          type: 'table' as const,
          description: `Table with ${t.columns.length} columns`,
          insertText: t.name,
          detail: t.schema ? `Schema: ${t.schema}` : undefined,
          documentation: this.getTableDocumentation(t),
        }));
    }

    // Table suggestions after FROM, JOIN, INTO, UPDATE
    if (context.expectsTable) {
      suggestions.push(...this.getTableSuggestions(lastWord));
    }

    // Column suggestions after SELECT, WHERE, ON, SET
    if (context.expectsColumn) {
      suggestions.push(...this.getColumnSuggestions(lastWord, context.currentTable));
    }

    // Function suggestions
    if (context.expectsFunction || lastWord.length > 0) {
      suggestions.push(...this.getFunctionSuggestions(lastWord));
    }

    // Keyword suggestions
    if (!context.expectsColumn || lastWord.length > 0) {
      suggestions.push(...this.getKeywordSuggestions(lastWord));
    }

    // Snippet suggestions
    if (context.isNewStatement) {
      suggestions.push(...this.getSnippetSuggestions(lastWord));
    }

    // Sort by relevance
    return this.sortSuggestions(suggestions, lastWord);
  }

  private getLastWord(text: string): string {
    const match = text.match(/[@\w]+$/);
    return match ? match[0] : '';
  }

  private getContext(text: string): {
    expectsTable: boolean;
    expectsColumn: boolean;
    expectsFunction: boolean;
    isNewStatement: boolean;
    currentTable?: string;
  } {
    const upperText = text.toUpperCase();
    const tokens = text.split(/\s+/);

    // Check what comes before cursor
    const lastKeywords = tokens.slice(-5).join(' ').toUpperCase();

    const expectsTable = /\b(FROM|JOIN|INTO|UPDATE)\s+[@\w]*$/i.test(text);
    const expectsColumn = /\b(SELECT|WHERE|ON|SET|ORDER BY|GROUP BY)\s+[@\w]*$/i.test(text) ||
                          /,\s*[@\w]*$/.test(text);
    const expectsFunction = /\(\s*[@\w]*$/.test(text);
    const isNewStatement = text.trim().length === 0 || /;\s*[@\w]*$/.test(text);

    // Try to determine current table context
    let currentTable: string | undefined;
    const fromMatch = text.match(/FROM\s+(\w+)/i);
    if (fromMatch) {
      currentTable = fromMatch[1];
    }

    return {
      expectsTable,
      expectsColumn,
      expectsFunction,
      isNewStatement,
      currentTable,
    };
  }

  private getTableSuggestions(searchTerm: string): AutocompleteItem[] {
    const term = searchTerm.toLowerCase();
    return this.tables
      .filter(t => t.name.toLowerCase().includes(term))
      .map(t => ({
        label: t.name,
        type: 'table' as const,
        description: `${t.columns.length} columns`,
        insertText: t.name,
        detail: t.schema ? `Schema: ${t.schema}` : undefined,
        documentation: this.getTableDocumentation(t),
      }));
  }

  private getColumnSuggestions(searchTerm: string, tableName?: string): AutocompleteItem[] {
    const term = searchTerm.toLowerCase();
    const suggestions: AutocompleteItem[] = [];

    // If we know the table context, prioritize its columns
    if (tableName) {
      const table = this.getTableByName(tableName);
      if (table) {
        suggestions.push(
          ...table.columns
            .filter(c => c.name.toLowerCase().includes(term))
            .map(c => ({
              label: c.name,
              type: 'column' as const,
              description: c.type,
              insertText: c.name,
              detail: `${table.name}.${c.name}`,
              documentation: this.getColumnDocumentation(c),
            }))
        );
      }
    }

    // Add columns from all tables
    this.tables.forEach(table => {
      table.columns
        .filter(c => c.name.toLowerCase().includes(term))
        .forEach(column => {
          suggestions.push({
            label: `${table.name}.${column.name}`,
            type: 'column' as const,
            description: column.type,
            insertText: `${table.name}.${column.name}`,
            detail: table.schema ? `${table.schema}.${table.name}` : undefined,
            documentation: this.getColumnDocumentation(column),
          });
        });
    });

    return suggestions;
  }

  private getKeywordSuggestions(searchTerm: string): AutocompleteItem[] {
    const term = searchTerm.toUpperCase();
    return SQL_KEYWORDS
      .filter(kw => kw.startsWith(term) || (term.length > 0 && kw.includes(term)))
      .map(kw => ({
        label: kw,
        type: 'keyword' as const,
        description: 'SQL Keyword',
        insertText: kw,
      }));
  }

  private getFunctionSuggestions(searchTerm: string): AutocompleteItem[] {
    const term = searchTerm.toUpperCase();
    return SQL_FUNCTIONS
      .filter(fn => fn.name.startsWith(term) || (term.length > 0 && fn.name.includes(term)))
      .map(fn => ({
        label: fn.name,
        type: 'function' as const,
        description: fn.description,
        insertText: fn.signature,
        detail: 'Function',
      }));
  }

  private getSnippetSuggestions(searchTerm: string): AutocompleteItem[] {
    const term = searchTerm.toLowerCase();
    return SQL_SNIPPETS
      .filter(s => s.label.startsWith(term) || (term.length > 0 && s.label.includes(term)))
      .map(s => ({
        label: s.label,
        type: 'snippet' as const,
        description: s.description,
        insertText: s.insertText,
      }));
  }

  private sortSuggestions(suggestions: AutocompleteItem[], searchTerm: string): AutocompleteItem[] {
    const term = searchTerm.toLowerCase();

    return suggestions.sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();

      // Exact matches first
      if (aLabel === term && bLabel !== term) return -1;
      if (bLabel === term && aLabel !== term) return 1;

      // Starts with search term
      const aStarts = aLabel.startsWith(term);
      const bStarts = bLabel.startsWith(term);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      // Type priority: tables > columns > functions > keywords > snippets
      const typePriority = { table: 0, column: 1, function: 2, keyword: 3, snippet: 4 };
      const aPriority = typePriority[a.type];
      const bPriority = typePriority[b.type];
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Alphabetical
      return aLabel.localeCompare(bLabel);
    });
  }

  private getTableDocumentation(table: Table): string {
    const lines = [`**${table.name}**`, ''];
    if (table.schema) {
      lines.push(`Schema: ${table.schema}`, '');
    }
    lines.push('Columns:');
    table.columns.forEach(col => {
      const badges = [];
      if (col.isPrimaryKey) badges.push('PK');
      if (col.isForeignKey) badges.push('FK');
      if (!col.nullable) badges.push('NOT NULL');

      lines.push(`- ${col.name}: ${col.type}${badges.length ? ` [${badges.join(', ')}]` : ''}`);
    });
    return lines.join('\n');
  }

  private getColumnDocumentation(column: Column): string {
    const lines = [`**${column.name}**`, '', `Type: ${column.type}`];
    if (column.isPrimaryKey) lines.push('Primary Key');
    if (column.isForeignKey) lines.push('Foreign Key');
    if (!column.nullable) lines.push('NOT NULL');
    return lines.join('\n');
  }
}

export const sqlAutocomplete = new SQLAutocomplete();
