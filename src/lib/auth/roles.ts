// src/lib/auth/roles.ts
// Role utilities for multi-role architecture (WS-5)

import { UserRole, RolePermissions, ROLE_PERMISSIONS } from '@/types/roles';

/**
 * Check if a role has access to a specific feature/permission
 */
export function canAccess(role: UserRole, feature: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][feature];
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  // Check exact match first
  const routeRules: Record<string, UserRole[]> = {
    '/admin': ['admin'],
    '/admin/users': ['admin'],
    '/admin/analytics': ['admin'],
    '/patients': ['admin', 'practitioner'],
    '/diagnostics': ['admin', 'practitioner'],
    '/dashboard': ['admin', 'practitioner'],
    '/my-health': ['member'],
    '/': ['admin', 'practitioner', 'member'],
    '/labs': ['admin', 'practitioner', 'member'],
  };

  // Check if pathname starts with any restricted route
  for (const [route, allowedRoles] of Object.entries(routeRules)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return allowedRoles.includes(role);
    }
  }

  // Default: allow access
  return true;
}

/**
 * Get the home route for a given role
 * Used for post-login redirects
 */
export function getHomeRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'practitioner':
      return '/';
    case 'member':
      return '/my-health';
    default:
      return '/';
  }
}

/**
 * Get role-specific terminology
 * Members see different language than practitioners
 */
export function getTerminology(role: UserRole) {
  if (role === 'member') {
    return {
      protocol: 'care recommendation',
      protocols: 'care recommendations',
      Protocol: 'Care Recommendation',
      Protocols: 'Care Recommendations',
      treatment: 'wellness guidance',
      Treatment: 'Wellness Guidance',
      patient: 'health profile',
      Patient: 'Health Profile',
      patients: 'health profiles',
      Patients: 'Health Profiles',
      practitioner: 'wellness advisor',
      Practitioner: 'Wellness Advisor',
    };
  }

  return {
    protocol: 'protocol',
    protocols: 'protocols',
    Protocol: 'Protocol',
    Protocols: 'Protocols',
    treatment: 'treatment',
    Treatment: 'Treatment',
    patient: 'patient',
    Patient: 'Patient',
    patients: 'patients',
    Patients: 'Patients',
    practitioner: 'practitioner',
    Practitioner: 'Practitioner',
  };
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Administrator';
    case 'practitioner':
      return 'Practitioner';
    case 'member':
      return 'At-Home Program Member';
    default:
      return role;
  }
}

/**
 * Check if a role is an elevated role (admin or practitioner)
 */
export function isElevatedRole(role: UserRole): boolean {
  return role === 'admin' || role === 'practitioner';
}

/**
 * Check if a role can manage other users
 */
export function canManageUsers(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Get navigation items based on role
 */
export interface NavItem {
  label: string;
  href: string;
  permission?: keyof RolePermissions;
  roleOnly?: UserRole[];
}

export function getNavigationItems(role: UserRole): NavItem[] {
  const allItems: NavItem[] = [
    { label: 'Chat', href: '/' },
    { label: 'Lab Calculator', href: '/labs' },
    { label: 'Dashboard', href: '/dashboard', permission: 'canAccessDashboard' },
    { label: 'Patients', href: '/patients', permission: 'canAccessPatients' },
    { label: 'Diagnostics', href: '/diagnostics', permission: 'canAccessDiagnostics' },
    { label: 'My Health', href: '/my-health', roleOnly: ['member'] },
    { label: 'Admin', href: '/admin', permission: 'canAccessAdmin' },
  ];

  return allItems.filter((item) => {
    if (item.roleOnly) {
      return item.roleOnly.includes(role);
    }
    if (item.permission) {
      return canAccess(role, item.permission);
    }
    return true;
  });
}
