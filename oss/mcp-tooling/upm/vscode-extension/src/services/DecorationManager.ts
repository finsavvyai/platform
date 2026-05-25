import * as vscode from "vscode";
import { Disposable } from "../utils/Disposable";
import { Logger } from "../utils/Logger";

const log = Logger.createLogger("DecorationManager");

export class DecorationManager extends Disposable {
  private decorations: Map<string, vscode.TextEditorDecorationType> = new Map();

  public async initialize(): Promise<void> {
    this.createDecorations();
    log.info("DecorationManager initialized");
  }

  private createDecorations(): void {
    // Vulnerable dependency decoration
    this.decorations.set(
      "vulnerable",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 0, 0, 0.2)",
        border: "1px solid rgba(255, 0, 0, 0.5)",
        borderRadius: "3px",
        color: "var(--vscode-errorForeground)",
        fontWeight: "bold",
        after: {
          contentText: "🔴",
          margin: "0 0 0 10px",
        },
      }),
    );

    // Outdated dependency decoration
    this.decorations.set(
      "outdated",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 165, 0, 0.2)",
        border: "1px solid rgba(255, 165, 0, 0.5)",
        borderRadius: "3px",
        color: "var(--vscode-warningForeground)",
        fontStyle: "italic",
        after: {
          contentText: "⚠",
          margin: "0 0 0 10px",
        },
      }),
    );

    // Unapproved dependency decoration
    this.decorations.set(
      "unapproved",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 255, 0, 0.1)",
        border: "1px dashed rgba(255, 255, 0, 0.5)",
        borderRadius: "3px",
        color: "var(--vscode-descriptionForeground)",
        after: {
          contentText: "⏳",
          margin: "0 0 0 10px",
        },
      }),
    );

    // Policy violation decoration
    this.decorations.set(
      "policyViolation",
      vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(128, 0, 128, 0.2)",
        border: "1px solid rgba(128, 0, 128, 0.5)",
        borderRadius: "3px",
        color: "var(--vscode-charts-purple)",
        textDecoration: "underline wavy rgba(128, 0, 128, 0.8)",
        after: {
          contentText: "🚫",
          margin: "0 0 0 10px",
        },
      }),
    );

    // Register decorations for disposal
    for (const [name, decoration] of this.decorations.entries()) {
      this.addDisposable(decoration);
    }

    log.info(`Created ${this.decorations.size} decoration types`);
  }

  public getDecoration(
    name: string,
  ): vscode.TextEditorDecorationType | undefined {
    return this.decorations.get(name);
  }

  public async dispose(): Promise<void> {
    log.info("Disposing DecorationManager...");
    for (const decoration of this.decorations.values()) {
      decoration.dispose();
    }
    this.decorations.clear();
    await super.dispose();
  }
}
