import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Schema } from '../components/queryflux/schema-types';

export const schemaKeys = {
    byConnection: (id: string) => ['schema', id] as const,
};

/**
 * Fetch schema for a connection and transform to SchemaTree format.
 */
export function useSchema(connectionId: string | null) {
    return useQuery({
        queryKey: schemaKeys.byConnection(connectionId ?? ''),
        queryFn: async (): Promise<Schema[]> => {
            if (!connectionId) return [];
            const info = await api.schema.getSchema(connectionId);
            // Transform SchemaInfo → Schema[] for SchemaTree
            const schemas: Schema[] = [];
            for (const db of info.databases ?? []) {
                for (const s of db.schemas ?? []) {
                    schemas.push({
                        name: s.name,
                        tables: (s.tables ?? []).map((t) => ({
                            name: t.name,
                            rowCount: t.rowCount,
                            columns: (t.columns ?? []).map((c) => ({
                                name: c.name,
                                type: c.type,
                                nullable: c.nullable,
                                isPrimaryKey: c.isPrimaryKey,
                            })),
                        })),
                    });
                }
            }
            return schemas;
        },
        enabled: !!connectionId,
        staleTime: 5 * 60 * 1000,
    });
}
