import * as vscode from 'vscode';
import { DatabaseConnectionManager } from './connectionManager';

export interface SchemaObject {
    name: string;
    type: 'table' | 'view' | 'function' | 'procedure' | 'trigger' | 'index' | 'constraint';
    schema?: string;
    definition?: string;
    properties?: Record<string, any>;
}

export interface TableSchema {
    name: string;
    schema: string;
    columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        defaultValue?: any;
        primaryKey: boolean;
        foreignKey?: {
            table: string;
            column: string;
        };
        unique: boolean;
        check?: string;
        comment?: string;
    }>;
    indexes: Array<{
        name: string;
        columns: string[];
        unique: boolean;
        type: string;
    }>;
    constraints: Array<{
        name: string;
        type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
        definition: string;
    }>;
    triggers: Array<{
        name: string;
        event: string;
        timing: string;
        definition: string;
    }>;
    comment?: string;
}

export interface SchemaDifference {
    type: 'added' | 'removed' | 'modified';
    objectType: string;
    objectName: string;
    schema?: string;
    details?: {
        property?: string;
        oldValue?: any;
        newValue?: any;
        description: string;
    };
}

export interface ComparisonResult {
    sourceConnection: string;
    targetConnection: string;
    timestamp: Date;
    differences: SchemaDifference[];
    summary: {
        added: number;
        removed: number;
        modified: number;
        total: number;
    };
    objects: {
        source: SchemaObject[];
        target: SchemaObject[];
    };
}

export interface MigrationScript {
    id: string;
    name: string;
    description: string;
    sourceConnection: string;
    targetConnection: string;
    script: string;
    rollbackScript?: string;
    dependencies: string[];
    createdAt: Date;
    executedAt?: Date;
    status: 'pending' | 'executed' | 'failed' | 'rolled_back';
    error?: string;
}

export class SchemaComparison {
    private connectionManager: DatabaseConnectionManager;
    private migrations: MigrationScript[] = [];

    constructor(connectionManager: DatabaseConnectionManager) {
        this.connectionManager = connectionManager;
        this.loadMigrations();
    }

