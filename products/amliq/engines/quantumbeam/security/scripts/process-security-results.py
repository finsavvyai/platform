#!/usr/bin/env python3
"""
Security Scan Results Processor

Processes security scan results from various tools and generates a unified summary.
"""

import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class SecurityIssue:
    """Represents a security issue"""
    tool: str
    severity: str
    title: str
    description: str
    file_path: str
    line_number: int = None
    cwe_id: str = None
    cve_id: str = None
    rule_id: str = None


@dataclass
class SecuritySummary:
    """Represents security scan summary"""
    total_issues: int
    critical: int
    high: int
    medium: int
    low: int
    issues_by_tool: Dict[str, List[SecurityIssue]]
    status: str  # PASS, FAIL, WARN
    scan_time: datetime


class SecurityResultsProcessor:
    """Processes security scan results from multiple tools"""

    def __init__(self, input_dir: str, threshold_critical: int = 0,
                 threshold_high: int = 5, threshold_medium: int = 20):
        self.input_dir = Path(input_dir)
        self.threshold_critical = threshold_critical
        self.threshold_high = threshold_high
        self.threshold_medium = threshold_medium

    def process_results(self) -> SecuritySummary:
        """Process all security scan results"""
        print("🔍 Processing security scan results...")

        all_issues = []

        # Process Trivy results
        trivy_issues = self._process_trivy_results()
        all_issues.extend(trivy_issues)

        # Process Semgrep results
        semgrep_issues = self._process_semgrep_results()
        all_issues.extend(semgrep_issues)

        # Process Gosec results
        gosec_issues = self._process_gosec_results()
        all_issues.extend(gosec_issues)

        # Process Bandit results
        bandit_issues = self._process_bandit_results()
        all_issues.extend(bandit_issues)

        # Process Safety results
        safety_issues = self._process_safety_results()
        all_issues.extend(safety_issues)

        # Process Nuclei results
        nuclei_issues = self._process_nuclei_results()
        all_issues.extend(nuclei_issues)

        # Process Checkov results
        checkov_issues = self._process_checkov_results()
        all_issues.extend(checkov_issues)

        # Process Tfsec results
        tfsec_issues = self._process_tfsec_results()
        all_issues.extend(tfsec_issues)

        # Group issues by tool
        issues_by_tool = {}
        for issue in all_issues:
            if issue.tool not in issues_by_tool:
                issues_by_tool[issue.tool] = []
            issues_by_tool[issue.tool].append(issue)

        # Count severity levels
        critical = len([i for i in all_issues if i.severity == 'CRITICAL'])
        high = len([i for i in all_issues if i.severity == 'HIGH'])
        medium = len([i for i in all_issues if i.severity == 'MEDIUM'])
        low = len([i for i in all_issues if i.severity == 'LOW'])

        # Determine overall status
        status = self._determine_status(critical, high, medium)

        summary = SecuritySummary(
            total_issues=len(all_issues),
            critical=critical,
            high=high,
            medium=medium,
            low=low,
            issues_by_tool=issues_by_tool,
            status=status,
            scan_time=datetime.now()
        )

        print(f"✅ Processed {len(all_issues)} total issues")
        print(f"   Critical: {critical}, High: {high}, Medium: {medium}, Low: {low}")
        print(f"   Overall Status: {status}")

        return summary

    def _process_trivy_results(self) -> List[SecurityIssue]:
        """Process Trivy SARIF results"""
        issues = []
        trivy_file = self.input_dir / 'trivy-results.sarif'

        if not trivy_file.exists():
            return issues

        try:
            with open(trivy_file, 'r') as f:
                data = json.load(f)

            for run in data.get('runs', []):
                for result in run.get('results', []):
                    level = result.get('level', 'UNKNOWN').upper()
                    severity = self._map_severity(level)

                    rule = result.get('rule', {})
                    message = result.get('message', {})

                    issue = SecurityIssue(
                        tool='Trivy',
                        severity=severity,
                        title=rule.get('id', 'Unknown'),
                        description=message.get('text', ''),
                        file_path=result.get('locations', [{}])[0].get('physicalLocation', {}).get('artifactLocation', {}).get('uri', ''),
                        rule_id=rule.get('id')
                    )
                    issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Trivy results: {e}")

        return issues

    def _process_semgrep_results(self) -> List[SecurityIssue]:
        """Process Semgrep SARIF results"""
        issues = []
        semgrep_file = self.input_dir / 'semgrep-results.sarif'

        if not semgrep_file.exists():
            return issues

        try:
            with open(semgrep_file, 'r') as f:
                data = json.load(f)

            for run in data.get('runs', []):
                for result in run.get('results', []):
                    level = result.get('level', 'NOTE').upper()
                    severity = self._map_severity(level)

                    rule = result.get('rule', {})
                    message = result.get('message', {})

                    issue = SecurityIssue(
                        tool='Semgrep',
                        severity=severity,
                        title=rule.get('name', 'Unknown'),
                        description=message.get('text', ''),
                        file_path=result.get('locations', [{}])[0].get('physicalLocation', {}).get('artifactLocation', {}).get('uri', ''),
                        rule_id=rule.get('id'),
                        cwe_id=rule.get('properties', {}).get('cwe_id')
                    )
                    issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Semgrep results: {e}")

        return issues

    def _process_gosec_results(self) -> List[SecurityIssue]:
        """Process Gosec SARIF results"""
        issues = []
        gosec_file = self.input_dir / 'gosec-results.sarif'

        if not gosec_file.exists():
            return issues

        try:
            with open(gosec_file, 'r') as f:
                data = json.load(f)

            for run in data.get('runs', []):
                for result in run.get('results', []):
                    level = result.get('level', 'WARNING').upper()
                    severity = self._map_severity(level)

                    rule = result.get('rule', {})
                    message = result.get('message', {})

                    location = result.get('locations', [{}])[0].get('physicalLocation', {}).get('region', {})

                    issue = SecurityIssue(
                        tool='Gosec',
                        severity=severity,
                        title=rule.get('name', 'Unknown'),
                        description=message.get('text', ''),
                        file_path=result.get('locations', [{}])[0].get('physicalLocation', {}).get('artifactLocation', {}).get('uri', ''),
                        line_number=location.get('startLine'),
                        rule_id=rule.get('id'),
                        cwe_id=rule.get('properties', {}).get('cwe_id')
                    )
                    issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Gosec results: {e}")

        return issues

    def _process_bandit_results(self) -> List[SecurityIssue]:
        """Process Bandit JSON results"""
        issues = []
        bandit_file = self.input_dir / 'bandit-results.json'

        if not bandit_file.exists():
            return issues

        try:
            with open(bandit_file, 'r') as f:
                data = json.load(f)

            for result in data.get('results', []):
                severity = self._map_severity(result.get('issue_severity', 'MEDIUM').upper())

                issue = SecurityIssue(
                    tool='Bandit',
                    severity=severity,
                    title=result.get('test_name', 'Unknown'),
                    description=result.get('issue_text', ''),
                    file_path=result.get('filename', ''),
                    line_number=result.get('line_number'),
                    cwe_id=result.get('cwe_id'),
                    rule_id=result.get('test_id')
                )
                issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Bandit results: {e}")

        return issues

    def _process_safety_results(self) -> List[SecurityIssue]:
        """Process Safety JSON results"""
        issues = []
        safety_file = self.input_dir / 'safety-results.json'

        if not safety_file.exists():
            return issues

        try:
            with open(safety_file, 'r') as f:
                data = json.load(f)

            for result in data.get('vulnerabilities', []):
                severity = 'HIGH' if result.get('vulnerability_id', '').startswith('CVE') else 'MEDIUM'

                issue = SecurityIssue(
                    tool='Safety',
                    severity=severity,
                    title=result.get('package_name', 'Unknown'),
                    description=result.get('advisory', ''),
                    file_path=result.get('package_name', ''),
                    cve_id=result.get('vulnerability_id'),
                    rule_id=result.get('vulnerability_id')
                )
                issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Safety results: {e}")

        return issues

    def _process_nuclei_results(self) -> List[SecurityIssue]:
        """Process Nuclei text results"""
        issues = []
        nuclei_file = self.input_dir / 'nuclei-results.txt'

        if not nuclei_file.exists():
            return issues

        try:
            with open(nuclei_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Parse nuclei output format
                        parts = line.split(' ')
                        if len(parts) >= 2:
                            issue = SecurityIssue(
                                tool='Nuclei',
                                severity='HIGH',  # Nuclei typically finds high-severity issues
                                title=parts[0],
                                description=' '.join(parts[1:]),
                                file_path='',
                                rule_id=parts[0]
                            )
                            issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Nuclei results: {e}")

        return issues

    def _process_checkov_results(self) -> List[SecurityIssue]:
        """Process Checkov XML results"""
        issues = []
        checkov_files = [
            self.input_dir / 'checkov-results.xml',
            self.input_dir / 'k8s-checkov-results.xml',
            self.input_dir / 'helm-checkov-results.xml'
        ]

        for checkov_file in checkov_files:
            if not checkov_file.exists():
                continue

            try:
                tree = ET.parse(checkov_file)
                root = tree.getroot()

                for test_case in root.findall('.//testcase'):
                    failure = test_case.find('failure')
                    if failure is not None:
                        severity = self._map_severity(failure.get('severity', 'MEDIUM').upper())

                        issue = SecurityIssue(
                            tool='Checkov',
                            severity=severity,
                            title=test_case.get('name', 'Unknown'),
                            description=failure.text or '',
                            file_path=test_case.get('classname', ''),
                            rule_id=test_case.get('name')
                        )
                        issues.append(issue)

            except Exception as e:
                print(f"⚠️ Error processing Checkov results {checkov_file}: {e}")

        return issues

    def _process_tfsec_results(self) -> List[SecurityIssue]:
        """Process Tfsec JSON results"""
        issues = []
        tfsec_file = self.input_dir / 'tfsec-results.json'

        if not tfsec_file.exists():
            return issues

        try:
            with open(tfsec_file, 'r') as f:
                data = json.load(f)

            for result in data.get('results', []):
                severity = self._map_severity(result.get('severity', 'MEDIUM').upper())

                location = result.get('location', {})

                issue = SecurityIssue(
                    tool='Tfsec',
                    severity=severity,
                    title=result.get('rule_description', 'Unknown'),
                    description=result.get('description', ''),
                    file_path=location.get('filename', ''),
                    line_number=location.get('start_line'),
                    rule_id=result.get('rule_id')
                )
                issues.append(issue)

        except Exception as e:
            print(f"⚠️ Error processing Tfsec results: {e}")

        return issues

    def _map_severity(self, severity: str) -> str:
        """Map severity levels to standard format"""
        severity_mapping = {
            'ERROR': 'CRITICAL',
            'CRITICAL': 'CRITICAL',
            'HIGH': 'HIGH',
            'WARNING': 'MEDIUM',
            'MEDIUM': 'MEDIUM',
            'INFO': 'LOW',
            'LOW': 'LOW',
            'NOTE': 'LOW'
        }
        return severity_mapping.get(severity.upper(), 'MEDIUM')

    def _determine_status(self, critical: int, high: int, medium: int) -> str:
        """Determine overall security status based on thresholds"""
        if critical > self.threshold_critical:
            return 'FAIL'
        if high > self.threshold_high:
            return 'FAIL'
        if medium > self.threshold_medium:
            return 'WARN'
        return 'PASS'


def main():
    """Main function"""
    if len(sys.argv) < 3:
        print("Usage: python process-security-results.py --input-dir <dir> --output <file> [--threshold-critical <n>] [--threshold-high <n>] [--threshold-medium <n>]")
        sys.exit(1)

    input_dir = None
    output_file = None
    threshold_critical = 0
    threshold_high = 5
    threshold_medium = 20

    # Parse arguments
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--input-dir':
            input_dir = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--output':
            output_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--threshold-critical':
            threshold_critical = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--threshold-high':
            threshold_high = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--threshold-medium':
            threshold_medium = int(sys.argv[i + 1])
            i += 2
        else:
            i += 1

    if not input_dir or not output_file:
        print("Error: --input-dir and --output are required")
        sys.exit(1)

    # Process results
    processor = SecurityResultsProcessor(
        input_dir=input_dir,
        threshold_critical=threshold_critical,
        threshold_high=threshold_high,
        threshold_medium=threshold_medium
    )

    summary = processor.process_results()

    # Convert to dictionary for JSON serialization
    summary_dict = {
        'total_issues': summary.total_issues,
        'critical': summary.critical,
        'high': summary.high,
        'medium': summary.medium,
        'low': summary.low,
        'status': summary.status,
        'scan_time': summary.scan_time.isoformat(),
        'issues_by_tool': {}
    }

    # Convert issues to JSON-serializable format
    for tool, issues in summary.issues_by_tool.items():
        summary_dict['issues_by_tool'][tool] = [
            {
                'severity': issue.severity,
                'title': issue.title,
                'description': issue.description,
                'file_path': issue.file_path,
                'line_number': issue.line_number,
                'cwe_id': issue.cwe_id,
                'cve_id': issue.cve_id,
                'rule_id': issue.rule_id
            }
            for issue in issues
        ]

    # Save summary
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(summary_dict, f, indent=2)

    print(f"📊 Security summary saved to {output_file}")

    # Exit with appropriate code
    if summary.status == 'FAIL':
        sys.exit(1)
    elif summary.status == 'WARN':
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()