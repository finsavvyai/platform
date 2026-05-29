package adapter

import (
	"context"

	"github.com/queryflux/backend/internal/domain"
)

func (a *PostgresAdapter) fetchTablesAndColumns(ctx context.Context) (map[string]*domain.Table, error) {
	query := `
		SELECT t.table_name, c.column_name, c.data_type,
		       c.is_nullable, c.column_default
		FROM information_schema.tables t
		JOIN information_schema.columns c ON t.table_name = c.table_name
		WHERE t.table_schema = 'public'
		ORDER BY t.table_name, c.ordinal_position
	`

	rows, err := a.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tables := make(map[string]*domain.Table)

	for rows.Next() {
		var tableName, colName, dataType, nullable string
		var colDefault *string
		if err := rows.Scan(&tableName, &colName, &dataType, &nullable, &colDefault); err != nil {
			return nil, err
		}

		if _, exists := tables[tableName]; !exists {
			tables[tableName] = &domain.Table{
				Name:    tableName,
				Columns: []domain.Column{},
			}
		}

		defaultVal := ""
		if colDefault != nil {
			defaultVal = *colDefault
		}

		tables[tableName].Columns = append(tables[tableName].Columns, domain.Column{
			Name:     colName,
			Type:     dataType,
			Nullable: nullable == "YES",
			Default:  defaultVal,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return tables, nil
}

func (a *PostgresAdapter) populatePrimaryKeys(ctx context.Context, tables map[string]*domain.Table) error {
	query := `
		SELECT kcu.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		WHERE tc.constraint_type = 'PRIMARY KEY'
		  AND tc.table_schema = 'public'
	`

	rows, err := a.pool.Query(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var tableName, colName string
		if err := rows.Scan(&tableName, &colName); err != nil {
			return err
		}

		table, exists := tables[tableName]
		if !exists {
			continue
		}

		for i, col := range table.Columns {
			if col.Name == colName {
				table.Columns[i].PrimaryKey = true
			}
		}
	}

	return rows.Err()
}

func (a *PostgresAdapter) populateIndexes(ctx context.Context, tables map[string]*domain.Table) error {
	query := `
		SELECT t.relname AS table_name,
		       i.relname AS index_name,
		       a.attname AS column_name,
		       ix.indisunique
		FROM pg_class t
		JOIN pg_index ix ON t.oid = ix.indrelid
		JOIN pg_class i ON i.oid = ix.indexrelid
		JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
		JOIN pg_namespace n ON n.oid = t.relnamespace
		WHERE n.nspname = 'public' AND t.relkind = 'r'
		ORDER BY t.relname, i.relname
	`

	rows, err := a.pool.Query(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()

	indexMap := make(map[string]*domain.Index)

	for rows.Next() {
		var tableName, indexName, colName string
		var unique bool
		if err := rows.Scan(&tableName, &indexName, &colName, &unique); err != nil {
			return err
		}

		key := tableName + "." + indexName
		if _, exists := indexMap[key]; !exists {
			indexMap[key] = &domain.Index{
				Name:   indexName,
				Unique: unique,
			}
		}
		indexMap[key].Columns = append(indexMap[key].Columns, colName)

		if table, exists := tables[tableName]; exists {
			found := false
			for _, idx := range table.Indexes {
				if idx.Name == indexName {
					found = true
					break
				}
			}
			if !found {
				table.Indexes = append(table.Indexes, *indexMap[key])
			} else {
				for j, idx := range table.Indexes {
					if idx.Name == indexName {
						table.Indexes[j] = *indexMap[key]
					}
				}
			}
		}
	}

	return rows.Err()
}
