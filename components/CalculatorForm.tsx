import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FDUInput, FDUResult, Decision } from '../types';
import { calculateFDU } from '../utils/fduCalculator';
import { saveDecision } from '../utils/storage';
import { usePremium } from '../contexts/PremiumContext';
import ResultCard from './ResultCard';
import AIReportModal from './AIReportModal';
import AIChatModal from './AIChatModal';
import SubscriptionPaywall from './SubscriptionPaywall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface CalculatorFormProps {
  category: 'business' | 'career' | 'relationship' | 'finance';
  titleKey: string;
}

const CalculatorForm: React.FC<CalculatorFormProps> = ({ category, titleKey }) => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const {
    isPremium,
    reportCredits,
    chatCredits,
    deviceId,
    showPaywall,
    paywallTrigger,
    setShowPaywall,
    checkReportCredits,
    checkChatCredits,
    handlePurchaseSuccess,
    refreshUserStatus
  } = usePremium();
  const insets = useSafeAreaInsets();

  const [inputs, setInputs] = useState<FDUInput>({
    p1: 5,
    p2: 5,
    u1: 5,
    u2: 5,
    c1: 5,
    c2: 5,
    r1: 5,
    r2: 5,
  });

  const [result, setResult] = useState<FDUResult | null>(null);
  const [context, setContext] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // AI Report states
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Función para obtener deviceId garantizado
  const getDeviceId = async (): Promise<string> => {
    if (deviceId) return deviceId;
    try {
      const storedId = await AsyncStorage.getItem('@device_id');
      if (storedId) return storedId;
    } catch (error) {
      console.error('Error reading device_id from storage:', error);
    }
    return `web_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  };

  // Sincronización Nube: Recibe el ID generado localmente
  const saveToCloud = async (decisionData: {
    id: string;
    device_id: string;
    category: string;
    inputs: FDUInput;
    result: FDUResult;
    context?: string;
    ai_report?: string;
  }) => {
    try {
      const backendUrl = 'https://logiq-production.up.railway.app';

      const payload = {
        id: decisionData.id, // Sincronizamos el ID
        device_id: decisionData.device_id,
        category: decisionData.category,
        inputs: decisionData.inputs,
        result: decisionData.result,
        context: decisionData.context || '',
        ai_report: decisionData.ai_report || ''
      };

      const response = await fetch(`${backendUrl}/api/decisions/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn('Cloud save failed (non-critical):', response.status);
      }
    } catch (error) {
      console.warn('Error saving to cloud (non-critical):', error);
    }
  };

  const handleCalculate = () => {
    try {
      const calculatedResult = calculateFDU(inputs);
      setResult(calculatedResult);
      setCurrentSessionId(Date.now().toString());

      setTimeout(() => {
        if (Platform.OS === 'web') {
          if (window.confirm(`${t('REMINDER_TITLE')}\n\n${t('REMINDER_SAVE_MSG')}`)) {
            handleSave(calculatedResult);
          }
        } else {
          Alert.alert(
            t('REMINDER_TITLE'),
            t('REMINDER_SAVE_MSG'),
            [
              { text: t('BTN_LATER'), style: 'cancel' },
              { text: t('BTN_SAVE_NOW'), style: 'default', onPress: () => handleSave(calculatedResult) },
            ]
          );
        }
      }, 600);
    } catch (error) {
      console.error('Error calculating FDU:', error);
      Alert.alert(t('ERROR'), t('MSG_CALCULATION_ERROR'));
    }
  };

  const handleReset = () => {
    setInputs({
      p1: 5, p2: 5, u1: 5, u2: 5, c1: 5, c2: 5, r1: 5, r2: 5,
    });
    setResult(null);
    setContext('');
    setCurrentSessionId(null);
  };

  const handleSave = async (resultOverride?: FDUResult) => {
    const finalResult = resultOverride || result;
    if (!finalResult) {
      if (Platform.OS === 'web') {
        window.alert(t('MSG_CALCULATE_FIRST'));
      } else {
        Alert.alert(t('ERROR'), t('MSG_CALCULATE_FIRST'));
      }
      return;
    }

    setIsSaving(true);
    try {
      const currentDeviceId = await getDeviceId();
      const sharedId = currentSessionId || Date.now().toString(); // Usar ID de sesión existente
      if (!currentSessionId) setCurrentSessionId(sharedId);

      const decision: Decision = {
        id: sharedId,
        category,
        date: new Date().toISOString(),
        inputs,
        result: finalResult,
        context: context || undefined,
      };

      // 1. Guardado local
      await saveDecision(decision);

      // 2. Guardado en nube (Sincronizado)
      await saveToCloud({
        id: sharedId,
        device_id: currentDeviceId,
        category,
        inputs,
        result: finalResult,
        context: context || '',
        ai_report: ''
      });

      if (Platform.OS === 'web') {
        window.alert(t('MSG_SAVED_SUCCESS'));
      } else {
        Alert.alert(t('SUCCESS'), t('MSG_SAVED_SUCCESS'));
      }
    } catch (error) {
      console.error('Error saving:', error);
      if (Platform.OS === 'web') {
        window.alert(t('MSG_SAVE_ERROR'));
      } else {
        Alert.alert(t('ERROR'), t('MSG_SAVE_ERROR'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWithAIReport = async () => {
    if (!result || !aiReport) {
      Alert.alert(t('ERROR'), t('MSG_NEED_RESULT_AND_REPORT'));
      return;
    }

    setIsSaving(true);
    try {
      const currentDeviceId = await getDeviceId();
      const sharedId = currentSessionId || Date.now().toString();
      if (!currentSessionId) setCurrentSessionId(sharedId);

      const decision: Decision = {
        id: sharedId,
        category,
        date: new Date().toISOString(),
        inputs,
        result,
        ai_report: aiReport,
        context: context || undefined,
      };

      await saveDecision(decision);

      await saveToCloud({
        id: sharedId,
        device_id: currentDeviceId,
        category,
        inputs,
        result,
        context: context || '',
        ai_report: aiReport
      });

      Alert.alert('✅ ' + t('SUCCESS'), t('MSG_SAVED_WITH_AI'));
      setAiModalVisible(false);
    } catch (error) {
      console.error('Error saving with AI report:', error);
      Alert.alert(t('ERROR'), t('MSG_SAVE_ERROR'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAIReport = async () => {
    if (!result) {
      Alert.alert(t('ERROR'), t('MSG_CALCULATE_FIRST'));
      return;
    }

    const hasAccess = await checkReportCredits();
    if (!hasAccess) return;

    setAiModalVisible(true);
    setAiLoading(true);
    setAiReport(null);
    setAiError(null);

    try {
      const backendUrl = 'https://logiq-production.up.railway.app/api';
      const currentDeviceId = await getDeviceId();

      // Timeout guard: 15 seconds for AI generation (User request for Build 120)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${backendUrl}/generate-ai-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          category,
          p1: inputs.p1, p2: inputs.p2,
          u1: inputs.u1, u2: inputs.u2,
          c1: inputs.c1, c2: inputs.c2,
          r1: inputs.r1, r2: inputs.r2,
          score: result.score,
          status: result.status,
          context: context || '',
          device_id: currentDeviceId,
          language: i18n.language || 'es',
          detailed_analysis: true,
          include_biases: true,
          domain_context: category
        })
      });

      clearTimeout(timeoutId);

      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.detail?.error === 'out_of_credits') {
          setAiModalVisible(false);
          setShowPaywall(true, 'out_of_report_credits');
          return;
        }
        throw new Error(t('MSG_ACCESS_DENIED'));
      }

      if (!response.ok) {
        if (response.status === 404) throw new Error("Servidor no responde (404). Revisa tu conexión.");
        if (response.status >= 500) throw new Error("Error interno del servidor. Inténtalo de nuevo más tarde.");
        throw new Error(`${t('ERROR')} ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.report) {
        // 3. Incrementar contador de reportes para Growth Hacking
        const reportCountStr = await AsyncStorage.getItem('@logiq_successful_reports');
        const reportCount = reportCountStr ? parseInt(reportCountStr, 10) : 0;
        const newCount = reportCount + 1;
        await AsyncStorage.setItem('@logiq_successful_reports', newCount.toString());

        if (newCount === 2) {
          if (await StoreReview.hasAction()) {
            StoreReview.requestReview();
          }
        }

        setAiReport(data.report);
        await refreshUserStatus();
      } else {
        throw new Error(t('MSG_NO_REPORT'));
      }
    } catch (error: any) {
      console.error('AI Report Error:', error);
      const errorMessage = error.name === 'AbortError'
        ? "El servidor está tardando demasiado. Por favor, revisa tu internet o intenta de nuevo."
        : (error instanceof Error ? error.message : t('MSG_CONNECTION_ERROR'));

      Alert.alert(t('ERROR'), errorMessage);
      setAiError(t('MSG_AI_ERROR') + ': ' + errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  const getCategoryPrefix = () => {
    switch (category) {
      case 'business': return 'NEG';
      case 'career': return 'CAR';
      case 'relationship': return 'REL';
      case 'finance': return 'FIN';
    }
  };

  const prefix = getCategoryPrefix();

  const renderSlider = (key: keyof FDUInput, labelKey: string) => {
    const currentValue = inputs?.[key] ?? 5;
    return (
      <View style={styles.sliderContainer} key={key}>
        <Text style={styles.questionText}>{t(labelKey)}</Text>
        <View style={styles.sliderRow}>
          <Text style={styles.sliderValue}>1</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={currentValue}
            onValueChange={(value) => setInputs(prev => ({ ...prev, [key]: value || 0 }))}
            minimumTrackTintColor="#3498DB"
            maximumTrackTintColor="#BDC3C7"
            thumbTintColor="#2C3E50"
          />
          <Text style={styles.sliderValue}>10</Text>
          <View style={styles.valueBox}>
            <Text style={styles.valueText}>{currentValue}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.headerContainer}>
        <Text style={styles.brandTitle}>LogiQ</Text>
        <Text style={styles.headerTitle}>{t(titleKey)}</Text>
      </View>

      {!isPremium && (
        <TouchableOpacity
          style={styles.premiumBanner}
          onPress={() => setShowPaywall(true, 'manual')}
        >
          <View style={styles.premiumBannerLeft}>
            <View style={styles.premiumBannerText}>
              <Text style={styles.premiumBannerTitle}>
                {reportCredits > 0 || chatCredits > 0 ? t('PREMIUM_BANNER_TITLE') : t('UPGRADE_TITLE')}
              </Text>
              <Text style={styles.premiumBannerSubtitle}>
                {reportCredits > 0 || chatCredits > 0
                  ? `${reportCredits} ${t('CREDITS_REPORTS')} + ${chatCredits} ${t('CREDITS_CHATS')}`
                  : t('PREMIUM_BANNER_SUBTITLE')}
              </Text>
            </View>
          </View>
          <View style={[styles.creditBadgeInline, (reportCredits === 0 && chatCredits === 0) && styles.creditBadgeEmpty]}>
            <Text style={styles.creditBadgeText}>{reportCredits + chatCredits}</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.contextContainer}>
        <Text style={styles.contextLabel}>{t('CONTEXT_LABEL')}</Text>

        {showTooltip && (
          <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={styles.tooltipBubble}
          >
            <View style={styles.tooltipContent}>
              <Ionicons name="information-circle-outline" size={16} color="#3498DB" />
              <Text style={styles.tooltipText}>{t(`TOOLTIP_DESC_${prefix}`)}</Text>
            </View>
            <View style={styles.tooltipArrow} />
          </Animated.View>
        )}

        <TextInput
          style={styles.contextInput}
          multiline
          numberOfLines={4}
          placeholder={t(`CONTEXT_PLACEHOLDER_${prefix}`)}
          placeholderTextColor="#95A5A6"
          value={context}
          onChangeText={setContext}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          maxLength={600}
        />
        <Text style={styles.charCount}>{context.length}/600</Text>
      </View>

      {renderSlider('p1', `VAR_P1_${prefix}`)}
      {renderSlider('p2', `VAR_P2_${prefix}`)}
      {renderSlider('u1', `VAR_U1_${prefix}`)}
      {renderSlider('u2', `VAR_U2_${prefix}`)}
      {renderSlider('c1', `VAR_C1_${prefix}`)}
      {renderSlider('c2', `VAR_C2_${prefix}`)}
      {renderSlider('r1', `VAR_R1_${prefix}`)}
      {renderSlider('r2', `VAR_R2_${prefix}`)}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.calculateButton, isSaving && { opacity: 0.7 }]}
          onPress={handleCalculate}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>{t('BTN_CALCULATE')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleReset}
          disabled={isSaving}
        >
          <Text style={styles.resetButtonText}>{t('BTN_RESET')}</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <>
          <ResultCard result={result} category={category} />



          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
              onPress={() => handleSave()}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>{t('BTN_SAVE')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.aiButton, aiLoading && { opacity: 0.7 }]}
              onPress={handleGenerateAIReport}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>{t('BTN_AI_REPORT')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      <AIReportModal
        visible={aiModalVisible}
        loading={aiLoading}
        report={aiReport}
        error={aiError}
        onClose={() => setAiModalVisible(false)}
        onSaveWithReport={handleSaveWithAIReport}
        onOpenChat={() => {
          setAiModalVisible(false);
          setChatModalVisible(true);
        }}
        category={category}
      />
      <AIChatModal
        visible={chatModalVisible}
        initialReport={aiReport || ''}
        category={category}
        sessionId={currentSessionId || ''}
        onClose={() => setChatModalVisible(false)}
      />

      <SubscriptionPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseSuccess={handlePurchaseSuccess}
        trigger={paywallTrigger}
        language={i18n.language?.startsWith('es') ? 'es' : 'en'}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECF0F1',
  },
  contentContainer: {
    padding: 20,
  },
  headerContainer: {
    backgroundColor: '#2C3E50',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  premiumButton: {
    backgroundColor: '#1ABC9C',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#BDC3C7',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  helpButton: {
    padding: 4,
  },
  contextContainer: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  contextLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  tooltipBubble: {
    position: 'absolute',
    top: -75,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  tooltipContent: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3498DB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipText: {
    color: '#2C3E50',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  tooltipArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#3498DB',
    alignSelf: 'center',
    marginTop: -1,
  },
  contextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2C3E50',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#95A5A6',
    marginTop: 4,
    textAlign: 'right',
  },
  sliderContainer: {
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  questionText: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 12,
    lineHeight: 20,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    marginHorizontal: 8,
  },
  sliderValue: {
    fontSize: 12,
    color: '#7F8C8D',
    width: 20,
  },
  valueBox: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  calculateButton: {
    flex: 2,
    backgroundColor: '#2C3E50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2C3E50',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#27AE60',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  aiButton: {
    flex: 1,
    backgroundColor: '#3498DB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resetButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumBanner: {
    backgroundColor: '#2C3E50',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1ABC9C',
  },
  premiumBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  premiumBannerText: {
    flex: 1,
  },
  premiumBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumBannerSubtitle: {
    color: '#1ABC9C',
    fontSize: 12,
    marginTop: 2,
  },
  creditBadgeInline: {
    backgroundColor: '#1ABC9C',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditBadgeEmpty: {
    backgroundColor: '#E74C3C',
  },
  creditBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fduInfoBox: {
    backgroundColor: '#F8F9FA',
    padding: 14,
    borderRadius: 10,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  fduInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  fduInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C3E50',
  },
  fduInfoText: {
    fontSize: 13,
    color: '#2C3E50',
    lineHeight: 18,
  },
});

export default CalculatorForm;