#!/usr/bin/env python3
"""
Security Gate Checker

Implements security gates to enforce security standards before deployment.
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class SecurityGateRule:
    """Represents a security gate rule"""
    name: str
    description: str
    threshold_type: str  # 'count', 'severity', 'tool'
    threshold_value: int
    severity_filter: List[str] = None
    tool_filter: List[str] = None
    action: str = 'fail'  # 'fail', 'warn', 'ignore'


@dataclass
class SecurityGateResult:
    """Represents security gate check result"""
    rule_name: str
    passed: bool
    actual_value: int
    threshold_value: int
    message: str
    violations: List[Dict[str, Any]] = None


class SecurityGateChecker:
    """Implements security gates for CI/CD pipeline"""

    def __init__(self, config_file: str = None):
        self.rules = self._load_default_rules()
        if config_file:
            self._load_rules_from_file(config_file)

    def _load_default_rules(self) -> List[SecurityGateRule]:
        """Load default security gate rules"""
        return [
            SecurityGateRule(
                name="no_critical_vulnerabilities",
                description="No critical vulnerabilities allowed",
                threshold_type="severity",
                threshold_value=0,
                severity_filter=["CRITICAL"],
                action="fail"
            ),
            SecurityGateRule(
                name="limited_high_vulnerabilities",
                description="Maximum 5 high vulnerabilities allowed",
                threshold_type="severity",
                threshold_value=5,
                severity_filter=["HIGH"],
                action="fail"
            ),
            SecurityGateRule(
                name="limited_medium_vulnerabilities",
                description="Maximum 20 medium vulnerabilities allowed",
                threshold_type="severity",
                threshold_value=20,
                severity_filter=["MEDIUM"],
                action="warn"
            ),
            SecurityGateRule(
                name="no_sql_injection",
                description="No SQL injection vulnerabilities allowed",
                threshold_type="tool",
                threshold_value=0,
                tool_filter=["Semgrep"],
                action="fail"
            ),
            SecurityGateRule(
                name="no_xss_vulnerabilities",
                description="No XSS vulnerabilities allowed",
                threshold_type="tool",
                threshold_value=0,
                tool_filter=["Semgrep"],
                action="fail"
            ),
            SecurityGateRule(
                name="no_hardcoded_secrets",
                description="No hardcoded secrets allowed",
                threshold_type="tool",
                threshold_value=0,
                tool_filter=["Trivy"],
                action="fail"
            ),
            SecurityGateRule(
                name="infrastructure_compliance",
                description="Infrastructure must pass security compliance",
                threshold_type="tool",
                threshold_value=0,
                tool_filter=["Checkov"],
                action="fail"
            ),
            SecurityGateRule(
                name="container_security",
                description="Container images must pass security scan",
                threshold_type="tool",
                threshold_value=0,
                tool_filter=["Trivy"],
                action="fail"
            )
        ]

    def _load_rules_from_file(self, config_file: str):
        """Load security gate rules from configuration file"""
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)

            if 'rules' in config:
                self.rules = []
                for rule_config in config['rules']:
                    rule = SecurityGateRule(
                        name=rule_config['name'],
                        description=rule_config['description'],
                        threshold_type=rule_config['threshold_type'],
                        threshold_value=rule_config['threshold_value'],
                        severity_filter=rule_config.get('severity_filter'),
                        tool_filter=rule_config.get('tool_filter'),
                        action=rule_config.get('action', 'fail')
                    )
                    self.rules.append(rule)

        except Exception as e:
            print(f"⚠️ Error loading security gate rules from {config_file}: {e}")
            print("Using default rules instead")

    def check_security_gate(self, input_file: str, fail_on_critical: bool = True,
                           fail_on_high_count: int = None) -> Dict[str, Any]:
        """Check security gate against scan results"""
        print(f"🔐 Checking security gate against {input_file}")

        # Load security results
        try:
            with open(input_file, 'r') as f:
                results = json.load(f)
        except Exception as e:
            print(f"❌ Error loading security results: {e}")
            return {
                'status': 'ERROR',
                'message': f'Failed to load security results: {e}',
                'results': []
            }

        # Apply custom thresholds from command line
        if fail_on_critical is not None:
            # Update critical threshold rule
            for rule in self.rules:
                if rule.name == "no_critical_vulnerabilities":
                    rule.threshold_value = 0 if fail_on_critical else 999

        if fail_on_high_count is not None:
            # Update high vulnerability threshold
            for rule in self.rules:
                if rule.name == "limited_high_vulnerabilities":
                    rule.threshold_value = fail_on_high_count

        # Check each rule
        gate_results = []
        overall_passed = True
        warnings = []

        for rule in self.rules:
            result = self._check_rule(rule, results)
            gate_results.append(result)

            if not result.passed:
                if rule.action == 'fail':
                    overall_passed = False
                    print(f"❌ Security gate FAILED: {result.message}")
                elif rule.action == 'warn':
                    warnings.append(result.message)
                    print(f"⚠️ Security gate WARNING: {result.message}")
            else:
                print(f"✅ Security gate PASSED: {rule.name}")

        # Determine overall status
        if not overall_passed:
            status = 'FAIL'
        elif warnings:
            status = 'WARN'
        else:
            status = 'PASS'

        gate_summary = {
            'status': status,
            'overall_passed': overall_passed,
            'timestamp': datetime.now().isoformat(),
            'rules_checked': len(self.rules),
            'rules_passed': len([r for r in gate_results if r.passed]),
            'rules_failed': len([r for r in gate_results if not r.passed and self._get_rule_by_name(r.rule_name).action == 'fail']),
            'rules_warned': len([r for r in gate_results if not r.passed and self._get_rule_by_name(r.rule_name).action == 'warn']),
            'results': [
                {
                    'rule_name': r.rule_name,
                    'passed': r.passed,
                    'threshold': r.threshold_value,
                    'actual': r.actual_value,
                    'message': r.message,
                    'violations': r.violations
                }
                for r in gate_results
            ],
            'summary': self._generate_summary(results),
            'warnings': warnings
        }

        # Print summary
        print(f"\n📊 Security Gate Summary:")
        print(f"   Status: {status}")
        print(f"   Rules Passed: {gate_summary['rules_passed']}/{gate_summary['rules_checked']}")
        print(f"   Critical Issues: {results.get('critical', 0)}")
        print(f"   High Issues: {results.get('high', 0)}")
        print(f"   Medium Issues: {results.get('medium', 0)}")
        print(f"   Low Issues: {results.get('low', 0)}")

        if warnings:
            print(f"\n⚠️ Warnings:")
            for warning in warnings:
                print(f"   - {warning}")

        return gate_summary

    def _check_rule(self, rule: SecurityGateRule, results: Dict[str, Any]) -> SecurityGateResult:
        """Check a single security gate rule"""
        if rule.threshold_type == "severity":
            return self._check_severity_rule(rule, results)
        elif rule.threshold_type == "tool":
            return self._check_tool_rule(rule, results)
        elif rule.threshold_type == "count":
            return self._check_count_rule(rule, results)
        else:
            return SecurityGateResult(
                rule_name=rule.name,
                passed=False,
                actual_value=0,
                threshold_value=rule.threshold_value,
                message=f"Unknown threshold type: {rule.threshold_type}"
            )

    def _check_severity_rule(self, rule: SecurityGateRule, results: Dict[str, Any]) -> SecurityGateResult:
        """Check severity-based rule"""
        count = 0
        violations = []

        for severity in rule.severity_filter:
            severity_count = results.get(severity.lower(), 0)
            count += severity_count

            # Collect violations for this severity
            for tool, issues in results.get('issues_by_tool', {}).items():
                for issue in issues:
                    if issue.get('severity') == severity:
                        violations.append({
                            'tool': tool,
                            'title': issue.get('title'),
                            'file_path': issue.get('file_path'),
                            'severity': severity
                        })

        passed = count <= rule.threshold_value
        message = f"{rule.description}: Found {count} {severity} vulnerabilities (threshold: {rule.threshold_value})"

        return SecurityGateResult(
            rule_name=rule.name,
            passed=passed,
            actual_value=count,
            threshold_value=rule.threshold_value,
            message=message,
            violations=violations if not passed else []
        )

    def _check_tool_rule(self, rule: SecurityGateRule, results: Dict[str, Any]) -> SecurityGateResult:
        """Check tool-based rule"""
        count = 0
        violations = []

        for tool in rule.tool_filter:
            tool_issues = results.get('issues_by_tool', {}).get(tool, [])
            count += len(tool_issues)

            # Collect violations for this tool
            for issue in tool_issues:
                violations.append({
                    'tool': tool,
                    'title': issue.get('title'),
                    'file_path': issue.get('file_path'),
                    'severity': issue.get('severity')
                })

        passed = count <= rule.threshold_value
        message = f"{rule.description}: Found {count} issues from {', '.join(rule.tool_filter)} (threshold: {rule.threshold_value})"

        return SecurityGateResult(
            rule_name=rule.name,
            passed=passed,
            actual_value=count,
            threshold_value=rule.threshold_value,
            message=message,
            violations=violations if not passed else []
        )

    def _check_count_rule(self, rule: SecurityGateRule, results: Dict[str, Any]) -> SecurityGateResult:
        """Check count-based rule"""
        total_issues = results.get('total_issues', 0)
        passed = total_issues <= rule.threshold_value
        message = f"{rule.description}: Found {total_issues} total issues (threshold: {rule.threshold_value})"

        return SecurityGateResult(
            rule_name=rule.name,
            passed=passed,
            actual_value=total_issues,
            threshold_value=rule.threshold_value,
            message=message
        )

    def _get_rule_by_name(self, rule_name: str) -> SecurityGateRule:
        """Get rule by name"""
        for rule in self.rules:
            if rule.name == rule_name:
                return rule
        return None

    def _generate_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of security issues"""
        issues_by_tool = results.get('issues_by_tool', {})

        summary = {
            'total_issues': results.get('total_issues', 0),
            'severity_breakdown': {
                'critical': results.get('critical', 0),
                'high': results.get('high', 0),
                'medium': results.get('medium', 0),
                'low': results.get('low', 0)
            },
            'tool_breakdown': {}
        }

        for tool, issues in issues_by_tool.items():
            tool_summary = {
                'total': len(issues),
                'severity': {}
            }

            for issue in issues:
                severity = issue.get('severity', 'UNKNOWN')
                if severity not in tool_summary['severity']:
                    tool_summary['severity'][severity] = 0
                tool_summary['severity'][severity] += 1

            summary['tool_breakdown'][tool] = tool_summary

        return summary

    def generate_security_gate_report(self, results: Dict[str, Any], output_file: str):
        """Generate a detailed security gate report"""
        report = {
            'security_gate_report': {
                'timestamp': datetime.now().isoformat(),
                'status': results['status'],
                'summary': results['summary'],
                'rules': results['results'],
                'recommendations': self._generate_recommendations(results)
            }
        }

        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"📋 Security gate report saved to {output_file}")

    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on failed rules"""
        recommendations = []

        for result in results['results']:
            if not result['passed']:
                rule = self._get_rule_by_name(result['rule_name'])
                if rule:
                    if rule.name == "no_critical_vulnerabilities":
                        recommendations.append(
                            "🚨 Critical vulnerabilities must be fixed before deployment. "
                            "Address all critical security issues immediately."
                        )
                    elif rule.name == "limited_high_vulnerabilities":
                        recommendations.append(
                            "⚠️ Reduce the number of high vulnerabilities below the threshold. "
                            "Focus on fixing high-priority security issues."
                        )
                    elif rule.name == "no_sql_injection":
                        recommendations.append(
                            "🛡️ Fix all SQL injection vulnerabilities by using parameterized queries "
                            "and input validation."
                        )
                    elif rule.name == "no_xss_vulnerabilities":
                        recommendations.append(
                            "🛡️ Fix all XSS vulnerabilities by implementing proper output encoding "
                            "and Content Security Policy."
                        )
                    elif rule.name == "no_hardcoded_secrets":
                        recommendations.append(
                            "🔐 Remove all hardcoded secrets and use proper secret management "
                            "systems."
                        )
                    elif rule.name == "infrastructure_compliance":
                        recommendations.append(
                            "🏗️ Fix infrastructure security compliance issues by following "
                            "security best practices."
                        )
                    elif rule.name == "container_security":
                        recommendations.append(
                            "🐳 Fix container security issues by updating base images and "
                            "removing vulnerable dependencies."
                        )

        return recommendations


def main():
    """Main function"""
    if len(sys.argv) < 3:
        print("Usage: python security-gate-check.py --input <file> [--fail-on-critical <true/false>] [--fail-on-high-count <n>] [--config <file>]")
        sys.exit(1)

    input_file = None
    fail_on_critical = True
    fail_on_high_count = None
    config_file = None

    # Parse arguments
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == '--input':
            input_file = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--fail-on-critical':
            fail_on_critical = sys.argv[i + 1].lower() == 'true'
            i += 2
        elif sys.argv[i] == '--fail-on-high-count':
            fail_on_high_count = int(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == '--config':
            config_file = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    if not input_file:
        print("Error: --input is required")
        sys.exit(1)

    # Check if input file exists
    if not Path(input_file).exists():
        print(f"Error: Input file {input_file} does not exist")
        sys.exit(1)

    # Initialize security gate checker
    checker = SecurityGateChecker(config_file)

    # Check security gate
    results = checker.check_security_gate(input_file, fail_on_critical, fail_on_high_count)

    # Generate report
    output_file = input_file.replace('.json', '-gate-report.json')
    checker.generate_security_gate_report(results, output_file)

    # Exit with appropriate code
    if results['status'] == 'FAIL':
        print("\n❌ Security gate FAILED - Deployment blocked")
        sys.exit(1)
    elif results['status'] == 'WARN':
        print("\n⚠️ Security gate PASSED with warnings - Deployment allowed")
        sys.exit(2)
    else:
        print("\n✅ Security gate PASSED - Deployment allowed")
        sys.exit(0)


if __name__ == '__main__':
    main()