"""
Marstek Venus (local Open API) read-only probe.

Asks a Marstek battery on the LOCAL network for its raw data and saves it to a
file, so the connector can be written against the real payloads and scales of
that exact unit instead of guesses. Standard library only, Python 3.8+.

  python marstek_probe.py                  # finds the battery by broadcast
  python marstek_probe.py --ip 192.168.1.50

Needs "Open API" switched on in the Marstek app (default UDP port 30000), and the
computer on the same Wi-Fi/LAN as the battery. It only READS: it never sends a
Set* command, so it cannot change the battery's mode or schedule. Network
identifiers (IP, MAC addresses, Wi-Fi name) are replaced by "<redacted>" in the
output unless --no-redact is given.

Protocol (UDP, JSON-RPC style, as used by the Marstek Open API clients):
  request   {"id": <int>, "method": "ES.GetStatus", "params": {"id": 0}}
  discovery {"id": 0, "method": "Marstek.GetDevice", "params": {"ble_mac": "0"}}
  The device answers to UDP port 30000 on the asking host, so this binds that port
  locally. Do not poll faster than every 60 s: devices are reported to get unstable.
"""
import argparse
import json
import socket
import sys
import time

DEFAULT_PORT = 30000

# Read-only methods only. Anything not in this tuple is never sent.
READ_ONLY_METHODS = (
    "Marstek.GetDevice",
    "ES.GetStatus",
    "ES.GetMode",
    "Bat.GetStatus",
    "PV.GetStatus",
    "EM.GetStatus",
)

REDACT_KEYS = {"target", "ip", "mac", "wifi_mac", "ble_mac", "wifi_name", "ssid", "bssid"}


def redact(value):
    """Replace network identifiers anywhere in a JSON-like structure."""
    if isinstance(value, dict):
        return {k: ("<redacted>" if k.lower() in REDACT_KEYS and v is not None else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def _broadcast_addresses():
    addrs = ["255.255.255.255"]
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("192.0.2.1", 9))  # no packet is sent; just learns the local interface
        local_ip = probe.getsockname()[0]
        probe.close()
        subnet_broadcast = ".".join(local_ip.split(".")[:3] + ["255"])  # assumes a /24 home network
        if subnet_broadcast not in addrs:
            addrs.append(subnet_broadcast)
    except OSError:
        pass
    return addrs


def _open_socket(local_port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.bind(("0.0.0.0", local_port))
    return sock


def _wait_for(sock, msg_id, timeout):
    """Next datagram whose JSON id matches msg_id, or None on timeout."""
    deadline = time.monotonic() + timeout
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None
        sock.settimeout(remaining)
        try:
            data, addr = sock.recvfrom(65535)
        except socket.timeout:
            return None
        except ConnectionResetError:
            continue  # Windows reports an earlier ICMP "port unreachable" this way; keep waiting
        try:
            message = json.loads(data.decode("utf-8", errors="replace"))
        except ValueError:
            continue
        if isinstance(message, dict) and message.get("id") == msg_id:
            return message, addr


def discover(sock, remote_port, seconds=6.0):
    """Broadcast Marstek.GetDevice; returns [(ip, result_dict)] for every answer."""
    request = json.dumps({"id": 0, "method": "Marstek.GetDevice", "params": {"ble_mac": "0"}}).encode()
    found = {}
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        for addr in _broadcast_addresses():
            try:
                sock.sendto(request, (addr, remote_port))
            except OSError:
                pass
        answer = _wait_for(sock, 0, 2.0)
        if answer and isinstance(answer[0].get("result"), dict):
            found[answer[1][0]] = answer[0]["result"]
    return list(found.items())


def probe(ip=None, remote_port=DEFAULT_PORT, local_port=None, timeout=5.0, attempts=2, do_redact=True, pause=0.3):
    """Query every read-only method. Returns a JSON-serialisable dict."""
    local_port = remote_port if local_port is None else local_port
    sock = _open_socket(local_port)
    try:
        if ip is None:
            devices = discover(sock, remote_port)
            if not devices:
                raise RuntimeError("No Marstek device answered. Is Open API on, and are you on the same Wi-Fi?")
            if len(devices) > 1:
                print(f"Found {len(devices)} devices; using the first. Use --ip to pick another.", file=sys.stderr)
            ip = devices[0][0]

        out = {"probe_version": 1, "target": ip, "methods": {}}
        for msg_id, method in enumerate(READ_ONLY_METHODS, start=1):
            params = {"ble_mac": "0"} if method == "Marstek.GetDevice" else {"id": 0}
            request = json.dumps({"id": msg_id, "method": method, "params": params}).encode()
            entry = {"error": "no answer (timeout)"}
            for _ in range(attempts):
                sock.sendto(request, (ip, remote_port))
                answer = _wait_for(sock, msg_id, timeout)
                if answer:
                    entry = answer[0]
                    break
            out["methods"][method] = entry
            time.sleep(pause)  # be gentle with the device
        return redact(out) if do_redact else out
    finally:
        sock.close()


def main(argv=None):
    ap = argparse.ArgumentParser(description="Read-only probe of a Marstek battery's local Open API.")
    ap.add_argument("--ip", help="battery IP; omit to find it by broadcast")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT, help="UDP port set in the Marstek app (default 30000)")
    ap.add_argument("--out", default="marstek_probe_output.json", help="file to write")
    ap.add_argument("--no-redact", action="store_true", help="keep IP/MAC/Wi-Fi name in the output")
    args = ap.parse_args(argv)

    try:
        result = probe(ip=args.ip, remote_port=args.port, do_redact=not args.no_redact)
    except (OSError, RuntimeError) as e:
        print(f"Probe failed: {e}", file=sys.stderr)
        return 1

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nSaved to {args.out}. Send that file (or its text) back.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
