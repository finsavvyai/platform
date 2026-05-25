# OpenClaw Integration with UPM

**Created:** 2026-02-14
**Purpose:** Integrate Universal Dependency Platform (UPM) with OpenClaw to secure the AI agent skill supply chain

## Background: The ClawHavoc Supply Chain Attack

In February 2026, OpenClaw's ClawHub marketplace suffered a massive supply chain attack dubbed **"ClawHavoc"**:

- **341 malicious skills** discovered (12% of total skills)
- Malware distributed: **Atomic Stealer** (credential stealer for macOS/Windows)
- Attack vector: Poisoned community-developed AI agent skills
- Timeline: February 1-3, 2026
- Researchers: SlowMist, Koi Security

This attack demonstrates exactly why UPM is needed for AI agent platforms.

## Integration Architecture

### 1. OpenClaw Skill Package Analysis

OpenClaw skills are typically distributed as:
- Python packages with skill definitions
- Configuration files (skill.yaml, manifest.json)
- Dependencies listed in requirements.txt or setup.py

**UPM Integration Points:**

```python
# src/udp/ecosystems/openclaw.py
"""
OpenClaw Skill Ecosystem Adapter
"""

from typing import List, Dict, Any
from ..core.models import Dependency, Vulnerability
from .base import EcosystemAdapter

class OpenClawAdapter(EcosystemAdapter):
    """
    Adapter for analyzing OpenClaw AI agent skills.
    
    OpenClaw skills are Python packages that can contain:
    - Malicious code injection
    - Unsafe dependencies
    - Prompt injection vulnerabilities
    - Exposed API credentials
    """
    
    ECOSYSTEM = "openclaw"
    
    async def parse_dependencies(self, manifest_path: str) -> List[Dependency]:
        """
        Parse OpenClaw skill manifest and dependencies.
        
        Supports:
        - skill.yaml (OpenClaw native format)
        - setup.py / pyproject.toml (Python packaging)
        - requirements.txt
        """
        pass
    
    async def scan_skill_code(self, skill_path: str) -> Dict[str, Any]:
        """
        Scan skill source code for:
        - Suspicious imports (os.system, subprocess, eval)
        - Base64 encoded strings
        - External network calls
        - File system access
        - Credential harvesting patterns
        """
        pass
    
    async def generate_skill_sbom(self, skill_path: str) -> SBOM:
        """
        Generate SBOM for OpenClaw skill including:
        - All dependencies
        - Transitive dependencies
        - Skill metadata
        - Code hashes
        """
        pass
```

### 2. UPM API Endpoints for OpenClaw

```python
# src/udp/api/v1/endpoints/openclaw.py
"""
OpenClaw-specific API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from ..dependencies import get_current_user
from ....services.openclaw_scanner import OpenClawScanner
from ....services.openclaw_policy_enforcer import OpenClawPolicyEnforcer

router = APIRouter(prefix="/openclaw", tags=["openclaw"])

@router.post("/skills/scan")
async def scan_openclaw_skill(
    skill_url: str,
    depth: int = 3,
    current_user = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Scan an OpenClaw skill from ClawHub or local file.
    
    Returns:
        - Skill metadata
        - Dependency tree
        - Vulnerability report
        - Policy violations
        - Risk score
    """
    scanner = OpenClawScanner()
    return await scanner.scan_skill(skill_url, depth)

@router.get("/skills/{skill_id}/sbom")
async def get_skill_sbom(
    skill_id: str,
    format: str = "cyclonedx"
) -> Dict[str, Any]:
    """Generate SBOM for an OpenClaw skill."""
    pass

@router.post("/skills/validate")
async def validate_skill_manifest(
    manifest: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Validate OpenClaw skill manifest against security policies.
    
    Checks:
        - Required permissions
        - API usage
        - Data access patterns
        - Network endpoints
    """
    enforcer = OpenClawPolicyEnforcer()
    return await enforcer.validate(manifest)

@router.post("/marketplace/monitor")
async def monitor_marketplace(
    skills: List[str],
    webhook_url: str = None
) -> Dict[str, Any]:
    """
    Monitor multiple OpenClaw skills for new vulnerabilities.
    
    Can be integrated with ClawHub webhooks for real-time monitoring.
    """
    pass
```

### 3. OpenClaw Policy Enforcement

```python
# src/udp/services/openclaw_policy_enforcer.py
"""
Security policies for OpenClaw skills.
"""

from typing import List, Dict, Any, Optional
from ..core.models import PolicyViolation

class OpenClawPolicyEnforcer:
    """
    Enforce security policies for OpenClaw AI agent skills.
    
    Default policies based on ClawHavoc attack lessons learned.
    """
    
    DEFAULT_POLICIES = {
        # No credential harvesting
        "no_credential_harvesting": {
            "action": "block",
            "patterns": [
                "Keychain",
                "Credential",
                ".ssh/",
                "wallet.dat",
                "cookies.sqlite",
                "password",
                "api_key",
                "secret_key"
            ]
        },
        
        # No unauthorized network exfiltration
        "no_data_exfiltration": {
            "action": "block",
            "patterns": [
                "requests.post.*external",
                "urllib.*upload",
                "http.*exfiltrate"
            ]
        },
        
        # No base64 encoded payloads (common in malware)
        "no_obfuscated_code": {
            "action": "warn",
            "max_base64_length": 100
        },
        
        # No dynamic code execution
        "no_dynamic_execution": {
            "action": "block",
            "functions": [
                "eval",
                "exec",
                "compile",
                "__import__",
                "getattr",
                "setattr"
            ]
        },
        
        # Require SBOM for all skills
        "require_sbom": {
            "action": "block",
            "sbom_formats": ["cyclonedx", "spdx"]
        },
        
        # VirusTotal scanning required
        "require_malware_scan": {
            "action": "block",
            "scanner": "virustotal"
        },
        
        # Code signing verification
        "require_code_signing": {
            "action": "warn",
            "verify_signature": True
        }
    }
    
    async def validate_skill(
        self,
        skill_path: str,
        policies: Optional[Dict[str, Any]] = None
    ) -> List[PolicyViolation]:
        """
        Validate a skill against security policies.
        
        Returns list of policy violations.
        """
        pass
```

