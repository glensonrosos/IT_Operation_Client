export function can(user, permission) {
  const permissions = user?.role?.permissionKeys ?? [];
  const roleDefaults = user?.role?.key === 'IT_STAFF' && ['spareParts.view', 'tickets.view', 'tickets.close', 'tickets.assign'].includes(permission);
  return permissions.includes('*') || permissions.includes(permission) || roleDefaults;
}
