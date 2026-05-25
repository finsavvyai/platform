-- Seed: Realistic security events across both agent instances
-- Spread over the last 30 days for the public threat intelligence feed
-- These are representative of real-world AI agent security patterns

INSERT OR IGNORE INTO security_events (id, instance_id, event_type, severity, skill_id, source_ip, source_country, details, created_at) VALUES
-- Today (critical events)
('ev_001', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'credential_access', 'critical', NULL, '185.220.101.42', 'RU', '{"path":"~/.ssh/id_rsa","agent":"cursor-ai","action":"blocked","rule":"fs-credential-guard"}', datetime('now', '-23 minutes')),
('ev_002', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'unauthorized_network', 'critical', NULL, '45.155.205.89', 'CN', '{"domain":"exfil.darknet.xyz","port":443,"protocol":"https","action":"blocked"}', datetime('now', '-2 hours')),
('ev_003', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'skill_blocked', 'critical', 'sk_unknown_pkg', '103.224.182.11', 'VN', '{"skill":"crypto-helper-v2","reason":"known_malicious_package","scanner_score":12}', datetime('now', '-5 hours')),

-- Today (warnings)
('ev_004', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'anomaly_detected', 'warning', NULL, '91.108.56.170', 'DE', '{"type":"unusual_file_access_pattern","files_accessed":47,"threshold":20,"agent":"claude-code"}', datetime('now', '-1 hour')),
('ev_005', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'brute_force_attempt', 'warning', NULL, '112.85.42.88', 'CN', '{"attempts":23,"target":"api-gateway","window_minutes":5}', datetime('now', '-3 hours')),
('ev_006', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'file_access_violation', 'warning', NULL, '192.168.1.1', NULL, '{"path":"/etc/shadow","agent":"openai-agent","action":"denied"}', datetime('now', '-6 hours')),

-- Today (info)
('ev_007', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'skill_installed', 'info', 'sk_secret_scanner', NULL, NULL, '{"version":"1.2.0","source":"marketplace","verified":true}', datetime('now', '-30 minutes')),
('ev_008', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'update_applied', 'info', NULL, NULL, NULL, '{"from":"0.2.8","to":"0.3.0","type":"security_patch"}', datetime('now', '-4 hours')),
('ev_009', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'instance_hardened', 'info', NULL, NULL, NULL, '{"seccomp":"enforced","readonly_rootfs":true,"capabilities_dropped":14}', datetime('now', '-8 hours')),

-- Yesterday
('ev_010', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'credential_access', 'critical', NULL, '23.106.122.196', 'US', '{"path":".env.production","agent":"cursor-ai","action":"blocked","contained":true}', datetime('now', '-1 day', '-2 hours')),
('ev_011', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'unauthorized_network', 'warning', NULL, '94.130.167.41', 'DE', '{"domain":"pastebin.com","port":443,"reason":"data_exfil_risk"}', datetime('now', '-1 day', '-5 hours')),
('ev_012', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'skill_installed', 'info', 'sk_dep_audit', NULL, NULL, '{"version":"2.0.1","source":"marketplace","verified":true}', datetime('now', '-1 day', '-8 hours')),
('ev_013', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'anomaly_detected', 'warning', NULL, '176.119.22.33', 'UA', '{"type":"env_enumeration","vars_accessed":12,"agent":"windsurf"}', datetime('now', '-1 day', '-12 hours')),

-- 2 days ago
('ev_014', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'skill_blocked', 'critical', NULL, '185.56.83.74', 'NL', '{"skill":"npm-helper-utils","reason":"postinstall_exec","scanner_score":8}', datetime('now', '-2 days', '-3 hours')),
('ev_015', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'file_access_violation', 'warning', NULL, NULL, NULL, '{"path":"/proc/self/environ","agent":"github-copilot","action":"denied"}', datetime('now', '-2 days', '-7 hours')),
('ev_016', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'update_applied', 'info', NULL, NULL, NULL, '{"from":"0.2.7","to":"0.2.8","type":"dependency_update"}', datetime('now', '-2 days', '-14 hours')),

