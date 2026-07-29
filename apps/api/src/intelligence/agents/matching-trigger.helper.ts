import { Logger } from '@nestjs/common';
import { MatchingService } from '../../domain/matching/matching.service';
import { JobsGateway } from '../../infrastructure/jobs/jobs.gateway';

/**
 * Helper class for triggering auto-match operations after document processing.
 * Extracted from AgentOrchestratorService to reduce its size.
 */
export class MatchingTriggerHelper {
  private readonly logger = new Logger(MatchingTriggerHelper.name);

  constructor(
    private readonly matchingService: MatchingService,
    private readonly jobsGateway: JobsGateway,
  ) {}

  async triggerAutoMatch(companyId: string, projectId: string) {
    try {
      this.jobsGateway.emitMatchingStarted(companyId, projectId);
      const result = await this.matchingService.autoMatch(companyId, { projectId });
      this.logger.log(`Auto-match triggered for project ${projectId}: ${result.matchesCreated} matches`);
      this.jobsGateway.emitMatchingComplete(companyId, projectId, result.matchesCreated);
      this.jobsGateway.emitDataChanged(companyId, 'project', { id: projectId });
    } catch (err) {
      this.logger.warn(`Auto-match failed for project ${projectId}: ${err}`);
      this.jobsGateway.emitMatchingComplete(companyId, projectId, 0);
    }
  }

  /**
   * Company-wide auto-match for orphan documents.
   * Tries to link orphan POs/invoices with each other and with project-assigned docs.
   */
  async triggerOrphanAutoMatch(companyId: string, supplierId?: string) {
    try {
      this.jobsGateway.emitMatchingStarted(companyId);
      const result = await this.matchingService.autoMatch(companyId, supplierId ? { supplierId } : undefined);
      this.logger.log(`Orphan auto-match triggered for company ${companyId}: ${result.matchesCreated} matches`);
      this.jobsGateway.emitMatchingComplete(companyId, undefined, result.matchesCreated);
      this.jobsGateway.emitDataChanged(companyId, 'project');
    } catch (err) {
      this.logger.warn(`Orphan auto-match failed for company ${companyId}: ${err}`);
      this.jobsGateway.emitMatchingComplete(companyId);
    }
  }
}
