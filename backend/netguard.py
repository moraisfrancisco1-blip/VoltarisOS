"""Guard for server-side connections to user-supplied destinations (SSRF).

Several features make the *server* connect to an address a user typed in:
device connection tests, the EV-charger endpoints (Modbus TCP) and webhook
delivery. Without a guard, a tenant can point those at the cloud metadata
service (169.254.169.254), localhost or the internal network and use the server
as a proxy / port scanner.

Policy
------
* Always blocked: link-local (cloud metadata), unspecified, multicast and
  reserved ranges.
* Blocked unless private destinations are allowed: loopback, RFC 1918, carrier
  NAT (100.64/10), IPv6 unique-local, and obviously internal names
  (``localhost``, ``*.internal``, ``*.local``, ...).
* Private destinations are allowed in development and blocked in production.
  Override with ``ALLOW_PRIVATE_DESTINATIONS=true|false`` (a single-tenant
  on-prem install that really talks to LAN equipment sets it to ``true``).
  In the cloud, equipment on a customer LAN is reached by the gateway
  (``gateway/``), not by the backend.

Limitations: the check resolves the name and the HTTP/Modbus client resolves it
again, so a DNS-rebinding attacker with a very short TTL can still race it.
It is a strong first line; the complete answer is egress filtering at the
network level.
"""
from __future__ import annotations

import asyncio
import ipaddress
import os
import socket
from urllib.parse import urlsplit


class BlockedDestination(ValueError):
    """Raised when a destination must not be contacted by the server."""


_ALWAYS_BLOCKED = tuple(
    ipaddress.ip_network(n)
    for n in (
        "0.0.0.0/8",        # "this" network / unspecified
        "169.254.0.0/16",   # link-local, incl. the cloud metadata service
        "224.0.0.0/4",      # multicast
        "240.0.0.0/4",      # reserved
        "::/128",
        "fe80::/10",        # IPv6 link-local
        "ff00::/8",         # IPv6 multicast
    )
)

_PRIVATE = tuple(
    ipaddress.ip_network(n)
    for n in (
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "100.64.0.0/10",    # carrier-grade NAT (also used by some cloud networks)
        "::1/128",
        "fc00::/7",         # IPv6 unique-local
    )
)

_INTERNAL_SUFFIXES = (".internal", ".local", ".localhost", ".lan", ".home.arpa", ".svc", ".cluster.local")


def private_allowed() -> bool:
    flag = os.getenv("ALLOW_PRIVATE_DESTINATIONS", "").strip()
    if flag:  # an empty value (e.g. copied from .env.example) means "not set"
        return flag.lower() in ("1", "true", "yes", "on")
    return os.getenv("ENVIRONMENT", "development") != "production"


def _check_ip(ip: ipaddress._BaseAddress, allow_private: bool) -> None:
    # IPv4-mapped IPv6 (::ffff:10.0.0.1) must be judged as the IPv4 address.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    if any(ip in net for net in _ALWAYS_BLOCKED):
        raise BlockedDestination("Destino não permitido (endereço reservado ou de metadados).")
    if not allow_private and any(ip in net for net in _PRIVATE):
        raise BlockedDestination("Destino não permitido (endereço interno/privado).")


def _normalise_host(host: str) -> str:
    host = (host or "").strip().lower().rstrip(".")
    if host.startswith("[") and host.endswith("]"):
        host = host[1:-1]
    return host


def check_host(host: str, *, allow_private: bool | None = None, resolve: bool = True) -> None:
    """Raise BlockedDestination unless ``host`` (name or IP, no port) is safe.

    ``resolve=False`` only does the checks that need no network (IP literals and
    internal-looking names) -- used when validating input; the delivery path
    calls it again with ``resolve=True``.
    """
    if allow_private is None:
        allow_private = private_allowed()
    host = _normalise_host(host)
    if not host:
        raise BlockedDestination("Destino em falta.")

    try:
        _check_ip(ipaddress.ip_address(host), allow_private)
        return
    except ValueError as exc:
        if isinstance(exc, BlockedDestination):
            raise
        # not an IP literal: treat as a hostname

    if not allow_private and (host == "localhost" or host.endswith(_INTERNAL_SUFFIXES)):
        raise BlockedDestination("Destino não permitido (nome interno).")

    if not resolve:
        return
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise BlockedDestination("Não foi possível resolver o destino.")
    if not infos:
        raise BlockedDestination("Não foi possível resolver o destino.")
    # EVERY resolved address must be allowed (a name can return several).
    for info in infos:
        _check_ip(ipaddress.ip_address(info[4][0]), allow_private)


def check_url(
    url: str,
    *,
    schemes: tuple[str, ...] = ("http", "https"),
    allow_private: bool | None = None,
    resolve: bool = True,
) -> str:
    """Validate a URL and return its hostname; raise BlockedDestination otherwise."""
    try:
        parts = urlsplit(url)
        host = parts.hostname
        _ = parts.port  # raises ValueError on an invalid port
    except ValueError:
        raise BlockedDestination("URL inválido.")
    if parts.scheme not in schemes:
        raise BlockedDestination(f"Esquema não permitido (use {', '.join(schemes)}).")
    if not host:
        raise BlockedDestination("URL sem endereço.")
    check_host(host, allow_private=allow_private, resolve=resolve)
    return host


async def acheck_host(host: str, **kwargs) -> None:
    """Async wrapper: DNS resolution is blocking, keep it off the event loop."""
    await asyncio.to_thread(check_host, host, **kwargs)


async def acheck_url(url: str, **kwargs) -> str:
    return await asyncio.to_thread(check_url, url, **kwargs)
