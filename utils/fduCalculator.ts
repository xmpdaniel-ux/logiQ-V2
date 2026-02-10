import { FDUInput, FDUResult } from '../types';

export const calculateFDU = (inputs: FDUInput): FDUResult => {
  const { p1, p2, u1, u2, c1, c2, r1, r2 } = inputs;

  // Step 1: Factor de Probabilidad
  const factorProbabilidad = (p1 + p2) / 20;

  // Step 2: Score de Utilidad
  const scoreUtilidad = (u1 + u2) * factorProbabilidad;

  // Step 3: Score de Riesgo
  const scoreRiesgo = (c1 + c2 + r2) - (r1 / 2);

  // Step 4: Score Final FDU
  const scoreFinal = (scoreUtilidad * 10) - scoreRiesgo;

  // Determinar estado (semáforo)
  let status: 'green' | 'yellow' | 'red';
  let message: string;

  if (scoreFinal >= 50) {
    status = 'green';
    message = 'STATUS_GREEN';
  } else if (scoreFinal >= 20) {
    status = 'yellow';
    message = 'STATUS_YELLOW';
  } else {
    status = 'red';
    message = 'STATUS_RED';
  }

  return {
    score: Math.round(scoreFinal * 10) / 10,
    status,
    message,
    utilityScore: Math.round(scoreUtilidad * 10) / 10,
    riskScore: Math.round(scoreRiesgo * 10) / 10,
  };
};