import ipaddress
import socket

def is_safe_domain(domain: str) -> bool:
    """Check if the domain resolves to a public IP to prevent SSRF."""
    try:
        ip_addr = socket.gethostbyname(domain)
        ip = ipaddress.ip_address(ip_addr)
        return not ip.is_private and not ip.is_loopback and not ip.is_multicast
    except Exception:
        return False
