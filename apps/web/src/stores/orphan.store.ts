import { makeAutoObservable, runInAction } from 'mobx';
import type { OrphanedDoc, OrphanDocType } from '../types/orphan';
import type { DocType } from '../types/reconciliation';
import { orphanService } from '../services/orphan.service';
import toast from 'react-hot-toast';
import i18n from '../i18n';

export class OrphanStore {
  docs: OrphanedDoc[] = [];
  loading = false;
  viewerFilePath: string | null = null;
  intakeDoc: OrphanedDoc | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async loadDocs() {
    this.loading = true;
    try {
      const docs = await orphanService.fetchOrphanedDocs();
      runInAction(() => { this.docs = docs; });
    } catch {
      toast.error(i18n.t('projects:orphanStore.loadError'));
    } finally {
      runInAction(() => { this.loading = false; });
    }
  }

  openDocument(filePath: string) {
    this.viewerFilePath = filePath;
  }

  closeDocument() {
    this.viewerFilePath = null;
  }

  private docTypeToUploadType(docType: OrphanDocType): DocType {
    const map: Record<OrphanDocType, DocType> = { deliveryNote: 'DC', purchaseOrder: 'PO', invoice: 'INVOICE' };
    return map[docType];
  }

  get intakeDocType(): DocType | null {
    return this.intakeDoc ? this.docTypeToUploadType(this.intakeDoc.docType) : null;
  }

  openIntakeModal(doc: OrphanedDoc) {
    this.intakeDoc = doc;
  }

  closeIntakeModal() {
    this.intakeDoc = null;
  }

  async deleteDoc(doc: OrphanedDoc) {
    try {
      await orphanService.deleteDoc(doc);
      runInAction(() => {
        this.docs = this.docs.filter((d) => d.id !== doc.id);
      });
      toast.success(i18n.t('projects:orphanStore.deleteSuccess'));
    } catch {
      toast.error(i18n.t('projects:orphanStore.deleteError'));
    }
  }

  removeDocFromList(docId: string) {
    this.docs = this.docs.filter((d) => d.id !== docId);
  }
}
