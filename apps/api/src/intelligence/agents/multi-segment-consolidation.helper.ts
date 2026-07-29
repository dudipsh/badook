import { Logger } from '@nestjs/common';
import { ProjectsService } from '../../domain/projects/projects.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AgentContext, FileProcessingResult } from './agent.types';

/**
 * Helper class for consolidating orphaned documents from multi-page PDF segments
 * into a single project.
 *
 * Strategy:
 * 1. If some segments got projects, assign orphans to the most common project
 * 2. If ALL segments are orphaned, create a project from the first valid address or supplier name
 *
 * Extracted from AgentOrchestratorService to reduce its size.
 */
export class MultiSegmentConsolidationHelper {
  private readonly logger = new Logger(MultiSegmentConsolidationHelper.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly prisma: PrismaService,
  ) {}

  async consolidateOrphans(context: AgentContext, results: FileProcessingResult) {
    const orphanedDNs = results.documents.filter(
      (d) => d.status === 'ORPHANED' && d.documentId && d.documentType === 'delivery_note' && !d.projectId,
    );
    if (orphanedDNs.length === 0) return;

    const completedWithProject = results.documents.filter(
      (d) => d.status === 'COMPLETED' && d.projectId,
    );

    let targetProjectId: string | null = null;

    if (completedWithProject.length > 0) {
      // Case 1: Some segments have projects — use the most common one
      const projectCounts = new Map<string, number>();
      for (const d of completedWithProject) {
        projectCounts.set(d.projectId!, (projectCounts.get(d.projectId!) || 0) + 1);
      }
      targetProjectId = [...projectCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      this.logger.log(`Multi-segment consolidation: ${orphanedDNs.length} orphans → existing project ${targetProjectId}`);
    } else {
      // Case 2: ALL segments are orphaned — create a project
      // Try to get supplier name from any document for context
      const anyDoc = results.documents.find((d) => d.documentId);
      if (!anyDoc?.documentId) return;

      const dn = await this.prisma.deliveryNote.findUnique({
        where: { id: anyDoc.documentId },
        select: { supplierName: true },
      });
      if (!dn) return;

      const supplierName = dn.supplierName || 'Unknown';
      // Create project with supplier name as a fallback identifier
      const project = await this.projectsService.findOrCreate(supplierName, context.companyId);
      if (!project) return;

      targetProjectId = project.id;
      this.logger.log(`Multi-segment consolidation: created project "${project.name}" for ${orphanedDNs.length + 1} orphaned documents from supplier "${supplierName}"`);
    }

    if (!targetProjectId) return;

    // Re-assign orphaned DNs to the target project
    const orphanIds = orphanedDNs.map((d) => d.documentId).filter(Boolean) as string[];
    if (orphanIds.length > 0) {
      await this.prisma.deliveryNote.updateMany({
        where: { id: { in: orphanIds } },
        data: { projectId: targetProjectId },
      });
      for (const orphan of orphanedDNs) {
        orphan.projectId = targetProjectId;
        orphan.status = 'COMPLETED';
      }
      this.logger.log(`Multi-segment consolidation: assigned ${orphanIds.length} orphan DNs → project ${targetProjectId.slice(0, 8)}`);
    }

    // Also reassign any completed docs without a project (shouldn't happen, but just in case)
    const unprojectDocs = results.documents
      .filter((d) => d.documentId && d.status === 'COMPLETED' && !d.projectId && d.documentType === 'delivery_note')
      .map((d) => d.documentId!)
      .filter(Boolean);
    if (unprojectDocs.length > 0) {
      await this.prisma.deliveryNote.updateMany({
        where: { id: { in: unprojectDocs } },
        data: { projectId: targetProjectId },
      });
      for (const doc of results.documents) {
        if (doc.documentId && unprojectDocs.includes(doc.documentId)) {
          doc.projectId = targetProjectId;
        }
      }
    }
  }
}