-- 3-5 days ago
('ev_017', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'unauthorized_network', 'critical', NULL, '5.188.62.18', 'RU', '{"domain":"c2.badactor.io","port":8443,"protocol":"https","action":"blocked"}', datetime('now', '-3 days', '-6 hours')),
('ev_018', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'brute_force_attempt', 'warning', NULL, '58.218.198.44', 'CN', '{"attempts":156,"target":"ssh","window_minutes":30}', datetime('now', '-3 days', '-10 hours')),
('ev_019', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'skill_installed', 'info', 'sk_supply_chain', NULL, NULL, '{"version":"1.3.0","source":"marketplace","verified":true}', datetime('now', '-4 days', '-2 hours')),
('ev_020', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'credential_access', 'critical', NULL, '31.13.72.11', 'IE', '{"path":"~/.aws/credentials","agent":"claude-code","action":"blocked"}', datetime('now', '-4 days', '-9 hours')),
('ev_021', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'anomaly_detected', 'warning', NULL, '104.28.210.5', 'US', '{"type":"lateral_movement","target_ips":3,"agent":"openai-agent"}', datetime('now', '-5 days', '-4 hours')),

-- 1-2 weeks ago
('ev_022', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'skill_blocked', 'critical', NULL, '89.248.167.131', 'NL', '{"skill":"eslint-config-standard2","reason":"typosquatting","real_package":"eslint-config-standard"}', datetime('now', '-7 days', '-3 hours')),
('ev_023', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'unauthorized_network', 'warning', NULL, '45.33.32.156', 'US', '{"domain":"requestbin.com","port":443,"reason":"potential_exfil"}', datetime('now', '-8 days', '-11 hours')),
('ev_024', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'instance_hardened', 'info', NULL, NULL, NULL, '{"seccomp":"enforced","network_policy":"applied","egress_rules":5}', datetime('now', '-9 days', '-6 hours')),
('ev_025', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'file_access_violation', 'critical', NULL, NULL, NULL, '{"path":"/var/run/docker.sock","agent":"cursor-ai","action":"blocked","escalation":"container_escape_attempt"}', datetime('now', '-10 days', '-2 hours')),
('ev_026', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'brute_force_attempt', 'warning', NULL, '222.186.42.7', 'CN', '{"attempts":89,"target":"api-gateway","window_minutes":15}', datetime('now', '-11 days', '-8 hours')),
('ev_027', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'skill_installed', 'info', 'sk_cursor_monitor', NULL, NULL, '{"version":"1.0.0","source":"marketplace","verified":true}', datetime('now', '-12 days', '-5 hours')),

-- 2-4 weeks ago
('ev_028', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'credential_access', 'critical', NULL, '195.54.160.83', 'DE', '{"path":".env.local","agent":"windsurf","action":"blocked"}', datetime('now', '-14 days', '-7 hours')),
('ev_029', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'unauthorized_network', 'critical', NULL, '77.247.181.162', 'RO', '{"domain":"tor-exit.relay.net","port":9001,"action":"blocked","reason":"tor_exit_node"}', datetime('now', '-16 days', '-4 hours')),
('ev_030', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'anomaly_detected', 'warning', NULL, '198.51.100.23', 'US', '{"type":"mass_file_download","files":234,"size_mb":89,"agent":"openai-agent"}', datetime('now', '-18 days', '-10 hours')),
('ev_031', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'skill_blocked', 'critical', NULL, '141.8.224.93', 'BR', '{"skill":"lodash-utils-v2","reason":"env_exfiltration_pattern","scanner_score":5}', datetime('now', '-20 days', '-1 hour')),
('ev_032', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'update_applied', 'info', NULL, NULL, NULL, '{"from":"0.2.5","to":"0.2.7","type":"security_patch","cves_fixed":2}', datetime('now', '-22 days', '-6 hours')),
('ev_033', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'file_access_violation', 'warning', NULL, NULL, NULL, '{"path":"~/.gitconfig","agent":"github-copilot","action":"logged"}', datetime('now', '-24 days', '-3 hours')),
('ev_034', 'e6b58985-0b00-418d-8f3a-4da9e7930d8e', 'instance_hardened', 'info', NULL, NULL, NULL, '{"seccomp":"enforced","readonly_rootfs":true,"capabilities_dropped":12}', datetime('now', '-26 days', '-9 hours')),
('ev_035', 'cd087432-7bc8-4db5-a19b-e6fd28e0afad', 'brute_force_attempt', 'critical', NULL, '185.100.87.202', 'SE', '{"attempts":1247,"target":"gateway","window_minutes":60,"action":"ip_banned"}', datetime('now', '-28 days', '-5 hours'));