### 4. Real-Time ClawHub Monitoring

```python
# src/udp/services/openclaw_marketplace_monitor.py
"""
Monitor ClawHub marketplace for malicious skills.
"""

import asyncio
from typing import List, Dict, Any
from ..monitoring.workflow_logger import log_event
from .openclaw_scanner import OpenClawScanner

class OpenClawMarketplaceMonitor:
    """
    Monitor ClawHub for new and updated skills.
    
    Can be integrated with:
    - ClawHub webhooks
    - RSS feeds
    - GitHub API (if skills are hosted there)
    """
    
    async def monitor_new_skills(
        self,
        interval: int = 300  # 5 minutes
    ) -> None:
        """
        Continuously monitor for new skills.
        
        When a new skill is detected:
        1. Queue for scanning
        2. Generate SBOM
        3. Check against policies
        4. Alert if violations found
        """
        while True:
            new_skills = await self.fetch_new_skills()
            
            for skill in new_skills:
                await self.scan_and_alert(skill)
            
            await asyncio.sleep(interval)
    
    async def scan_and_alert(
        self,
        skill_url: str
    ) -> Dict[str, Any]:
        """
        Scan a skill and send alerts if needed.
        """
        scanner = OpenClawScanner()
        result = await scanner.scan_skill(skill_url)
        
        if result["violations"] or result["vulnerabilities"]:
            await self.send_alert(result)
        
        return result
```

## Integration with UPM Components

### 1. TEDDK Scanner Extension

Extend the existing TEDDK scanner to handle OpenClaw skills:

```python
# In teddk_scanner.py - add OpenClaw support

class UniversalVulnerabilityScanner:
    """
    Extended scanner supporting multiple ecosystems including OpenClaw.
    """
    
    SCANNERS = {
        "maven": MavenScanner,
        "npm": NpmScanner,
        "pypi": PyPIScanner,
        "openclaw": OpenClawSkillScanner,  # New
    }
    
    async def scan_openclaw_skill(
        self,
        skill_path: str
    ) -> ScanReport:
        """
        Scan OpenClaw skill for vulnerabilities.
        
        Checks:
        1. Skill dependencies (Python packages)
        2. Skill source code patterns
        3. VirusTotal integration
        4. Known malicious skill hashes
        """
        pass
```

### 2. IDE Extensions Support

**VS Code Extension:**
- Add OpenClaw skill file highlighting (skill.yaml, Python files)
- Show vulnerability warnings in skill editor
- Validate skills before publishing to ClawHub

**IntelliJ Plugin:**
- Python skill file validation
- Real-time skill security scanning
- Integration with PyCharm's Python tools

### 3. CLI Commands

```bash
# Scan an OpenClaw skill
upm openclaw scan ./my-skill/

# Generate SBOM for skill
upm openclaw sbom ./my-skill/ --format cyclonedx

# Validate skill against policies
upm openclaw validate ./my-skill/

# Monitor ClawHub for new skills
upm openclaw monitor --interval 300

# Check if skill hash matches known malware
upm openclaw check-hash <sha256>
```

## Deployment Options

### Option 1: Pre-Publish Hook

Integrate with OpenClaw's publishing pipeline to scan skills before they're published to ClawHub:

```yaml
# .clawhub/prepublish-hook.yaml
scanner: upm
endpoint: http://upm-server:8040/api/v1/openclaw/validate
block_on_violation: true
```

### Option 2: Post-Publish Monitor

Run UPM as a monitoring service that scans newly published skills and alerts on violations.

### Option 3: User-Side Scanner

Integrate UPM into the OpenClaw client to scan skills before installation.

## Implementation Priority

1. **Phase 1: Core Scanner** (2 weeks)
   - OpenClaw skill parser
   - Dependency extraction
   - Basic vulnerability scanning
   - SBOM generation

2. **Phase 2: Policy Enforcement** (1 week)
   - OpenClaw-specific policies
   - Code pattern matching
   - Malware detection integration

3. **Phase 3: Marketplace Monitoring** (1 week)
   - ClawHub integration
   - Real-time monitoring
   - Alerting system

4. **Phase 4: IDE Integration** (1 week)
   - VS Code extension updates
   - IntelliJ plugin updates
   - Pre-publish validation

## Security Considerations

1. **Skill Sandboxing**: All skills should be scanned in isolated environments
2. **Hash Verification**: Maintain database of known malicious skill hashes
3. **Version Tracking**: Track skill versions and their security status over time
4. **Dependency Pinning**: Encourage pinning all dependency versions
5. **Supply Chain Transparency**: Require SBOMs for all published skills

## References

- [ClawHavoc Attack Report](https://slowmist.io/blog/clawhavoc-attack/)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Atomic Stealer Malware Analysis](https://koi-security.io/atomic-stealer-analysis)
- [OpenClaw Documentation](https://docs.openclaw.ai/)
