import { makeAutoObservable, runInAction } from 'mobx';
import { format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import {
  ChatAttachment,
  ChatConversation,
  ChatMessage,
  ChatScope,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  streamMessage,
  uploadAttachment,
} from '../services/chat.service';
import { ChatDocType } from '../services/documents.service';

export type ChatScopePeriod = 'all' | 'thisMonth' | 'last3Months' | 'thisYear';

export interface ViewingDocument {
  type: ChatDocType;
  id: string;
  projectId?: string | null;
  projectName?: string | null;
  highlightItem?: string | null;
}

export class ChatStore {
  isOpen = false;
  viewingDocument: ViewingDocument | null = null;
  conversations: ChatConversation[] = [];
  activeConversationId: string | null = null;
  messages: ChatMessage[] = [];
  input = '';
  isTyping = false;
  isLoadingConversations = false;
  isLoadingMessages = false;
  pendingAttachments: ChatAttachment[] = [];
  uploadingAttachment = false;
  scopeProjectId: string | null = null;
  scopeSupplierId: string | null = null;
  scopePeriod: ChatScopePeriod = 'all';
  private abortController: AbortController | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  open() {
    this.isOpen = true;
    if (!this.conversations.length) {
      void this.loadConversations();
    }
  }

  close() {
    this.isOpen = false;
    this.viewingDocument = null;
  }

  openDocument(doc: ViewingDocument) {
    this.viewingDocument = doc;
  }

  closeDocument() {
    this.viewingDocument = null;
  }

  setInput(value: string) {
    this.input = value;
  }

  setScopeProject(id: string | null) {
    this.scopeProjectId = id;
  }

  setScopeSupplier(id: string | null) {
    this.scopeSupplierId = id;
  }

  setScopePeriod(period: ChatScopePeriod) {
    this.scopePeriod = period;
  }

  clearScope() {
    this.scopeProjectId = null;
    this.scopeSupplierId = null;
    this.scopePeriod = 'all';
  }

  get hasScope(): boolean {
    return !!(this.scopeProjectId || this.scopeSupplierId || this.scopePeriod !== 'all');
  }

  private buildScope(): ChatScope | undefined {
    if (!this.hasScope) return undefined;
    const now = new Date();
    const dateFrom =
      this.scopePeriod === 'thisMonth'
        ? format(startOfMonth(now), 'yyyy-MM-dd')
        : this.scopePeriod === 'last3Months'
          ? format(subMonths(now, 3), 'yyyy-MM-dd')
          : this.scopePeriod === 'thisYear'
            ? format(startOfYear(now), 'yyyy-MM-dd')
            : undefined;
    return {
      ...(this.scopeProjectId ? { projectId: this.scopeProjectId } : {}),
      ...(this.scopeSupplierId ? { supplierId: this.scopeSupplierId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
    };
  }

  async loadConversations() {
    this.isLoadingConversations = true;
    try {
      const list = await listConversations();
      runInAction(() => {
        this.conversations = list;
      });
    } finally {
      runInAction(() => {
        this.isLoadingConversations = false;
      });
    }
  }

  resetToWelcome() {
    this.activeConversationId = null;
    this.messages = [];
    this.input = '';
    this.pendingAttachments = [];
  }

  async selectConversation(id: string) {
    if (this.activeConversationId === id) return;
    this.activeConversationId = id;
    this.messages = [];
    this.pendingAttachments = [];
    this.isLoadingMessages = true;
    try {
      const msgs = await listMessages(id);
      runInAction(() => {
        if (this.activeConversationId === id) {
          this.messages = msgs;
        }
      });
    } finally {
      runInAction(() => {
        this.isLoadingMessages = false;
      });
    }
  }

  async deleteConversation(id: string) {
    await deleteConversation(id);
    runInAction(() => {
      this.conversations = this.conversations.filter((c) => c.id !== id);
      if (this.activeConversationId === id) {
        this.resetToWelcome();
      }
    });
  }

  async addAttachment(file: File) {
    this.uploadingAttachment = true;
    try {
      const att = await uploadAttachment(file);
      runInAction(() => {
        this.pendingAttachments = [...this.pendingAttachments, att];
      });
    } finally {
      runInAction(() => {
        this.uploadingAttachment = false;
      });
    }
  }

  removeAttachment(id: string) {
    this.pendingAttachments = this.pendingAttachments.filter((a) => a.id !== id);
  }

  dismissCard(messageId: string, cardId: string) {
    const msg = this.messages.find((m) => m.id === messageId);
    if (msg?.cards) {
      msg.cards = msg.cards.filter((c) => c.id !== cardId);
    }
  }

  async sendMessage(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && this.pendingAttachments.length === 0) || this.isTyping) return;

    const attachmentIds = this.pendingAttachments.map((a) => a.id);
    const messageAttachments = this.pendingAttachments.slice();

    let conversationId = this.activeConversationId;
    if (!conversationId) {
      const conv = await createConversation();
      runInAction(() => {
        this.conversations = [conv, ...this.conversations];
        this.activeConversationId = conv.id;
      });
      conversationId = conv.id;
    }

    const tempUserId = `tmp-user-${Date.now()}`;
    const tempAssistantId = `tmp-asst-${Date.now()}`;
    const now = new Date().toISOString();

    runInAction(() => {
      this.messages = [
        ...this.messages,
        {
          id: tempUserId,
          role: 'USER',
          content: trimmed,
          createdAt: now,
          attachments: messageAttachments,
        },
        { id: tempAssistantId, role: 'ASSISTANT', content: '', createdAt: now },
      ];
      this.input = '';
      this.pendingAttachments = [];
      this.isTyping = true;
    });

    this.abortController = new AbortController();

    try {
      await streamMessage(
        conversationId,
        trimmed,
        attachmentIds,
        this.buildScope(),
        (event) => {
          runInAction(() => {
            if (event.type === 'chunk') {
              const last = this.messages[this.messages.length - 1];
              if (last && last.id === tempAssistantId) {
                last.content += event.content;
              }
            } else if (event.type === 'card') {
              const last = this.messages[this.messages.length - 1];
              if (last && last.id === tempAssistantId) {
                last.cards = [...(last.cards ?? []), event.card];
              }
            } else if (event.type === 'done') {
              const last = this.messages[this.messages.length - 1];
              if (last && last.id === tempAssistantId) {
                last.id = event.messageId;
              }
              if (event.title && conversationId) {
                const conv = this.conversations.find((c) => c.id === conversationId);
                if (conv) conv.title = event.title;
              }
            } else if (event.type === 'error') {
              const last = this.messages[this.messages.length - 1];
              if (last && last.id === tempAssistantId) {
                last.content = event.message;
              }
            }
          });
        },
        this.abortController.signal,
      );
    } catch {
      runInAction(() => {
        const last = this.messages[this.messages.length - 1];
        if (last && last.id === tempAssistantId && !last.content) {
          last.content = 'שגיאת רשת. נסה שוב.';
        }
      });
    } finally {
      runInAction(() => {
        this.isTyping = false;
        this.abortController = null;
      });
    }
  }
}
