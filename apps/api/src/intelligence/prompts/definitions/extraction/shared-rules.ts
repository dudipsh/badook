// Shared extraction rules are now loaded from templates/extraction/shared-rules.md
import { loadTemplate } from '../../loader';

export const SHARED_EXTRACTION_RULES = loadTemplate('extraction/shared-rules.md');
