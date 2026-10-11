// Match the internal-comment RLS permission, not a client-supplied role label.
export function internalRecipients(ids, memberships, roles) {
  const allowedRoles = new Set(roles.filter(role => {
    const p = role.permissions;
    return p && (Array.isArray(p) ? p.includes('*') || p.includes('ticket:update:all')
      : Object.hasOwn(p, '*') || Object.hasOwn(p, 'ticket:update:all'));
  }).map(role => role.id));
  const allowedUsers = new Set(memberships.filter(row => allowedRoles.has(row.role_id)).map(row => row.user_id));
  return ids.filter(id => allowedUsers.has(id));
}
