export interface TalentPool {
  id: string;
  title: string;
  description: string | null;
  candidate_count: number;
  created_at: string;
  updated_at: string;
}

export interface Candidate {
  id: string;
  pool_id: string;
  full_name: string;
  email?: string | null;
  resume_id?: string | null;
  filename?: string | null;
  page_count: number;
  chunks_count: number;
  created_at: string;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CitationDetail {
  id: string;
  citation_index: number;
  candidate_id: string;
  candidate_name: string;
  chunk_id: string;
  chunk_index: number;
  page_number: number;
  source_text: string;
  bounding_boxes: BoundingBox[];
}

export interface EvaluationDonePayload {
  type: "done";
  evaluation_id: string;
  grounding_score: number;
  total_citations: number;
  citations: CitationDetail[];
  hallucinations_detected: number;
}

export interface ActiveCitationTarget {
  candidateId: string;
  candidateName: string;
  pageNumber: number;
  boundingBoxes: BoundingBox[];
  sourceText: string;
}
