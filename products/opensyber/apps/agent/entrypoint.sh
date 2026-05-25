#!/bin/bash
set -e

# Start auditd for shell command monitoring
service auditd start 2>/dev/null || true

# Start fail2ban for brute force protection
service fail2ban start 2>/dev/null || true

# Initialize default firewall rules — block all outbound except DNS and loopback.
# The agent's Firewall module applies fine-grained rules (API host, skill domains)
# after boot when it fetches policies from the API.
if command -v iptables &>/dev/null; then
  # Allow loopback
  iptables -A OUTPUT -o lo -j ACCEPT
  # Allow established/related (return traffic for accepted connections)
  iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
  # Allow DNS resolution (UDP + TCP port 53)
  iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
  iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
  # Allow HTTPS to API (agent needs to reach the API on boot)
  iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
  # Default: drop all other outbound traffic
  iptables -P OUTPUT DROP
  echo "[Firewall] Default outbound policy applied"
fi

# Start SSH daemon
/usr/sbin/sshd

# Drop root before running the Node process. iptables/auditd/fail2ban/sshd
# remain managed by the container's PID 1 init, but application code does
# not need (and must not have) root.
exec gosu syberagent node dist/index.js
