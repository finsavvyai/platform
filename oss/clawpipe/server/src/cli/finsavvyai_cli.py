"""FinSavvyAI CLI - Professional AWS-style command line interface."""

import argparse
import asyncio
import json
import socket
import sys
from typing import Tuple

from src.cli.cli_commands import (
    describe_clusters,
    describe_nodes,
    get_service_status,
    start_services,
    stop_services,
)
from src.cli.cli_doctor import run_doctor, run_quickstart
from src.cli.cli_format import AWSStyleFormatter, Color, OutputFormat
from src.core.config import ClusterConfig


class FinSavvyAICLI:
    """Professional AWS-style FinSavvyAI CLI."""

    def __init__(self):
        self._config = ClusterConfig()
        self.master_host = self._config.master_host or "localhost"
        self.master_port = self._config.master_port
        self.worker_port = self._config.worker_port
        self.session = None
        self.output_format = OutputFormat.TABLE
        self.verbose = False
        self.region = "home-cluster-1"
        self.profile = "default"
        self._aiohttp = None
        self.formatter = AWSStyleFormatter(self.output_format)
        self.service_name = "finsavvyai"
        self.version = "1.0.0"
        self.api_version = "2023-11-20"

    def _get_aiohttp(self):
        if self._aiohttp is not None:
            return self._aiohttp
        try:
            import aiohttp as aiohttp_module
        except ImportError as exc:
            raise RuntimeError("Missing dependency: aiohttp. Install requirements.txt.") from exc
        self._aiohttp = aiohttp_module
        return self._aiohttp

    def _get_local_ip(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def _print_header(self, title: str, subtitle: str = None):
        print(self.formatter._colorize(title.upper(), "bold"))
        if subtitle:
            print(self.formatter._colorize(subtitle, "gray"))
        print()

    def _print_aws_header(self):
        print(f"{self.formatter._colorize('aws finsavvyai', 'bold')} version {self.version}")
        if self.verbose:
            print(f"{self.formatter._colorize('API Version:', 'gray')} {self.api_version}")
            print(f"{self.formatter._colorize('Region:', 'gray')} {self.region}")
            print(f"{self.formatter._colorize('Profile:', 'gray')} {self.profile}")
        print()

    async def _start_session(self):
        aiohttp_module = self._get_aiohttp()
        self.session = aiohttp_module.ClientSession(
            timeout=aiohttp_module.ClientTimeout(total=30),
            headers={"User-Agent": f"aws-cli/{self.version} FinSavvyAI/{self.version}"},
        )

    async def _close_session(self):
        if self.session:
            await self.session.close()

    async def make_request(self, method: str, endpoint: str, data: dict = None) -> Tuple[bool, dict]:
        if not self.session:
            await self._start_session()
        url = f"http://{self.master_host}:{self.master_port}{endpoint}"
        try:
            if self.verbose:
                print(self.formatter._colorize(f"Request: {method} {url}", "dim"))
            async with self.session.request(method, url, json=data) as response:
                resp_data = await response.json() if response.content_type == "application/json" else await response.text()
                if response.status < 400:
                    return True, resp_data
                return False, {"error": str(resp_data), "code": f"Http{response.status}"}
        except asyncio.TimeoutError:
            return False, {"error": "Request timeout", "code": "TimeoutError"}
        except RuntimeError as e:
            return False, {"error": str(e), "code": "MissingDependency"}
        except Exception as e:
            return False, {"error": str(e), "code": "ConnectionError"}

    async def show_help(self):
        self._print_aws_header()
        c = self.formatter._colorize
        print(f"{c('USAGE', 'bold')}\n    {c('aws finsavvyai', 'cyan')} <command> [options]\n")
        print(f"{c('COMMANDS', 'bold')}")
        for cmd, desc in [
            ("describe clusters", "List clusters"), ("describe nodes", "List nodes (--detailed)"),
            ("describe services", "Service status"), ("start service", "Start [all|master|worker]"),
            ("stop service", "Stop [all|master|worker]"),
            ("doctor", "Check system health and configuration"),
            ("quickstart", "Print setup guide and one-liner commands"),
            ("help", "Show this help"),
        ]:
            print(f"    {c(cmd, 'cyan'):30s} {desc}")
        print(f"\n{c('OPTIONS', 'bold')}")
        for opt, desc in [("--region", "Region"), ("--output", "Format [json|table|yaml]"), ("--verbose", "Verbose"), ("--no-color", "No colors")]:
            print(f"    {c(opt, 'yellow'):30s} {desc}")
        print()

    def _create_parser(self):
        parser = argparse.ArgumentParser(prog="aws finsavvyai")
        parser.add_argument("--region", default="home-cluster-1")
        parser.add_argument("--output", choices=["json", "table", "yaml", "text"], default="table")
        parser.add_argument("--profile", default="default")
        parser.add_argument("--verbose", action="store_true")
        parser.add_argument("--no-color", action="store_true")
        parser.add_argument("--version", action="version", version="FinSavvyAI CLI 1.0.0")
        sub = parser.add_subparsers(dest="command")
        desc = sub.add_parser("describe")
        desc_sub = desc.add_subparsers(dest="resource")
        desc_sub.add_parser("clusters")
        nodes_p = desc_sub.add_parser("nodes")
        nodes_p.add_argument("--detailed", action="store_true")
        desc_sub.add_parser("services")
        start = sub.add_parser("start")
        start_sub = start.add_subparsers(dest="target")
        svc = start_sub.add_parser("service")
        svc.add_argument("service_type", choices=["all", "master", "worker"], default="all", nargs="?")
        svc.add_argument("--foreground", action="store_true")
        stop = sub.add_parser("stop")
        stop_sub = stop.add_subparsers(dest="target")
        stop_svc = stop_sub.add_parser("service")
        stop_svc.add_argument("service_type", choices=["all", "master", "worker"], default="all", nargs="?")
        sub.add_parser("help")
        sub.add_parser("doctor")
        sub.add_parser("quickstart")
        return parser

    async def _async_main(self, args):
        try:
            if args.command == "help" or not args.command:
                await self.show_help()
            elif args.command == "describe":
                if args.resource == "clusters":
                    await describe_clusters(self)
                elif args.resource == "nodes":
                    await describe_nodes(self, getattr(args, "detailed", False))
                elif args.resource == "services":
                    await get_service_status(self)
                else:
                    await self.show_help()
            elif args.command == "start":
                svc_type = getattr(args, "service_type", "all")
                fg = getattr(args, "foreground", False)
                await start_services(self, svc_type, fg)
            elif args.command == "stop":
                await stop_services(self, getattr(args, "service_type", "all"))
            elif args.command == "doctor":
                await run_doctor(self)
            elif args.command == "quickstart":
                await run_quickstart(self)
            else:
                await self.show_help()
        except KeyboardInterrupt:
            print(f"\n{self.formatter.format_error('Operation cancelled')}")
        except Exception as e:
            print(f"\n{self.formatter.format_error(str(e))}")
            if self.verbose:
                import traceback
                traceback.print_exc()
        finally:
            await self._close_session()

    def main(self):
        args = self._create_parser().parse_args()
        self.output_format = OutputFormat(args.output)
        self.formatter = AWSStyleFormatter(self.output_format)
        self.region, self.profile, self.verbose = args.region, args.profile, args.verbose
        if args.no_color:
            for attr in dir(Color):
                if not attr.startswith("_"):
                    setattr(Color, attr, "")
        return asyncio.run(self._async_main(args))

if __name__ == "__main__":
    sys.exit(FinSavvyAICLI().main())
