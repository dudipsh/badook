export function getStatusStyle(status: string): string {
  switch (status) {
    case 'APPROVED':
    case 'MATCHED':
      return 'bg-success/10 text-success';
    case 'PENDING':
    case 'PARSED':
      return 'bg-warning/10 text-warning';
    case 'REJECTED':
    case 'PARSE_FAILED':
      return 'bg-error/10 text-error';
    case 'QUOTE':
      return 'bg-warning/10 text-warning';
    default:
      return 'bg-base-200 text-base-content/60';
  }
}
