
export enum EntityType {
  PERSON = 'PERSON',
  LOCATION = 'LOCATION',
  EMAIL_ADDRESS = 'EMAIL_ADDRESS',
  IP_ADDRESS = 'IP_ADDRESS',
  PHONE_NUMBER = 'PHONE_NUMBER',
  CREDIT_CARD = 'CREDIT_CARD',
  DATE_TIME = 'DATE_TIME',
  URL = 'URL'
}

export interface DetectedEntity {
  text: string;
  type: EntityType;
  startIndex?: number; // Calculated on client side
  endIndex?: number;   // Calculated on client side
}

export type RedactionMode = 'REMOVE' | 'MASK';

export interface ProcessingStats {
  originalLength: number;
  redactedLength: number;
  levenshteinDistance: number;
  similarityScore: number; // 0 to 100 (Original vs Redacted)
  entityCount: number;
  accuracyScore?: number; // 0 to 100 (Redacted vs Expected)
}

export interface DiffChunk {
  value: string;
  type: 'match' | 'mismatch-actual' | 'mismatch-expected';
}
