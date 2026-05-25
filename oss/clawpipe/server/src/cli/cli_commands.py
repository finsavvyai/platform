"""CLI command implementations: describe, service management."""

import asyncio, os, subprocess
from datetime import datetime
from typing import Optional
from src.cli.cli_format import Column


async def describe_clusters(cli) -> bool:
    success, data = await cli.make_request("GET", "/cluster/status")
    if not success:
        print(cli.formatter.format_error(data.get("error", "Failed to get cluster status"), data.get("code")))
        return False
    cluster_info = [{
        "ClusterId": data.get("cluster_id", "unknown"),
        "Status": cli.formatter._colorize("AVAILABLE", "green"),
        "Master": data.get("master", "unknown"),
        "Nodes": str(data.get("total_nodes", 0)),
        "OnlineNodes": str(data.get("online_nodes", 0)),
        "Created": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }]
    columns = [
        Column("ClusterId", 20), Column("Status", 12, color="green"),
        Column("Master", 20), Column("Nodes", 8),
        Column("OnlineNodes", 8), Column("Created", 20),
    ]
    cli._print_header("CLUSTERS", "Describe FinSavvyAI clusters")
    print(cli.formatter.format_table(cluster_info, columns))
    return True


async def describe_nodes(cli, detailed: bool = False) -> bool:
    success, data = await cli.make_request("GET", "/cluster/nodes")
    if not success:
        print(cli.formatter.format_error(data.get("error", "Failed to get nodes"), data.get("code")))
        return False
    if not data.get("nodes"):
        print(cli.formatter.format_warning("No nodes found in cluster"))
        return True
    if detailed:
        for i, node in enumerate(data["nodes"]):
            cli._print_header(f"NODE {i + 1}", node.get("name", "Unknown"))
            for key, field in [("Id", "id"), ("Name", "name"), ("Host", "host"), ("Port", "port")]:
                print(cli.formatter.format_key_value(key, str(node.get(field, "unknown"))))
            status = node.get("status", "unknown")
            print(cli.formatter.format_key_value("Status", status, value_color="green" if status == "online" else "red"))
            print(cli.formatter.format_key_value("Load", f"{node.get('load', 0)}/{node.get('max_load', 100)}"))
            print(cli.formatter.format_key_value("Models", ", ".join(node.get("models", []))))
            print()
    else:
        node_info = []
        for node in data["nodes"]:
            status = node.get("status", "unknown")
            node_info.append({
                "NodeId": node.get("id", "unknown")[:20],
                "Name": node.get("name", "unknown")[:25],
                "Host": node.get("host", "unknown"),
                "Port": str(node.get("port", "unknown")),
                "Status": cli.formatter._colorize(status.upper(), "green" if status == "online" else "red"),
                "Models": str(len(node.get("models", []))),
                "Load": f"{node.get('load', 0)}/{node.get('max_load', 100)}",
            })
        columns = [
            Column("NodeId", 20), Column("Name", 25), Column("Host", 15),
            Column("Port", 6), Column("Status", 10), Column("Models", 8), Column("Load", 10),
        ]
        cli._print_header("NODES", "Describe FinSavvyAI cluster nodes")
        print(cli.formatter.format_table(node_info, columns))
    return True


async def get_service_status(cli) -> bool:
    cli._print_header("SERVICE STATUS", "FinSavvyAI cluster service status")
    services_info = []
    for svc, port in [("master", cli.master_port), ("worker", cli.worker_port)]:
        running = False
        try:
            result = subprocess.run(["lsof", "-i", f":{port}"], capture_output=True, text=True)
            running = result.returncode == 0
        except Exception:
            pass
        services_info.append({
            "Service": svc,
            "Status": cli.formatter._colorize("RUNNING" if running else "STOPPED", "green" if running else "red"),
            "Port": str(port), "Endpoint": f"http://{cli.master_host}:{port}",
            "_running": running,
        })
    columns = [Column("Service", 10), Column("Status", 10), Column("Port", 6), Column("Endpoint", 30)]
    print(cli.formatter.format_table(services_info, columns))
    print()
    all_running = all(s["_running"] for s in services_info)
    print(cli.formatter.format_key_value(
        "Cluster Status", "AVAILABLE" if all_running else "UNAVAILABLE",
        value_color="green" if all_running else "red",
    ))
    print(cli.formatter.format_key_value("Local IP", cli._get_local_ip()))
    print(cli.formatter.format_key_value("API Key", "configured via FINSAVVYAI_API_KEY"))
    return True


def _pid_file_path(service: str) -> str:
    return os.path.join(os.getcwd(), f".{service}.pid")


def _write_pid(service: str, pid: int):
    with open(_pid_file_path(service), "w") as f:
        f.write(str(pid))

def _read_pid(service: str) -> Optional[int]:
    path = _pid_file_path(service)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            pid = int(f.read().strip())
        os.kill(pid, 0)
        return pid
    except (ValueError, ProcessLookupError, PermissionError):
        try: os.remove(path)
        except OSError: pass
        return None

def _remove_pid(service: str):
    try: os.remove(_pid_file_path(service))
    except OSError: pass


def _service_scripts():
    base = os.path.join(os.path.dirname(__file__), "../..")
    return {
        "master": ("Cluster Master", os.path.join(base, "core/start_master.py")),
        "worker": ("Worker Node", os.path.join(base, "workers/worker_node.py")),
    }


async def start_services(cli, service: str = "all", foreground: bool = False) -> bool:
    cli._print_header("START SERVICE", f"Starting {service} service(s)")
    scripts = _service_scripts()
    targets = [service] if service != "all" else ["master", "worker"]
    for svc_type in targets:
        svc_name, script_path = scripts[svc_type]
        print(f"Starting {svc_name}...", end=" ", flush=True)
        try:
            if _read_pid(svc_type):
                print(cli.formatter.format_warning("Already running"))
                continue
            if foreground and svc_type == "master":
                print()
                subprocess.run(["python3", script_path], cwd=os.getcwd())
            else:
                extra = ["--master", cli.master_host] if svc_type == "worker" else []
                proc = subprocess.Popen(
                    ["python3", script_path] + extra, cwd=os.getcwd(),
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                await asyncio.sleep(2)
                if proc.poll() is None:
                    _write_pid(svc_type, proc.pid)
                    print(cli.formatter.format_success(f"Running (PID {proc.pid})"))
                else:
                    return False
        except Exception as e:
            print(cli.formatter.format_error(str(e)))
            return False
    if not foreground:
        print(cli.formatter.format_success(f"\n{service.upper()} started"))
    return True


async def stop_services(cli, service: str = "all") -> bool:
    cli._print_header("STOP SERVICE", f"Stopping {service} service(s)")
    services = []
    if service in ["all", "master"]:
        services.append(("master", "Cluster Master"))
    if service in ["all", "worker"]:
        services.append(("worker", "Worker Node"))
    for svc_type, svc_name in services:
        print(f"Stopping {svc_name}...", end=" ", flush=True)
        try:
            pid = _read_pid(svc_type)
            if pid:
                os.kill(pid, 15)
                for _ in range(10):
                    try:
                        os.kill(pid, 0)
                        await asyncio.sleep(0.5)
                    except ProcessLookupError:
                        break
                _remove_pid(svc_type)
                print(cli.formatter.format_success(f"Stopped (PID {pid})"))
            else:
                print(cli.formatter.format_warning("Not running"))
        except Exception as e:
            print(cli.formatter.format_error(str(e)))
            return False
    print()
    print(cli.formatter.format_success(f"{service.upper()} service(s) stopped successfully"))
    return True
