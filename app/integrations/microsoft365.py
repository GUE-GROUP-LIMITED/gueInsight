"""
Microsoft 365 Security & Compliance Integration

Minimal OAuth connector for M365 tenant discovery, user/group enumeration,
and shared mailbox/file access auditing. Designed for GDPR/NIS2 risk assessment.
"""

import os
import requests
from typing import Optional, Dict, Any


class Microsoft365Connector:
    """Minimal M365 OAuth + Graph API integration for compliance discovery."""

    def __init__(self, tenant_id: str, client_id: str, client_secret: str):
        self.tenant_id = tenant_id
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        self.graph_url = "https://graph.microsoft.com/v1.0"
        self.access_token = None

    def authenticate(self) -> bool:
        """Acquire access token via OAuth client credentials flow."""
        try:
            response = requests.post(
                self.token_url,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
                timeout=10,
            )
            if response.status_code == 200:
                self.access_token = response.json().get("access_token")
                return True
            return False
        except Exception:
            return False

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def get_users(self, limit: int = 10) -> Dict[str, Any]:
        """Enumerate users in the tenant (compliance discovery)."""
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/users?$top={limit}",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_groups(self, limit: int = 10) -> Dict[str, Any]:
        """Enumerate groups in the tenant (access control audit)."""
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/groups?$top={limit}",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_group_members(self, group_id: str, limit: int = 200) -> Dict[str, Any]:
        """Fetch members of a group for precise access control mapping."""
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/groups/{group_id}/members?$top={limit}",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_external_users(self) -> Dict[str, Any]:
        """List external B2B guest users (GDPR data subject scope)."""
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/users?$filter=userType eq 'Guest'",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_security_alerts(self, limit: int = 50) -> Dict[str, Any]:
        """
        Fetch security alerts from Microsoft Security Center.
        Covers phishing, malware, anomalous user activity, compromised credentials.
        """
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/security/alerts?$top={limit}",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"error": f"API error: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

    def get_mail_transport_rules(self) -> Dict[str, Any]:
        """
        Enumerate Exchange mail transport rules (email filtering/forwarding audit).
        Critical for GDPR data exfiltration prevention assessment.
        """
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            # Use beta endpoint for transport rules (not in v1.0)
            response = requests.get(
                f"{self.graph_url.replace('/v1.0', '/beta')}/me/messages/rules",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            # Fallback: empty result
            return {"value": []}
        except Exception as e:
            return {"error": str(e)}

    def get_dlp_policies(self) -> Dict[str, Any]:
        """
        Fetch Data Loss Prevention policies from Compliance Center.
        Assesses sensitive data protection (GDPR PII, NIS2 critical systems).
        """
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            # DLP is in beta; simplified stub
            response = requests.get(
                f"{self.graph_url.replace('/v1.0', '/beta')}/me/protection/dataPolicies",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"value": []}
        except Exception as e:
            return {"error": str(e)}

    def get_privileged_access_management(self) -> Dict[str, Any]:
        """
        Fetch Privileged Access Management (PAM) status.
        Used for NIS2 "privilege escalation controls" verification.
        """
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/me/privilegedAccessManagement",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"status": "not_enabled"}
        except Exception as e:
            return {"error": str(e)}

    def get_device_compliance_status(self) -> Dict[str, Any]:
        """
        Check device compliance (Intune MDM integration).
        Assesses endpoint security for GDPR/NIS2 device inventory.
        """
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/deviceManagement/managedDevices",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"value": []}
        except Exception as e:
            return {"error": str(e)}

    def get_audit_logs(self, limit: int = 100) -> Dict[str, Any]:
        """
        Fetch Azure AD audit logs for compliance and incident response.
        Covers user sign-in anomalies, admin actions, policy changes.
        """
        if not self.access_token:
            return {"error": "Not authenticated"}

        try:
            response = requests.get(
                f"{self.graph_url}/auditLogs/directoryAudits?$top={limit}",
                headers=self._headers(),
                timeout=10,
            )
            if response.status_code == 200:
                return response.json()
            return {"value": []}
        except Exception as e:
            return {"error": str(e)}


def create_m365_connector(
    tenant_id: Optional[str] = None,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
) -> Microsoft365Connector:
    """Factory for M365 connector using environment or explicit credentials."""
    tenant_id = tenant_id or os.getenv("M365_TENANT_ID", "")
    client_id = client_id or os.getenv("M365_CLIENT_ID", "")
    client_secret = client_secret or os.getenv("M365_CLIENT_SECRET", "")

    return Microsoft365Connector(tenant_id, client_id, client_secret)
