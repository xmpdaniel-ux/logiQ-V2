import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Decision } from '../types';

const HISTORY_KEY = '@fdu_history';
const PREMIUM_KEY = '@fdu_premium';
const AI_CREDITS_KEY = '@fdu_ai_credits';

// Storage adapter for web vs native
const storageGet = async (key: string): Promise<string | null> => {
  // Skip storage during SSR
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (Platform.OS === 'web' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = async (key: string, value: string): Promise<void> => {
  // Skip storage during SSR
  if (typeof window === 'undefined') {
    return;
  }
  
  if (Platform.OS === 'web' && window.localStorage) {
    window.localStorage.setItem(key, value);
  } else {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Ignore storage errors
    }
  }
};

const storageRemove = async (key: string): Promise<void> => {
  // Skip storage during SSR
  if (typeof window === 'undefined') {
    return;
  }
  
  if (Platform.OS === 'web' && window.localStorage) {
    window.localStorage.removeItem(key);
  } else {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
};

export const saveDecision = async (decision: Decision): Promise<void> => {
  try {
    const existingHistory = await getHistory();
    const updatedHistory = [decision, ...existingHistory];
    await storageSet(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (error) {
    console.error('Error saving decision:', error);
    throw error;
  }
};

export const getHistory = async (): Promise<Decision[]> => {
  try {
    const history = await storageGet(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error getting history:', error);
    return [];
  }
};

export const clearHistory = async (): Promise<void> => {
  try {
    await storageRemove(HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing history:', error);
    throw error;
  }
};

export const setPremiumStatus = async (isPremium: boolean): Promise<void> => {
  try {
    await storageSet(PREMIUM_KEY, JSON.stringify(isPremium));
  } catch (error) {
    console.error('Error setting premium status:', error);
    throw error;
  }
};

export const getPremiumStatus = async (): Promise<boolean> => {
  try {
    const status = await storageGet(PREMIUM_KEY);
    // IMPORTANT: Default to FALSE - users must pay to be premium
    return status ? JSON.parse(status) : false;
  } catch (error) {
    console.error('Error getting premium status:', error);
    return false;
  }
};

// Function to reset premium status (for testing/debug)
export const resetPremiumStatus = async (): Promise<void> => {
  try {
    await storageRemove(PREMIUM_KEY);
    await storageSet(AI_CREDITS_KEY, JSON.stringify(3)); // Reset to 3 free credits
  } catch (error) {
    console.error('Error resetting premium status:', error);
  }
};

export const getAICredits = async (): Promise<number> => {
  try {
    const credits = await storageGet(AI_CREDITS_KEY);
    return credits ? JSON.parse(credits) : 3; // Default 3 free credits
  } catch (error) {
    console.error('Error getting AI credits:', error);
    return 3;
  }
};

export const setAICredits = async (credits: number): Promise<void> => {
  try {
    await storageSet(AI_CREDITS_KEY, JSON.stringify(credits));
  } catch (error) {
    console.error('Error setting AI credits:', error);
    throw error;
  }
};