export const DELIVERY_NOTE_STATUSES = {
  PENDING: 'PENDING',
  PARSED: 'PARSED',
  PARSE_FAILED: 'PARSE_FAILED',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const DELIVERY_NOTE_SOURCES = {
  EMAIL: 'EMAIL',
  MOBILE: 'MOBILE',
  MANUAL: 'MANUAL',
} as const;

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  FIELD_WORKER: 'FIELD_WORKER',
} as const;

export const USER_ROLE_OPTIONS = [
  { value: 'ADMIN' as const, label: 'מנהל' },
  { value: 'ACCOUNTANT' as const, label: 'רואה חשבון' },
  { value: 'FIELD_WORKER' as const, label: 'עובד שטח' },
];
