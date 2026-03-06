export interface FDUInput {
  p1: number;
  p2: number;
  u1: number;
  u2: number;
  c1: number;
  c2: number;
  r1: number;
  r2: number;
}

export interface FDUResult {
  score: number;
  status: 'green' | 'yellow' | 'red';
  message: string;
  utilityScore: number;
  riskScore: number;
}

export interface Decision {
  id: string;
  category: 'business' | 'career' | 'relationship' | 'finance';
  date: string;
  inputs: FDUInput;
  result: FDUResult;
  notes?: string;
  ai_report?: string;
  context?: string;
}

export type LanguageCode = 'es' | 'en' | 'pt' | 'fr';

export interface SubscriptionOption {
  id: string;
  duration: string;
  price: string;
  savings?: string;
}