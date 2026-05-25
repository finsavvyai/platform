#!/usr/bin/env python3
"""
Comprehensive CLI Test Suite for FinSavvyAI
Tests all CLI commands and functionality after reorganization
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime


class CLITester:
    def __init__(self):
        self.test_results = []
        self.finsavvyai_cmd = "finsavvyai"
        self.start_time = datetime.now()

    def log_test(
        self, command: str, expected: str, result: str, status: str, details: str = ""
    ):
        """Log a test result"""
        self.test_results.append(
            {
                "timestamp": datetime.now().isoformat(),
                "command": command,
                "expected": expected,
                "result": result,
                "status": status,
                "details": details,
            }
        )

        status_emoji = "✅" if status == "PASS" else "❌"
        print(f"{status_emoji} {command}: {status}")
        if details:
            print(f"   Details: {details}")
        print()

    def run_command(self, command: str, timeout: int = 10) -> tuple:
        """Run a CLI command and return result"""
        try:
            result = subprocess.run(
                command.split(), capture_output=True, text=True, timeout=timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, "", "Command timed out"
        except Exception as e:
            return -1, "", str(e)

    def test_help_command(self):
        """Test help command"""
        print("🔍 Testing Help Commands")
        print("=" * 40)

        # Test basic help
        code, stdout, stderr = self.run_command("finsavvyai help")
        if code == 0 and "aws finsavvyai" in stdout:
            self.log_test("finsavvyai help", "Show help", "Help displayed", "PASS")
        else:
            self.log_test("finsavvyai help", "Show help", "Failed", "FAIL", stderr)

        # Test invalid command
        code, stdout, stderr = self.run_command("finsavvyai invalid-command")
        if code != 0 and "error" in stderr:
            self.log_test(
                "finsavvyai invalid-command", "Error handling", "Proper error", "PASS"
            )
        else:
            self.log_test(
                "finsavvyai invalid-command", "Error handling", "No error", "FAIL"
            )

    def test_describe_commands(self):
        """Test describe commands"""
        print("📊 Testing Describe Commands")
        print("=" * 40)

        # Test describe clusters
        code, stdout, stderr = self.run_command("finsavvyai describe clusters")
        if code == 0:
            self.log_test(
                "finsavvyai describe clusters", "Show clusters", "Success", "PASS"
            )
        else:
            self.log_test(
                "finsavvyai describe clusters",
                "Show clusters",
                "Failed",
                "FAIL",
                stderr,
            )

        # Test describe nodes
        code, stdout, stderr = self.run_command("finsavvyai describe nodes")
        if code == 0:
            self.log_test("finsavvyai describe nodes", "Show nodes", "Success", "PASS")
        else:
            self.log_test(
                "finsavvyai describe nodes", "Show nodes", "Failed", "FAIL", stderr
            )

        # Test describe nodes detailed
        code, stdout, stderr = self.run_command("finsavvyai describe nodes --detailed")
        if code == 0:
            self.log_test(
                "finsavvyai describe nodes --detailed",
                "Show detailed nodes",
                "Success",
                "PASS",
            )
        else:
            self.log_test(
                "finsavvyai describe nodes --detailed",
                "Show detailed nodes",
                "Failed",
                "FAIL",
                stderr,
            )

        # Test describe services
        code, stdout, stderr = self.run_command("finsavvyai describe services")
        if code == 0:
            self.log_test(
                "finsavvyai describe services", "Show services", "Success", "PASS"
            )
        else:
            self.log_test(
                "finsavvyai describe services",
                "Show services",
                "Failed",
                "FAIL",
                stderr,
            )

    def test_output_formats(self):
        """Test different output formats"""
        print("📋 Testing Output Formats")
        print("=" * 40)

        formats = ["table", "json", "yaml", "text"]

        for fmt in formats:
            code, stdout, stderr = self.run_command(
                f"finsavvyai --output {fmt} describe services"
            )
            if code == 0:
                self.log_test(
                    f"finsavvyai --output {fmt} describe services",
                    f"{fmt.upper()} output",
                    "Success",
                    "PASS",
                )
            else:
                self.log_test(
                    f"finsavvyai --output {fmt} describe services",
                    f"{fmt.upper()} output",
                    "Failed",
                    "FAIL",
                    stderr,
                )

    def test_global_options(self):
        """Test global options"""
        print("⚙️ Testing Global Options")
        print("=" * 40)

        # Test verbose
        code, stdout, stderr = self.run_command(
            "finsavvyai --verbose describe clusters"
        )
        if code == 0:
            self.log_test(
                "finsavvyai --verbose describe clusters",
                "Verbose output",
                "Success",
                "PASS",
            )
        else:
            self.log_test(
                "finsavvyai --verbose describe clusters",
                "Verbose output",
                "Failed",
                "FAIL",
                stderr,
            )

        # Test no-color
        code, stdout, stderr = self.run_command(
            "finsavvyai --no-color describe clusters"
        )
        if code == 0:
            self.log_test(
                "finsavvyai --no-color describe clusters",
                "No color output",
                "Success",
                "PASS",
            )
        else:
            self.log_test(
                "finsavvyai --no-color describe clusters",
                "No color output",
                "Failed",
                "FAIL",
                stderr,
            )

        # Test profile
        code, stdout, stderr = self.run_command(
            "finsavvyai --profile test describe clusters"
        )
        if code == 0:
            self.log_test(
                "finsavvyai --profile test describe clusters",
                "Profile option",
                "Success",
                "PASS",
            )
        else:
            self.log_test(
                "finsavvyai --profile test describe clusters",
                "Profile option",
                "Failed",
                "FAIL",
                stderr,
            )

    def test_service_management(self):
        """Test service management commands"""
        print("🔧 Testing Service Management")
        print("=" * 40)

        # Test start all services
        code, stdout, stderr = self.run_command("finsavvyai start service all")
        if code == 0:
            self.log_test(
                "finsavvyai start service all", "Start all services", "Success", "PASS"
            )

            # Wait a moment for services to start
            time.sleep(3)

            # Test stop all services
            code, stdout, stderr = self.run_command("finsavvyai stop service all")
            if code == 0:
                self.log_test(
                    "finsavvyai stop service all",
                    "Stop all services",
                    "Success",
                    "PASS",
                )
            else:
                self.log_test(
                    "finsavvyai stop service all",
                    "Stop all services",
                    "Failed",
                    "FAIL",
                    stderr,
                )
        else:
            self.log_test(
                "finsavvyai start service all",
                "Start all services",
                "Failed",
                "FAIL",
                stderr,
            )

    def test_individual_services(self):
        """Test individual service management"""
        print("🎯 Testing Individual Services")
        print("=" * 40)

        services = ["master", "worker"]

        for service in services:
            # Test start individual service
            code, stdout, stderr = self.run_command(
                f"finsavvyai start service {service}"
            )
            if code == 0:
                self.log_test(
                    f"finsavvyai start service {service}",
                    f"Start {service}",
                    "Success",
                    "PASS",
                )

                # Wait for service to start
                time.sleep(2)

                # Test stop individual service
                code, stdout, stderr = self.run_command(
                    f"finsavvyai stop service {service}"
                )
                if code == 0:
                    self.log_test(
                        f"finsavvyai stop service {service}",
                        f"Stop {service}",
                        "Success",
                        "PASS",
                    )
                else:
                    self.log_test(
                        f"finsavvyai stop service {service}",
                        f"Stop {service}",
                        "Failed",
                        "FAIL",
                        stderr,
                    )
            else:
                self.log_test(
                    f"finsavvyai start service {service}",
                    f"Start {service}",
                    "Failed",
                    "FAIL",
                    stderr,
                )

    def test_error_handling(self):
        """Test error handling"""
        print("🚨 Testing Error Handling")
        print("=" * 40)

        # Test invalid subcommand
        code, stdout, stderr = self.run_command("finsavvyai describe invalid")
        if code != 0 and "error" in stderr:
            self.log_test(
                "finsavvyai describe invalid",
                "Invalid subcommand error",
                "Proper error",
                "PASS",
            )
        else:
            self.log_test(
                "finsavvyai describe invalid",
                "Invalid subcommand error",
                "No error",
                "FAIL",
            )

        # Test invalid service type
        code, stdout, stderr = self.run_command("finsavvyai start service invalid")
        if code != 0:
            self.log_test(
                "finsavvyai start service invalid",
                "Invalid service error",
                "Proper error",
                "PASS",
            )
        else:
            self.log_test(
                "finsavvyai start service invalid",
                "Invalid service error",
                "No error",
                "FAIL",
            )

    def test_cli_path_resolution(self):
        """Test CLI path resolution after reorganization"""
        print("🛠️ Testing CLI Path Resolution")
        print("=" * 40)

        # Test finsavvyai command exists
        code, stdout, stderr = self.run_command("which finsavvyai")
        if code == 0:
            self.log_test(
                "which finsavvyai",
                "CLI path resolution",
                "CLI found",
                "PASS",
                stdout.strip(),
            )
        else:
            self.log_test(
                "which finsavvyai",
                "CLI path resolution",
                "CLI not found",
                "FAIL",
                stderr,
            )

        # Test finsavvyai is executable
        code, stdout, stderr = self.run_command("finsavvyai --version")
        if code == 0:
            self.log_test(
                "finsavvyai --version", "CLI version check", "Version displayed", "PASS"
            )
        else:
            self.log_test(
                "finsavvyai --version",
                "CLI version check",
                "No version",
                "FAIL",
                stderr,
            )

    def run_all_tests(self):
        """Run all tests"""
        print(f"🧪 Starting Comprehensive CLI Test Suite")
        print(f"⏰ Started at: {self.start_time}")
        print("=" * 60)
        print()

        try:
            self.test_cli_path_resolution()
            self.test_help_command()
            self.test_describe_commands()
            self.test_output_formats()
            self.test_global_options()
            self.test_error_handling()
            self.test_service_management()
            self.test_individual_services()

        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            import traceback

            traceback.print_exc()

        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        end_time = datetime.now()
        duration = end_time - self.start_time

        passed = len([t for t in self.test_results if t["status"] == "PASS"])
        failed = len([t for t in self.test_results if t["status"] == "FAIL"])
        total = len(self.test_results)

        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"⏰ Duration: {duration.total_seconds():.2f} seconds")
        print(f"📈 Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📊 Success Rate: {(passed / total * 100):.1f}%" if total > 0 else "N/A")
        print()

        if failed > 0:
            print("❌ FAILED TESTS:")
            print("-" * 40)
            for test in self.test_results:
                if test["status"] == "FAIL":
                    print(f"• {test['command']}: {test['details']}")
            print()

        # Save results to file
        results_file = (
            f"cli_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(results_file, "w") as f:
            json.dump(self.test_results, f, indent=2)

        print(f"📄 Detailed results saved to: {results_file}")
        print()

        if failed == 0:
            print("🎉 ALL TESTS PASSED! CLI is working perfectly!")
        else:
            print("⚠️  Some tests failed. Please review and fix the issues.")


if __name__ == "__main__":
    tester = CLITester()
    tester.run_all_tests()
