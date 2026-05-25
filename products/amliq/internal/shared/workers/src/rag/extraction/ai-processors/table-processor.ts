export class TableProcessor {
  private ai: any;
  private logger: any;

  constructor(ai: any, logger: any) {
    this.ai = ai;
    this.logger = logger;
  }

  async extractTables(content: string): Promise<any[]> {
    try {
      if (this.ai?.run) {
        const result = await this.ai.run("@cf/unrealistic/table-extraction", {
          content,
          options: {
            detectHeaders: true,
            normalizeCells: true,
            inferTypes: true,
          },
        });
        return result.tables || [];
      }

      return this.fallbackTableExtraction(content);
    } catch (error) {
      this.logger?.warn("AI table processing failed", { error: error.message });
      return this.fallbackTableExtraction(content);
    }
  }

  private fallbackTableExtraction(content: string): any[] {
    const tables = [];
    const lines = content.split("\n");
    let currentTable = [];
    let inTable = false;

    for (const line of lines) {
      if (line.includes("|") && line.split("|").length > 3) {
        if (!inTable) {
          inTable = true;
          currentTable = [];
        }
        currentTable.push(line);
      } else if (inTable && line.trim() === "") {
        // End of table
        if (currentTable.length > 0) {
          tables.push(this.parseTable(currentTable));
          currentTable = [];
        }
        inTable = false;
      }
    }

    // Add last table if content ends without blank line
    if (currentTable.length > 0) {
      tables.push(this.parseTable(currentTable));
    }

    return tables;
  }

  private parseTable(tableLines: string[]): any {
    const rows = tableLines.map((line) =>
      line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell),
    );

    return {
      id: `table_${Date.now()}`,
      headers: rows[0] || [],
      rows: rows.slice(1),
      confidence: 0.7,
      location: { page: 1, position: { x: 0, y: 0, width: 0, height: 0 } },
    };
  }
}
