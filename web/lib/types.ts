export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type DatasetStatus = "Protected" | "Analyzed" | "Pending";

export type RedactionAction =
  | "KEEP"
  | "FULL_MASK"
  | "PARTIAL_MASK"
  | "HASH"
  | "ANONYMIZE"
  | "GENERALIZE"
  | "SUPPRESS";

export type PIIFinding = {
  column: string;
  piiType: string;
  confidence: string;
  risk: RiskLevel;
  example?: string;
  recommendedAction: RedactionAction;
};

export type ProtectionResult = {
  recordsProcessed: number;
  piiFieldsDetected: number;
  valuesProtected: number;
  verification: "PASSED" | "FAILED";
  completedAt: string;
};

export type DatasetItem = {
  id: string;
  filename: string;
  records: number;
  columns: string[];
  colCount: number;
  createdAt: string;
  status: DatasetStatus;
  risk: RiskLevel;
  piiCount: number;
  piiFindings: PIIFinding[];
  policy: Record<string, RedactionAction>;
  result?: ProtectionResult;
  rawRows: Record<string, string>[];
  protectedRows?: Record<string, string>[];
};

export type AuditReportItem = {
  id: string;
  datasetId: string;
  dataset: string;
  piiFound: number;
  protected: number;
  verification: "PASSED" | "FAILED";
  date: string;
  summary: string;
  details?: string[];
};

export type AppSettings = {
  aiProvider: string;
  model: string;
  apiStatus: string;
  fileSizeLimit: string;
  defaultPolicy: RedactionAction;
};

export type AgentTraceEvent = {
  step: string;
  status: "success" | "warning" | "pending" | string;
  detail?: string;
  args?: Record<string, unknown>;
  result?: unknown;
};

export type PreviewData = {
  format?: string;
  columns: string[];
  rows: Record<string, string>[];
  masked_columns?: string[];
  column_types?: Record<string, string>;
  confirmation_token?: string | null;
  original_rows?: Record<string, string>[];
  warning?: string;
};

export type DatasetInfo = {
  dataset_id: string;
  filename: string;
  row_count: number;
  col_count: number;
  columns: string[];
  preview: Record<string, string>[];
  masked?: boolean;
};

export type ChatResponse = {
  response_text: string;
  agent_trace: AgentTraceEvent[];
  preview_data: PreviewData | null;
  confirmation_token: string | null;
  artifact_version?: string;
  version?: string;
  session_id?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};
