/**
 * StudyVault Data Models & API Type Definitions
 * Derived from backend OpenAPI specification (Source of Truth)
 */

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: {
      validation_errors?: Array<{ loc: string[]; msg: string; type: string }>;
      [key: string]: any;
    };
  };
}

export type ProcessingStatus = 'ready' | 'processing' | 'failed' | string;

export interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  linked: boolean;
  status: ProcessingStatus;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  chunk_count: number;
}

export interface UploadedDocSummary {
  document_id: string;
  filename: string;
  status: string;
  file_size: number;
  error_message: string | null;
}

export interface UploadResponse {
  message: string;
  documents: UploadedDocSummary[];
  uploaded_count: number;
  failed_count: number;
}

export interface DocumentChunk {
  chunk_id: string;
  page_number: number;
  snippet: string;
  created_at: string;
}

export interface DocumentContentResponse {
  document_id: string;
  filename: string;
  total_chunks: number;
  chunks: DocumentChunk[];
}

export interface DocumentPageResponse {
  document_id: string;
  filename: string;
  page_number: number;
  content: string;
  chunk_count: number;
}

export interface SourceChunkDetail {
  document_id: string;
  chunk_id: string;
  page_number: number;
  snippet: string;
  created_at: string;
}

export interface DocumentSource {
  document_id: string;
  filename: string;
  page_number: number;
  chunk_id: string;
  relevance_score: number;
  snippet: string;
}

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
}

export interface RetrievalSearchRequest {
  query: string;
  document_ids?: string[] | null;
  top_k?: number;
}

export interface RetrievalSearchResponse {
  query: string;
  results: DocumentSource[];
  total_found: number;
  active_documents_count: number;
}

export interface RetrievalStatsResponse {
  index_name: string;
  dimension: number;
  total_vector_count: number;
  namespaces?: Record<string, { vector_count: number }>;
  linked_documents_count: number;
  total_documents_count: number;
}

export type ChatMode = 'ask' | 'explain' | 'summarize' | 'compare' | 'evidence' | 'quiz';
export type SourceMode = 'documents_only' | 'web_only' | 'documents_and_web';
export type ExplanationStyle = 'normal' | 'simple' | 'step_by_step';

export interface ChatRequest {
  query: string;
  conversation_id?: string | null;
  mode?: ChatMode;
  document_ids?: string[] | null;
  source_mode?: SourceMode;
  explanation_style?: ExplanationStyle;
}

export interface ChatResponse {
  conversation_id: string;
  query: string;
  answer: string;
  mode: ChatMode | string;
  source_mode: SourceMode | string;
  is_grounded: boolean;
  document_sources: DocumentSource[];
  web_sources: WebSource[];
  structured_data: any | null;
  fallback_used: boolean;
}

export interface ChatStreamTokenPayload {
  type: 'token';
  text: string;
}

export interface ChatStreamDonePayload {
  type: 'done';
  conversation_id: string;
  is_grounded: boolean;
  document_sources: DocumentSource[];
  web_sources: WebSource[];
  fallback_used: boolean;
  structured_data?: any;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  source_mode?: string;
  sources_json?: any;
  created_at: string;
  // Augmented properties for active chat rendering
  is_grounded?: boolean;
  document_sources?: DocumentSource[];
  web_sources?: WebSource[];
  fallback_used?: boolean;
  structured_data?: any;
}

export interface ChatHistoryResponse {
  conversation_id: string;
  title: string | null;
  messages: ChatMessageRecord[];
}

export type FlashcardDifficulty = 'easy' | 'medium' | 'hard';
export type ReviewStatus = 'unreviewed' | 'known' | 'review_again';

export interface FlashcardCard {
  id: string;
  set_id: string;
  question: string;
  answer: string;
  document_id: string;
  document_name: string;
  page_number: number;
  source_chunk_id: string;
  review_status: ReviewStatus;
  created_at: string;
}

export interface FlashcardSet {
  id: string;
  title: string;
  difficulty: FlashcardDifficulty;
  count: number;
  created_at: string;
  cards: FlashcardCard[];
}

export interface FlashcardGenerateRequest {
  document_ids?: string[] | null;
  count?: number;
  difficulty?: FlashcardDifficulty;
}

export interface QuizQuestion {
  question_id: number;
  question: string;
  options: string[];
}

export interface Quiz {
  id: string;
  title: string;
  difficulty: FlashcardDifficulty;
  question_count: number;
  questions: QuizQuestion[];
  completed: boolean;
  score: number | null;
  created_at: string;
}

export interface QuizGenerateRequest {
  document_ids?: string[] | null;
  question_count?: number;
  difficulty?: FlashcardDifficulty;
}

export interface QuizSubmissionResult {
  question_id: number;
  question: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
  source_reference?: {
    document: string;
    page: number;
    snippet: string;
  };
}

export interface QuizSubmitResponse {
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  results: QuizSubmissionResult[];
}

export interface WebSearchRequest {
  query: string;
  document_ids?: string[];
}

export interface WebSearchResponse {
  query: string;
  provider: string;
  results: WebSource[];
  count: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

export interface StatusResponse {
  status: 'operational' | 'degraded' | string;
  environment: string;
  database: {
    status: string;
    type: string;
    message: string;
  };
  pinecone: {
    index_name: string;
    dimension: number;
    total_vectors: number;
    connected: boolean;
    error?: string;
  };
  llm_configuration: {
    provider: string;
    model: string;
    configured: boolean;
  };
  embedding_configuration: {
    provider: string;
    model: string;
    dimension: number;
    configured: boolean;
  };
  web_search_configuration: {
    provider: string;
    configured: boolean;
  };
  all_required_credentials_valid: boolean;
}
