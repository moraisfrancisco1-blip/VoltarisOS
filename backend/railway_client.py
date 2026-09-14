"""
railway_client.py — thin client for Railway's public GraphQL API, used to
provision White-label custom domains for real (backend/routers/white_label.py).

Requires RAILWAY_API_TOKEN + RAILWAY_PROJECT_ID + RAILWAY_SERVICE_ID +
RAILWAY_ENVIRONMENT_ID (backend/config.py). Every caller must catch
RailwayNotConfigured and treat it as "store the request, don't provision
yet" -- never as a hard failure that breaks the tenant's request.

Reference: https://docs.railway.com/integrations/api/manage-domains
"""
import httpx

from backend.config import settings

GRAPHQL_URL = "https://backboard.railway.com/graphql/v2"


class RailwayNotConfigured(Exception):
    """RAILWAY_API_TOKEN (or project/service/environment ID) is not set on
    this instance. Not an error -- callers should degrade to a manual/pending
    status rather than raise this up as a request failure."""


class RailwayApiError(Exception):
    """Railway's GraphQL API returned an `errors` array for a well-formed
    request (auth denial, invalid domain, etc.)."""


def is_configured() -> bool:
    return bool(
        settings.RAILWAY_API_TOKEN
        and settings.RAILWAY_PROJECT_ID
        and settings.RAILWAY_SERVICE_ID
        and settings.RAILWAY_ENVIRONMENT_ID
    )


def _gql(query: str, variables: dict) -> dict:
    if not is_configured():
        raise RailwayNotConfigured()
    resp = httpx.post(
        GRAPHQL_URL,
        json={"query": query, "variables": variables},
        headers={
            "Authorization": f"Bearer {settings.RAILWAY_API_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=15.0,
    )
    resp.raise_for_status()
    body = resp.json()
    if body.get("errors"):
        raise RailwayApiError(body["errors"][0].get("message", "Railway API error"))
    return body["data"]


_CREATE_QUERY = """
mutation customDomainCreate($input: CustomDomainCreateInput!) {
  customDomainCreate(input: $input) {
    id
    domain
    status {
      verificationToken
      dnsRecords { hostlabel requiredValue status }
    }
  }
}
"""

_STATUS_QUERY = """
query customDomain($id: String!, $projectId: String!) {
  customDomain(id: $id, projectId: $projectId) {
    id
    domain
    status {
      verificationToken
      dnsRecords { hostlabel requiredValue currentValue status }
      certificateStatus
    }
  }
}
"""

_DELETE_QUERY = """
mutation customDomainDelete($id: String!) {
  customDomainDelete(id: $id)
}
"""


def create_custom_domain(domain: str) -> dict:
    """Add `domain` to the configured Railway service. Returns Railway's
    customDomainCreate payload: {id, domain, status: {verificationToken,
    dnsRecords: [{hostlabel, requiredValue, status}]}}. Raises
    RailwayNotConfigured or RailwayApiError -- never silently no-ops."""
    variables = {"input": {
        "projectId": settings.RAILWAY_PROJECT_ID,
        "environmentId": settings.RAILWAY_ENVIRONMENT_ID,
        "serviceId": settings.RAILWAY_SERVICE_ID,
        "domain": domain,
    }}
    return _gql(_CREATE_QUERY, variables)["customDomainCreate"]


def get_custom_domain_status(railway_domain_id: str) -> dict:
    """Current DNS/certificate status for a previously created domain."""
    variables = {"id": railway_domain_id, "projectId": settings.RAILWAY_PROJECT_ID}
    return _gql(_STATUS_QUERY, variables)["customDomain"]


def delete_custom_domain(railway_domain_id: str) -> None:
    _gql(_DELETE_QUERY, {"id": railway_domain_id})
