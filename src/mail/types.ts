export type MailAccount = {
  id: string;
  displayName: string;
  email: string;
  enabled?: boolean;
  lastOkAt?: string | null;
  lastError?: string;
  permissions?: { read: boolean; send: boolean; manage: boolean };
};

export type MailSignature = { new: string; reply: string };
export type MailTemplate = { id: string; title: string; body: string };
export type MailLabel = { id: string; name: string; color: string };
export type MailRule = {
  id: string;
  name: string;
  field: 'from' | 'to' | 'subject';
  condition: 'contains' | 'equals' | 'starts';
  value: string;
  action: 'label' | 'star' | 'read' | 'move';
  target?: string;
  enabled?: boolean;
};
export type MailTrackingInfo = {
  trackingId: string;
  subject: string;
  recipients: string[];
  openCount: number;
  sentAt: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
};
export type AdminOverview = {
  users: { uid: string; email: string; displayName: string }[];
  accounts: { id: string; email: string; displayName: string; enabled: boolean }[];
  grants: { uid: string; accountId: string; permissions: { read: boolean; send: boolean; manage: boolean } }[];
  invitations: { id: string; email: string; accountIds: string[]; permissions: { read: boolean; send: boolean; manage: boolean }; status: string }[];
  audit: { id: string; actor: string; action: string; target: string; createdAt: string | null }[];
};
export type ContactItem = {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  group?: string;
  notes?: string;
  sentCount?: number;
  receivedCount?: number;
  lastAt?: number;
};

export type UserSettings = {
  theme: 'light' | 'dark';
  defaultAccountId: string;
  accountOrder: string[];
  signatures: Record<string, MailSignature>;
  templates: MailTemplate[];
  labels?: MailLabel[];
  rules?: MailRule[];
  recent: ContactItem[];
  replaceRecent?: boolean;
  deletedEmails?: string[];
  undoSendSeconds?: number;
  sound?: 'on' | 'off';
  pinned?: Record<string, number[]>;
  snoozed?: Record<string, Record<string, number>>;
  customLabels?: Record<string, string[]>;
  scheduledEmails?: ScheduledEmail[];
};

export type TelegramSubscription = {
  accountId: string;
  enabled: boolean;
  linked: boolean;
  username?: string | null;
  lastCheckedAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string;
  needsCheck?: boolean;
};

export type TelegramLink = { accountId: string; url: string; expiresAt: string };

export type FolderRole = 'inbox' | 'sent' | 'archive' | 'trash' | 'spam' | (string & {});
export type MailFolder = { id: string; name: string; role?: FolderRole | 'drafts' | 'custom'; unseen?: number };
export type MessageFilters = { to?: string; after?: string; before?: string; hasAttachments?: boolean; starred?: boolean };
export type ComposeAttachment = {
  id?: string; filename: string; contentType: string; size: number;
  source?: { folder: string; uid: number; index: number; accountId?: string };
};
export type SendState = 'sending' | 'sent' | 'partial' | 'uncertain' | 'failed';
export type SendStatus = { state: SendState; result?: SendResult };
export type BulkAction = 'seen' | 'unseen' | 'star' | 'unstar' | 'delete' | 'move' | 'empty';
export type BulkRequest = { folder: FolderRole; uids: number[]; action: BulkAction; destination?: FolderRole };
export type BulkResult = { ok: boolean; count?: number; permanent?: boolean; truncated?: boolean };
export type ConnectionTest = { ok: boolean; imap: { ok: boolean; error?: string }; smtp: { ok: boolean; error?: string } };

export type MailboxQuota = {
  usageBytes: number;
  limitBytes: number;
  percent: number;
  status: string;
  supported?: boolean;
  messageCount?: number;
};

export type ArchiveRunOptions = {
  role?: FolderRole;
  uids?: number[];
  olderThanDays?: number;
  minSizeBytes?: number;
  limit?: number;
};

