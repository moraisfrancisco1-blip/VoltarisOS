// The backend's only real roles are SUPER_ADMIN / TENANT_ADMIN / TENANT_MEMBER
// (backend/security.py CANONICAL_ROLES) — legacy names like "operator"/"viewer"
// are normalized server-side into TENANT_MEMBER. Map to that reality here.
export function isAdminRole(role) {
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN"
}

export function displayRole(role) {
  if (role === "SUPER_ADMIN") return "super admin"
  if (role === "TENANT_ADMIN") return "admin"
  return "member"
}