    /**
     * Compare schemas between two connections
     */
    async compareSchemas(
        sourceConnectionId: string,
        targetConnectionId: string,
        options: {
            includeData?: boolean;
            ignoreCase?: boolean;
            excludeSchemas?: string[];
            includeSchemas?: string[];
            objectTypes?: string[];
        } = {}
    ): Promise<ComparisonResult> {
        try {
            const sourceSchema = await this.getSchema(sourceConnectionId, options);
            const targetSchema = await this.getSchema(targetConnectionId, options);

            const differences = this.findDifferences(sourceSchema, targetSchema, options);
            const summary = this.calculateSummary(differences);

            const result: ComparisonResult = {
                sourceConnection: sourceConnectionId,
                targetConnection: targetConnectionId,
                timestamp: new Date(),
                differences,
                summary,
                objects: {
                    source: sourceSchema,
                    target: targetSchema
                }
            };

            return result;
        } catch (error) {
            throw new Error(`Schema comparison failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate migration script from comparison result
     */
    async generateMigrationScript(
        comparisonResult: ComparisonResult,
        options: {
            name: string;
            description: string;
            includeData?: boolean;
            dryRun?: boolean;
        }
    ): Promise<MigrationScript> {
        const script = this.buildMigrationScript(comparisonResult, options);
        const rollbackScript = this.buildRollbackScript(comparisonResult, options);

        const migration: MigrationScript = {
            id: this.generateId(),
            name: options.name,
            description: options.description,
            sourceConnection: comparisonResult.sourceConnection,
            targetConnection: comparisonResult.targetConnection,
            script,
            rollbackScript,
            dependencies: [],
            createdAt: new Date(),
            status: 'pending'
        };

        this.migrations.push(migration);
        await this.saveMigrations();

        return migration;
    }

    /**
     * Execute migration script
     */
    async executeMigration(migrationId: string, dryRun: boolean = false): Promise<{
        success: boolean;
        error?: string;
        executedCommands: string[];
    }> {
        const migration = this.migrations.find(m => m.id === migrationId);
        if (!migration) {
            throw new Error('Migration not found');
        }

        if (migration.status === 'executed') {
            throw new Error('Migration has already been executed');
        }

        try {
            const commands = this.parseMigrationScript(migration.script);
            const executedCommands: string[] = [];

            if (!dryRun) {
                for (const command of commands) {
                    await this.connectionManager.connect(migration.targetConnection);
                    await this.connectionManager.executeQuery(command);
                    executedCommands.push(command);
                }

                migration.status = 'executed';
                migration.executedAt = new Date();
            } else {
                executedCommands.push(...commands);
            }

            await this.saveMigrations();

            return {
                success: true,
                executedCommands
            };
        } catch (error) {
            migration.status = 'failed';
            migration.error = error instanceof Error ? error.message : String(error);
            await this.saveMigrations();

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                executedCommands: []
            };
        }
    }

    /**
     * Rollback migration
     */
    async rollbackMigration(migrationId: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        const migration = this.migrations.find(m => m.id === migrationId);
        if (!migration) {
            throw new Error('Migration not found');
        }

        if (migration.status !== 'executed') {
            throw new Error('Only executed migrations can be rolled back');
        }

        if (!migration.rollbackScript) {
            throw new Error('No rollback script available');
        }

        try {
            const commands = this.parseMigrationScript(migration.rollbackScript);
            
            for (const command of commands) {
                await this.connectionManager.connect(migration.targetConnection);
                await this.connectionManager.executeQuery(command);
            }

            migration.status = 'rolled_back';
            await this.saveMigrations();

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Get schema for a connection
     */
    private async getSchema(
        connectionId: string,
        options: any
    ): Promise<SchemaObject[]> {
        const connection = this.connectionManager.getConnection(connectionId);
        if (!connection) {
            throw new Error('Connection not found');
        }

        switch (connection.type) {
            case 'PostgreSQL':
                return this.getPostgreSQLSchema(connectionId, options);
            // MySQL not currently supported in configuration
            // case 'MySQL':
            //     return this.getMySQLSchema(connectionId, options);
            case 'MongoDB':
                return this.getMongoDBSchema(connectionId, options);
            default:
                throw new Error(`Schema extraction not supported for ${connection.type}`);
        }
    }

    /**
     * Get PostgreSQL schema
     */
    private async getPostgreSQLSchema(connectionId: string, options: any): Promise<SchemaObject[]> {
        const objects: SchemaObject[] = [];

        // Get tables
        const tablesQuery = `
            SELECT 
                t.table_name,
                t.table_schema,
                obj_description(c.oid) as comment
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog')
            ${options.includeSchemas ? `AND t.table_schema IN (${options.includeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
            ${options.excludeSchemas ? `AND t.table_schema NOT IN (${options.excludeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
        `;

        await this.connectionManager.connect(connectionId);
        const tables = await this.connectionManager.executeQuery(tablesQuery);

        for (const table of tables.rows) {
            const tableSchema = await this.getPostgreSQLTableSchema(connectionId, table.table_schema, table.table_name);
            objects.push({
                name: table.table_name,
                type: 'table',
                schema: table.table_schema,
                definition: JSON.stringify(tableSchema),
                properties: { comment: table.comment }
            });
        }

        // Get views
        const viewsQuery = `
            SELECT 
                v.table_name,
                v.table_schema,
                v.view_definition
            FROM information_schema.views v
            WHERE v.table_schema NOT IN ('information_schema', 'pg_catalog')
            ${options.includeSchemas ? `AND v.table_schema IN (${options.includeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
            ${options.excludeSchemas ? `AND v.table_schema NOT IN (${options.excludeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
        `;

        const views = await this.connectionManager.executeQuery(viewsQuery);

        for (const view of views.rows) {
            objects.push({
                name: view.table_name,
                type: 'view',
                schema: view.table_schema,
                definition: view.view_definition
            });
        }

        // Get functions
        const functionsQuery = `
            SELECT 
                p.proname as function_name,
                n.nspname as schema_name,
                pg_get_functiondef(p.oid) as definition
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname NOT IN ('information_schema', 'pg_catalog')
            ${options.includeSchemas ? `AND n.nspname IN (${options.includeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
            ${options.excludeSchemas ? `AND n.nspname NOT IN (${options.excludeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
        `;

        const functions = await this.connectionManager.executeQuery(functionsQuery);

        for (const func of functions.rows) {
            objects.push({
                name: func.function_name,
                type: 'function',
                schema: func.schema_name,
                definition: func.definition
            });
        }

        return objects;
    }

    /**
     * Get PostgreSQL table schema details
     */
    private async getPostgreSQLTableSchema(
        connectionId: string,
        schema: string,
        tableName: string
    ): Promise<TableSchema> {
        // Get columns
        const columnsQuery = `
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
                CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
                fk.foreign_table_name,
                fk.foreign_column_name,
                c.column_comment
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT ku.table_name, ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
            LEFT JOIN (
                SELECT 
                    ku.table_name, 
                    ku.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
                JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
            ) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
            WHERE c.table_schema = '${schema}' AND c.table_name = '${tableName}'
            ORDER BY c.ordinal_position
        `;

        const columns = await this.connectionManager.executeQuery(columnsQuery);

        // Get indexes
        const indexesQuery = `
            SELECT 
                i.indexname,
                i.indexdef,
                i.indisunique
            FROM pg_indexes i
            WHERE i.schemaname = '${schema}' AND i.tablename = '${tableName}'
        `;

        const indexes = await this.connectionManager.executeQuery(indexesQuery);

        return {
            name: tableName,
            schema,
            columns: columns.rows.map((col: any) => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES',
                defaultValue: col.column_default,
                primaryKey: col.is_primary_key,
                foreignKey: col.is_foreign_key ? {
                    table: col.foreign_table_name,
                    column: col.foreign_column_name
                } : undefined,
                unique: false, // Would need additional query
                comment: col.column_comment
            })),
            indexes: indexes.rows.map((idx: any) => ({
                name: idx.indexname,
                columns: [], // Would need to parse indexdef
                unique: idx.indisunique,
                type: 'btree' // Default type
            })),
            constraints: [],
            triggers: []
        };
    }

    /**
     * Get MySQL schema
     */
    private async getMySQLSchema(connectionId: string, options: any): Promise<SchemaObject[]> {
        const objects: SchemaObject[] = [];

        // Get tables
        const tablesQuery = `
            SELECT 
                table_name,
                table_schema,
                table_comment
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_type = 'BASE TABLE'
            ${options.includeSchemas ? `AND table_schema IN (${options.includeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
            ${options.excludeSchemas ? `AND table_schema NOT IN (${options.excludeSchemas.map((s: string) => `'${s}'`).join(',')})` : ''}
        `;

        await this.connectionManager.connect(connectionId);
        const tables = await this.connectionManager.executeQuery(tablesQuery);

        for (const table of tables.rows) {
            // MySQL table schema extraction not implemented yet
            objects.push({
                name: table.table_name,
                type: 'table',
                schema: table.table_schema,
                definition: '{}', // Placeholder for MySQL schema
                properties: { comment: table.table_comment }
            });
        }

        return objects;
    }

    /**
     * Get MySQL table schema details
     */
    private async getMySQLTableSchema(
        connectionId: string,
        schema: string,
        tableName: string
    ): Promise<TableSchema> {
        // Get columns
        const columnsQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                column_key,
                column_comment
            FROM information_schema.columns
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position
        `;

        const columnsQueryFormatted = columnsQuery.replace('$1', `'${schema}'`).replace('$2', `'${tableName}'`);
        const columns = await this.connectionManager.executeQuery(columnsQueryFormatted);

        return {
            name: tableName,
            schema,
            columns: columns.rows.map((col: any) => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES',
                defaultValue: col.column_default,
                primaryKey: col.column_key === 'PRI',
                unique: col.column_key === 'UNI',
                comment: col.column_comment
            })),
            indexes: [],
            constraints: [],
            triggers: []
        };
    }

    /**
     * Get MongoDB schema
     */
    private async getMongoDBSchema(connectionId: string, options: any): Promise<SchemaObject[]> {
        const objects: SchemaObject[] = [];

        // Get collections
        const collectionsQuery = 'db.runCommand("listCollections")';
        await this.connectionManager.connect(connectionId);
        const collections = await this.connectionManager.executeQuery(collectionsQuery);

        for (const collection of collections.rows) {
            objects.push({
                name: collection.name,
                type: 'table', // Treat collections as tables
                definition: JSON.stringify(collection)
            });
        }

        return objects;
    }

    /**
     * Find differences between schemas
     */
    private findDifferences(
        sourceSchema: SchemaObject[],
        targetSchema: SchemaObject[],
        options: any
    ): SchemaDifference[] {
        const differences: SchemaDifference[] = [];
        const sourceMap = new Map<string, SchemaObject>();
        const targetMap = new Map<string, SchemaObject>();

        // Build maps for comparison
        sourceSchema.forEach(obj => {
            const key = this.getObjectKey(obj, options.ignoreCase);
            sourceMap.set(key, obj);
        });

        targetSchema.forEach(obj => {
            const key = this.getObjectKey(obj, options.ignoreCase);
            targetMap.set(key, obj);
        });

        // Find added objects
        for (const [key, sourceObj] of sourceMap) {
            if (!targetMap.has(key)) {
                differences.push({
                    type: 'added',
                    objectType: sourceObj.type,
                    objectName: sourceObj.name,
                    schema: sourceObj.schema,
                    details: {
                        description: `${sourceObj.type} '${sourceObj.name}' exists in source but not in target`
                    }
                });
            }
        }

        // Find removed objects
        for (const [key, targetObj] of targetMap) {
            if (!sourceMap.has(key)) {
                differences.push({
                    type: 'removed',
                    objectType: targetObj.type,
                    objectName: targetObj.name,
                    schema: targetObj.schema,
                    details: {
                        description: `${targetObj.type} '${targetObj.name}' exists in target but not in source`
                    }
                });
            }
        }

        // Find modified objects
        for (const [key, sourceObj] of sourceMap) {
            const targetObj = targetMap.get(key);
            if (targetObj) {
                const objectDifferences = this.compareObjects(sourceObj, targetObj, options);
                differences.push(...objectDifferences);
            }
        }

        return differences;
    }

    /**
     * Compare two schema objects
     */
    private compareObjects(
        sourceObj: SchemaObject,
        targetObj: SchemaObject,
        options: any
    ): SchemaDifference[] {
        const differences: SchemaDifference[] = [];

        // Compare definitions
        if (sourceObj.definition !== targetObj.definition) {
            differences.push({
                type: 'modified',
                objectType: sourceObj.type,
                objectName: sourceObj.name,
                schema: sourceObj.schema,
                details: {
                    property: 'definition',
                    oldValue: targetObj.definition,
                    newValue: sourceObj.definition,
                    description: `Definition of ${sourceObj.type} '${sourceObj.name}' differs`
                }
            });
        }

        // Compare properties
        if (sourceObj.properties || targetObj.properties) {
            const sourceProps = sourceObj.properties || {};
            const targetProps = targetObj.properties || {};

            for (const [key, value] of Object.entries(sourceProps)) {
                if (targetProps[key] !== value) {
                    differences.push({
                        type: 'modified',
                        objectType: sourceObj.type,
                        objectName: sourceObj.name,
                        schema: sourceObj.schema,
                        details: {
                            property: key,
                            oldValue: targetProps[key],
                            newValue: value,
                            description: `Property '${key}' of ${sourceObj.type} '${sourceObj.name}' differs`
                        }
                    });
                }
            }
        }

        return differences;
    }

    /**
     * Get object key for comparison
     */
    private getObjectKey(obj: SchemaObject, ignoreCase: boolean = false): string {
        const name = ignoreCase ? obj.name.toLowerCase() : obj.name;
        const schema = obj.schema ? (ignoreCase ? obj.schema.toLowerCase() : obj.schema) : '';
        return `${schema}.${name}.${obj.type}`;
    }

    /**
     * Calculate summary statistics
     */
    private calculateSummary(differences: SchemaDifference[]): ComparisonResult['summary'] {
        const summary = {
            added: 0,
            removed: 0,
            modified: 0,
            total: differences.length
        };

        differences.forEach(diff => {
            switch (diff.type) {
                case 'added':
                    summary.added++;
                    break;
                case 'removed':
                    summary.removed++;
                    break;
                case 'modified':
                    summary.modified++;
                    break;
            }
        });

        return summary;
    }

    /**
     * Build migration script
     */
    private buildMigrationScript(
        comparisonResult: ComparisonResult,
        options: any
    ): string {
        const commands: string[] = [];

        // Add objects
        comparisonResult.differences
            .filter(diff => diff.type === 'added')
            .forEach(diff => {
                const sourceObj = comparisonResult.objects.source.find(
                    obj => this.getObjectKey(obj) === this.getObjectKey({
                        name: diff.objectName,
                        type: diff.objectType as any,
                        schema: diff.schema
                    })
                );

                if (sourceObj) {
                    commands.push(this.generateCreateCommand(sourceObj, options));
                }
            });

        // Remove objects
        comparisonResult.differences
            .filter(diff => diff.type === 'removed')
            .forEach(diff => {
                commands.push(this.generateDropCommand(diff, options));
            });

        // Modify objects
        comparisonResult.differences
            .filter(diff => diff.type === 'modified')
            .forEach(diff => {
                commands.push(this.generateAlterCommand(diff, options));
            });

        return commands.join('\n\n');
    }

    /**
     * Build rollback script
     */
    private buildRollbackScript(
        comparisonResult: ComparisonResult,
        options: any
    ): string {
        const commands: string[] = [];

        // Reverse the operations
        comparisonResult.differences
            .filter(diff => diff.type === 'added')
            .forEach(diff => {
                commands.push(this.generateDropCommand(diff, options));
            });

        comparisonResult.differences
            .filter(diff => diff.type === 'removed')
            .forEach(diff => {
                const targetObj = comparisonResult.objects.target.find(
                    obj => this.getObjectKey(obj) === this.getObjectKey({
                        name: diff.objectName,
                        type: diff.objectType as any,
                        schema: diff.schema
                    })
                );

                if (targetObj) {
                    commands.push(this.generateCreateCommand(targetObj, options));
                }
            });

        return commands.join('\n\n');
    }

    /**
     * Generate CREATE command
     */
    private generateCreateCommand(obj: SchemaObject, options: any): string {
        // This would generate appropriate CREATE statements based on object type
        // Implementation would depend on the specific database type
        return `-- CREATE ${obj.type.toUpperCase()} ${obj.name}`;
    }

    /**
     * Generate DROP command
     */
    private generateDropCommand(diff: SchemaDifference, options: any): string {
        return `-- DROP ${diff.objectType.toUpperCase()} ${diff.objectName}`;
    }

    /**
     * Generate ALTER command
     */
    private generateAlterCommand(diff: SchemaDifference, options: any): string {
        return `-- ALTER ${diff.objectType.toUpperCase()} ${diff.objectName}`;
    }

    /**
     * Parse migration script into commands
     */
    private parseMigrationScript(script: string): string[] {
        return script
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('--'))
            .join('\n')
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd);
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Load migrations from storage
     */
    private async loadMigrations(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.migrations');
            const migrationsData = config.get<any[]>('scripts', []);
            
            this.migrations = migrationsData.map(migration => ({
                ...migration,
                createdAt: new Date(migration.createdAt),
                executedAt: migration.executedAt ? new Date(migration.executedAt) : undefined
            }));
        } catch (error) {
            console.error('Failed to load migrations:', error);
        }
    }

    /**
     * Save migrations to storage
     */
    private async saveMigrations(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('ultimatedb.migrations');
            await config.update('scripts', this.migrations, vscode.ConfigurationTarget.Global);
        } catch (error) {
            console.error('Failed to save migrations:', error);
        }
    }

    /**
     * Get all migrations
     */
    getMigrations(): MigrationScript[] {
        return [...this.migrations];
    }

    /**
     * Get migration by ID
     */
    getMigration(id: string): MigrationScript | undefined {
        return this.migrations.find(m => m.id === id);
    }

    /**
     * Delete migration
     */
    async deleteMigration(id: string): Promise<boolean> {
        const index = this.migrations.findIndex(m => m.id === id);
        if (index === -1) {
            return false;
        }

        this.migrations.splice(index, 1);
        await this.saveMigrations();
        return true;
    }
}