export type ArchiveRunResult = {
  archivedCount: number;
  freedBytes: number;
  archived: { archiveId: string; uid: number; subject: string; size: number }[];
  errors: { uid: number; error: string }[];
  targetCount: number;
};

export type AuthCheckStatus =
  | 'pass'
  | 'bestguesspass'
  | 'fail'
  | 'softfail'
  | 'neutral'
  | 'none'
  | 'temperror'
  | 'permerror'
  | 'policy'
  | 'present'
  | 'missing';

export type MailAuthResults = {
  spfPass: boolean;
  dkimPass: boolean;
  dmarcPass: boolean;
  trusted: boolean;
  spf?: AuthCheckStatus;
  dmarc?: AuthCheckStatus;
  dkim?: AuthCheckStatus;
};

export type MailListItem = {
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  to?: string;
  toEmail?: string;
  toEmails?: string[];
  ccEmails?: string[];
  date: string;
  seen: boolean;
  flagged: boolean;
  hasAttachments?: boolean;
  authResults?: MailAuthResults | null;
  labels?: string[];
  trackingId?: string;
  pinned?: boolean;
  snoozedUntil?: number | null;
  accountId?: string;
  accountEmail?: string;
  accountDisplayName?: string;
  folder?: FolderRole;
};

export type AttachmentInfo = {
  index: number;
  filename: string;
  contentType: string;
  size: number;
};

export type MailMessage = MailListItem & {
  to: string;
  cc: string;
  toEmails: string[];
  ccEmails: string[];
  bcc?: string;
  bccEmails?: string[];
  html: string;
  messageId: string;
  attachments: AttachmentInfo[];
  unsubscribe?: { url?: string | null; mailto?: string | null; raw: string } | null;
  authResults?: MailAuthResults | null;
  calendarEvent?: {
    summary: string;
    description?: string;
    location?: string;
    organizer?: string;
    dtstart?: string;
    dtend?: string;
    rawIcs?: string;
  } | null;
};

export type ScheduledEmail = {
  id: string;
  accountId: string;
  payload: SendPayload;
  scheduledAt: number;
  createdAt: number;
  targetEmail: string;
  subject: string;
  status?: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  lastError?: string | null;
};

export type ListResult = {
  messages: MailListItem[];
  nextCursor: number | null;
  unseen: number | null;
  folderUnseen?: number | null;
  inboxUnseen?: number | null;
  total: number;
};

export type InboxPreview = {
  unseen: number | null;
  total: number;
  lastUid: number;
  messages: MailListItem[];
};

export type Draft = {
  id: string;
  accountId: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  mode?: 'new' | 'reply' | 'forward';
  htmlBody?: string;
  attachments?: ComposeAttachment[];
  sendId?: string;
  sendState?: SendState;
  replyUid: number | null;
  replyFolder?: FolderRole | null;
  updatedAt?: string | null;
};

export type SendResult = {
  ok: boolean;
  stored: boolean;
  accepted: string[];
  rejected: string[];
  trackingId?: string;
};

export type SendPayload = {
  mode: 'new' | 'reply' | 'forward';
  sendId?: string;
  folder: FolderRole;
  uid?: number;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: ComposeAttachment[];
  track?: boolean;
  keepAttachments?: boolean;
  attachmentAccountId?: string;
};

export type CorporateProfile = {
  id: string;
  name: string;
  sector?: string;
  focus: string;
  emailHints?: string[];
  keywords?: string[];
  signature: string;
  rules: string | string[];
  approvedCatalog?: string | string[];
  boundAccountIds?: string[];
};

export type AnalyzedAttachmentInfo = {
  index: number;
  filename: string;
  contentType: string;
  size: number;
  kind: string;
  parsed: boolean;
  excerpt?: string;
  warning?: string;
};

