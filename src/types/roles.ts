export type UserRole = 'admin' | 'practitioner' | 'member'

export interface RolePermissions {
  canAccessChat: boolean
  canAccessLabs: boolean
  canAccessDiagnostics: boolean
  canAccessPatients: boolean
  canAccessAdmin: boolean
  canAccessDashboard: boolean
  canAccessMyHealth: boolean
  canAccessSuggestions: boolean // Members only - softer language for non-clinical users
  canAccessProtocols: boolean // Practitioners/Admins only - clinical terminology
  canAccessSettings: boolean
  canManageMultiplePatients: boolean
  canCreateUsers: boolean
  canViewAnalytics: boolean
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canAccessChat: true,
    canAccessLabs: true,
    canAccessDiagnostics: true,
    canAccessPatients: true,
    canAccessAdmin: true,
    canAccessDashboard: true,
    canAccessMyHealth: false,
    canAccessSuggestions: false, // Admins use protocols, not suggestions
    canAccessProtocols: true,
    canAccessSettings: true,
    canManageMultiplePatients: true,
    canCreateUsers: true,
    canViewAnalytics: true,
  },
  practitioner: {
    canAccessChat: true,
    canAccessLabs: true,
    canAccessDiagnostics: true,
    canAccessPatients: true,
    canAccessAdmin: false,
    canAccessDashboard: true,
    canAccessMyHealth: false,
    canAccessSuggestions: false, // Practitioners use protocols, not suggestions
    canAccessProtocols: true,
    canAccessSettings: true,
    canManageMultiplePatients: true,
    canCreateUsers: false,
    canViewAnalytics: false,
  },
  member: {
    canAccessChat: true,
    canAccessLabs: true,
    canAccessDiagnostics: false,
    canAccessPatients: false,
    canAccessAdmin: false,
    canAccessDashboard: false,
    canAccessMyHealth: false,
    canAccessSuggestions: true, // Members see "suggestions" - softer, non-clinical language
    canAccessProtocols: false, // Members don't have clinical protocol access
    canAccessSettings: true,
    canManageMultiplePatients: false,
    canCreateUsers: false,
    canViewAnalytics: false,
  },
}

// Route access rules - which roles can access which routes
export const ROUTE_RULES: Record<string, UserRole[]> = {
  '/admin': ['admin'],
  '/admin/users': ['admin'],
  '/admin/analytics': ['admin'],
  '/admin/documents': ['admin'],
  '/admin/rag': ['admin'],
  '/admin/rag/logs': ['admin'],
  '/admin/rag/telemetry': ['admin'],
  '/chats': ['admin', 'practitioner', 'member'],
  '/patients': ['admin', 'practitioner'],
  '/diagnostics': ['admin', 'practitioner'],
  '/dashboard': ['admin', 'practitioner'],
  '/protocols': ['admin', 'practitioner'], // Clinical protocols for practitioners
  '/my-labs': ['admin', 'member'],
  '/suggestions': ['admin', 'member'], // Softer language for member wellness suggestions
  '/': ['admin', 'practitioner', 'member'],
  '/labs': ['admin', 'practitioner', 'member'],
}

export function canAccessRouteForRole(pathname: string, role: UserRole): boolean {
  for (const [route, allowedRoles] of Object.entries(ROUTE_RULES)) {
    if (pathname === route || pathname.startsWith(`${route}/`)) {
      return allowedRoles.includes(role)
    }
  }
  return true
}

export function canAccess(role: UserRole, feature: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][feature]
}

export function getHomeRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'practitioner':
      return '/'
    case 'member':
      return '/'
    default:
      return '/'
  }
}

export function getTerminology(role: UserRole) {
  if (role === 'member') {
    return {
      // Members see softer, non-clinical language to avoid litigious situations
      protocol: 'suggestion',
      protocols: 'suggestions',
      treatment: 'wellness guidance',
      patient: 'health profile',
      patientProfile: 'health profile',
      recommendation: 'suggestion',
      recommendations: 'suggestions',
    }
  }
  return {
    // Practitioners and admins use clinical terminology
    protocol: 'protocol',
    protocols: 'protocols',
    treatment: 'treatment',
    patient: 'patient',
    patientProfile: 'patient profile',
    recommendation: 'protocol',
    recommendations: 'protocols',
  }
}

// Analytics types for admin dashboard
export interface UserStatistics {
  user_id: string
  email: string
  full_name: string | null
  role: UserRole
  status: 'active' | 'inactive'
  labs_count: number
  protocols_count: number
  conversations_count: number
  feedback_count: number
  last_active: string | null
  user_created_at: string
}

export interface AnalyticsData {
  protocolAccuracy: number
  totalFeedback: number
  eventCounts: Record<string, number>
  topUsers: UserStatistics[]
  feedbackBreakdown: {
    positive: number
    negative: number
    neutral: number
  }
}
