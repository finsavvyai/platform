export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface TableSchema {
  name: string;
  columns: Column[];
  rowCount?: number;
}

export interface Schema {
  name: string;
  tables: TableSchema[];
}