export type GrokRequirements = {
  product: string | null;
  quantity: number | string | null;
  unit: string | null;
  incoterm: string | null;
  currency?: string | null;
  destination: string | null;
  packaging: string | null;
  paymentTerms: string | null;
  deliveryDate?: string | null;
  serviceType?: string | null;
};

export type GrokEmailAnalysis = {
  analysisId: string;
  accountId: string;
  folder: string;
  uid?: number;
  messageUid?: number;
  messageId?: string;
  organizationId: string;
  organizationName: string;
  organizationFocus: string;
  category:
    | 'quotation_request'
    | 'order'
    | 'technical_support'
    | 'info_request'
    | 'complaint'
    | 'payment_finance'
    | 'contract_fleet'
    | 'suspicious_risk'
    | 'suspicious_spam'
    | 'general'
    | 'general_inquiry';
  categoryLabel: string;
  language: string;
  languageLabel: string;
  priority: 'high' | 'medium' | 'low';
  priorityLabel: string;
  customerStatus: 'Yeni müşteri' | 'Mevcut müşteri';
  requiresPriceInfo: boolean;
  summary: string;
  requirements: GrokRequirements;
  missingInformation: string[];
  riskFlags: string[];
  analyzedAttachments?: AnalyzedAttachmentInfo[];
  replyDrafts: {
    professional: string;
    friendly: string;
    short: string;
    detailed: string;
  };
  drafts?: {
    professional: string;
    friendly: string;
    short: string;
    detailed: string;
  };
  suggestedSubject: string;
  replySubject?: string;
  followUpRequired?: boolean;
  status: 'analyzed' | 'draft' | 'reviewed' | 'approved' | 'sent' | 'rejected';
  model: string;
  aiWarning?: string;
  endpointUsed?: string;
  priorConversationCount?: number;
  cached?: boolean;
  analyzedAt?: string;
};

export type GlobalSearchResult = {
  messages: MailListItem[];
  total: number;
  scannedAccounts: number;
  matchedAccounts: number;
  failedAccounts: number;
};

export type UnansweredQuoteItem = {
  accountId: string;
  accountEmail: string;
  accountDisplayName: string;
  uid: number;
  subject: string;
  recipient: string;
  recipientEmail: string;
  sentAt: string;
  daysWaiting: number;
  isQuote: boolean;
  hasAttachments: boolean;
};

export type QuoteFollowUpDraft = {
  subject: string;
  body: string;
  htmlBody: string;
  recipientEmail: string;
  organizationId: string;
  organizationName: string;
  daysWaiting: number;
  model: string;
  aiPowered: boolean;
};

export type ComposeAssistInput = {
  accountId?: string;
  text: string;
  instruction?: string;
  mode?: 'expand' | 'translate' | 'polish' | 'shorten';
  targetLanguage?: string;
  tone?: string;
  subject?: string;
  recipient?: string;
  organizationId?: string;
};

export type ComposeAssistResult = {
  subject: string;
  body: string;
  htmlBody: string;
  language: string;
  mode: string;
  organizationId: string;
  organizationName: string;
  model: string;
  aiPowered: boolean;
  warning?: string;
};

export type FollowUpItem = {
  analysisId: string;
  organizationId: string;
  organizationName: string;
  accountId: string;
  folder: string;
  uid: number;
  subject: string;
  sender: string;
  senderEmail: string;
  category: string;
  categoryLabel: string;
  priority: 'high' | 'medium' | 'low';
  priorityLabel: string;
  summary: string;
  status: string;
  analyzedAt: string;
};

export type AiProviderInfo = {
  id: string;
  name: string;
  description: string;
  hasKey: boolean;
  defaultModel: string;
  models: string[];
};

export type AiSystemStatus = {
  configured: boolean;
  provider?: string;
  activeProvider?: string;
  configuredProviders?: string[];
  availableProviders?: AiProviderInfo[];
  allowedModels?: string[];
  source?: string;
  maskedKey?: string | null;
  model: string;
  availableModels: string[];
  profiles: CorporateProfile[];
};
