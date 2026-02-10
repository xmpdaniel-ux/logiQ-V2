import Constants from 'expo-constants';
import { FDUInput, FDUResult } from '../types';

interface AIReportRequest {
  category: string;
  p1: number;
  p2: number;
  u1: number;
  u2: number;
  c1: number;
  c2: number;
  r1: number;
  r2: number;
  score: number;
  status: string;
  context?: string;
  device_id?: string;
}

interface AIReportResponse {
  success: boolean;
  report: string;
  category: string;
  score: number;
}

export const generateAIReport = async (
  category: string,
  inputs: FDUInput,
  result: FDUResult,
  context: string = ''
): Promise<string> => {
  try {
    // Get backend URL from environment
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
    const apiUrl = `${backendUrl}/api/generate-ai-report`;

    const requestData: AIReportRequest = {
      category,
      p1: inputs.p1,
      p2: inputs.p2,
      u1: inputs.u1,
      u2: inputs.u2,
      c1: inputs.c1,
      c2: inputs.c2,
      r1: inputs.r1,
      r2: inputs.r2,
      score: result.score,
      status: result.status,
      context,
    };

    console.log('Calling AI API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to generate AI report');
    }

    const data: AIReportResponse = await response.json();

    if (!data.success || !data.report) {
      throw new Error('Invalid response from AI service');
    }

    return data.report;
  } catch (error) {
    console.error('Error generating AI report:', error);
    throw error;
  }
};