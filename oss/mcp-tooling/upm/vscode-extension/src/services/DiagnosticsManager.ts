import * as vscode from "vscode";
import { Disposable } from "../utils/Disposable";
import { Logger } from "../utils/Logger";
import {
  AnalysisResult,
  Vulnerability,
  Dependency,
  VulnerabilitySeverity,
  PolicyViolation,
} from "../types";

const log = Logger.createLogger("DiagnosticsManager");

export class DiagnosticsManager extends Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private lastAnalysis: AnalysisResult | null = null;

  constructor(private context: vscode.ExtensionContext) {
    super();
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("upm");
    this.addDisposable(this.diagnosticCollection);
    log.info("DiagnosticsManager initialized");
  }

  public async initialize(): Promise<void> {
    // Set up diagnostic configuration
    this.configureDiagnostics();
    log.info("DiagnosticsManager configuration complete");
  }

  private configureDiagnostics(): void {
    // Listen for diagnostic configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("upm.notificationLevel")) {
        log.info("Diagnostic configuration changed, refreshing diagnostics");
        this.refreshAllDiagnostics();
      }
    });
  }

  public updateDiagnostics(analysis: AnalysisResult): void {
    log.info("Updating diagnostics with analysis results");
    this.lastAnalysis = analysis;

    // Clear existing diagnostics
    this.diagnosticCollection.clear();

    // Update vulnerability diagnostics
    if (analysis.vulnerabilities && analysis.vulnerabilities.length > 0) {
      this.updateVulnerabilityDiagnostics(analysis.vulnerabilities);
    }

    // Update policy violation diagnostics
    if (analysis.policyViolations && analysis.policyViolations.length > 0) {
      this.updatePolicyViolationDiagnostics(analysis.policyViolations);
    }

    log.info("Diagnostics updated successfully");
  }

  public updateVulnerabilities(vulnerabilities: Vulnerability[]): void {
    log.info(`Updating ${vulnerabilities.length} vulnerability diagnostics`);
    this.updateVulnerabilityDiagnostics(vulnerabilities);
  }

  private updateVulnerabilityDiagnostics(
    vulnerabilities: Vulnerability[],
  ): void {
    const diagnosticMap = new Map<string, vscode.Diagnostic[]>();

    for (const vuln of vulnerabilities) {
      const diagnostics = this.createVulnerabilityDiagnostics(vuln);

      for (const diagnostic of diagnostics) {
        const uri = diagnostic.locationUri;
        if (!diagnosticMap.has(uri.toString())) {
          diagnosticMap.set(uri.toString(), []);
        }
        diagnosticMap.get(uri.toString())!.push(diagnostic);
      }
    }

    // Apply diagnostics to documents
    for (const [uriString, diagnostics] of diagnosticMap.entries()) {
      const uri = vscode.Uri.parse(uriString);
      this.diagnosticCollection.set(uri, diagnostics);
    }
  }

  private createVulnerabilityDiagnostics(
    vulnerability: Vulnerability,
  ): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const severity = this.mapVulnerabilitySeverity(vulnerability.severity);

    // Find affected files based on workspace
    const affectedFiles = this.findAffectedFiles(vulnerability);

    for (const file of affectedFiles) {
      const range = this.findDependencyRange(file, vulnerability);

      const diagnostic = new vscode.Diagnostic(
        range,
        this.formatVulnerabilityMessage(vulnerability),
        severity,
      );

      diagnostic.source = "UPM";
      diagnostic.code = vulnerability.id;
      diagnostic.relatedInformation =
        this.createRelatedInformation(vulnerability);

      diagnostics.push(diagnostic);
    }

    return diagnostics;
  }

  private updatePolicyViolationDiagnostics(
    violations: PolicyViolation[],
  ): void {
    const diagnosticMap = new Map<string, vscode.Diagnostic[]>();

    for (const violation of violations) {
      const diagnostics = this.createPolicyViolationDiagnostics(violation);

      for (const diagnostic of diagnostics) {
        const uri = diagnostic.locationUri;
        if (!diagnosticMap.has(uri.toString())) {
          diagnosticMap.set(uri.toString(), []);
        }
        diagnosticMap.get(uri.toString())!.push(diagnostic);
      }
    }

    // Apply diagnostics to documents
    for (const [uriString, diagnostics] of diagnosticMap.entries()) {
      const uri = vscode.Uri.parse(uriString);
      this.diagnosticCollection.set(uri, diagnostics);
    }
  }

  private createPolicyViolationDiagnostics(
    violation: PolicyViolation,
  ): vscode.Diagnostic[] {
    const diagnostics: vscode.Diagnostic[] = [];
    const severity = this.mapPolicySeverity(violation.severity);

    // Find affected files based on workspace
    const affectedFiles = this.findFilesForDependencies(
      violation.affectedDependencies,
    );

    for (const file of affectedFiles) {
      const range = this.findDependencyRangeForViolation(file, violation);

      const diagnostic = new vscode.Diagnostic(
        range,
        this.formatPolicyViolationMessage(violation),
        severity,
      );

      diagnostic.source = "UPM";
      diagnostic.code = violation.ruleId;

      diagnostics.push(diagnostic);
    }

    return diagnostics;
  }

  private mapVulnerabilitySeverity(
    severity: VulnerabilitySeverity,
  ): vscode.DiagnosticSeverity {
    const configLevel = vscode.workspace
      .getConfiguration("upm")
      .get<string>("notificationLevel", "warning");

    // Don't show diagnostics below the configured notification level
    switch (configLevel) {
      case "error":
        if (severity !== VulnerabilitySeverity.CRITICAL)
          return vscode.DiagnosticSeverity.Hint;
        break;
      case "warning":
        if (severity === VulnerabilitySeverity.LOW)
          return vscode.DiagnosticSeverity.Hint;
        break;
    }

    switch (severity) {
      case VulnerabilitySeverity.CRITICAL:
        return vscode.DiagnosticSeverity.Error;
      case VulnerabilitySeverity.HIGH:
        return vscode.DiagnosticSeverity.Error;
      case VulnerabilitySeverity.MEDIUM:
        return vscode.DiagnosticSeverity.Warning;
      case VulnerabilitySeverity.LOW:
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Hint;
    }
  }

  private mapPolicySeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity.toLowerCase()) {
      case "critical":
        return vscode.DiagnosticSeverity.Error;
      case "error":
        return vscode.DiagnosticSeverity.Error;
      case "warning":
        return vscode.DiagnosticSeverity.Warning;
      case "info":
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Hint;
    }
  }

  private findAffectedFiles(vulnerability: Vulnerability): vscode.Uri[] {
    const files: vscode.Uri[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      return files;
    }

    // Look for dependency files that might contain the vulnerable package
    const patterns = [
      "**/package.json",
      "**/pom.xml",
      "**/build.gradle",
      "**/build.gradle.kts",
      "**/requirements.txt",
      "**/pyproject.toml",
      "**/Cargo.toml",
      "**/composer.json",
      "**/go.mod",
      "**/*.csproj",
    ];

    for (const folder of workspaceFolders) {
      for (const pattern of patterns) {
        const relativePattern = new vscode.RelativePattern(folder, pattern);
        const foundFiles = vscode.workspace.findFiles(
          relativePattern,
          "**/node_modules/**",
        );

        foundFiles.then((uris) => {
          files.push(...uris);
        });
      }
    }

    return files;
  }

  private findDependencyRange(
    file: vscode.Uri,
    vulnerability: Vulnerability,
  ): vscode.Range {
    // For now, return the beginning of the file
    // In a real implementation, you would parse the file and find the exact line
    return new vscode.Range(0, 0, 0, 0);
  }

  private findDependencyRangeForViolation(
    file: vscode.Uri,
    violation: PolicyViolation,
  ): vscode.Range {
    // For now, return the beginning of the file
    // In a real implementation, you would parse the file and find the exact line
    return new vscode.Range(0, 0, 0, 0);
  }

  private formatVulnerabilityMessage(vulnerability: Vulnerability): string {
    let message = `Security vulnerability: ${vulnerability.title}`;

    if (vulnerability.score) {
      message += ` (CVSS: ${vulnerability.score})`;
    }

    if (vulnerability.cveId) {
      message += ` - ${vulnerability.cveId}`;
    }

    return message;
  }

  private formatPolicyViolationMessage(violation: PolicyViolation): string {
    return `Policy violation: ${violation.description}`;
  }

  private createRelatedInformation(
    vulnerability: Vulnerability,
  ): vscode.DiagnosticRelatedInformation[] {
    const related: vscode.DiagnosticRelatedInformation[] = [];

    if (vulnerability.references) {
      for (const ref of vulnerability.references.slice(0, 3)) {
        try {
          const uri = vscode.Uri.parse(ref);
          related.push(
            new vscode.DiagnosticRelatedInformation(
              new vscode.Location(uri, new vscode.Range(0, 0, 0, 0)),
              "More information",
            ),
          );
        } catch (e) {
          // Skip invalid URIs
        }
      }
    }

    return related;
  }

  private findFilesForDependencies(dependencyNames: string[]): vscode.Uri[] {
    const files: vscode.Uri[] = [];
    // Implementation would search for files containing these dependencies
    return files;
  }

  public refreshAllDiagnostics(): void {
    if (this.lastAnalysis) {
      this.updateDiagnostics(this.lastAnalysis);
    }
  }

  public clearAllDiagnostics(): void {
    log.info("Clearing all diagnostics");
    this.diagnosticCollection.clear();
    this.lastAnalysis = null;
  }

  public getDiagnosticCount(): number {
    let count = 0;
    this.diagnosticCollection.forEach(() => count++);
    return count;
  }

  public getVulnerabilityCount(): number {
    let count = 0;
    this.diagnosticCollection.forEach((diagnostics) => {
      count += diagnostics.filter(
        (d) =>
          d.code?.toString().startsWith("CVE-") ||
          d.message.includes("Security vulnerability"),
      ).length;
    });
    return count;
  }

  public async dispose(): Promise<void> {
    log.info("Disposing DiagnosticsManager...");
    this.diagnosticCollection.clear();
    await super.dispose();
  }
}
