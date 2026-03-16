import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { usePremium } from '../contexts/PremiumContext';
import i18n from '../i18n';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeOut, withRepeat, withSequence, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatModalProps {
  visible: boolean;
  initialReport: string;
  category: string;
  sessionId: string;
  onClose: () => void;
}

const AIChatModal: React.FC<AIChatModalProps> = ({
  visible,
  initialReport,
  category,
  sessionId,
  onClose
}) => {
  const { t } = useTranslation();
  const { isPremium, chatCredits, deviceId, refreshUserStatus } = usePremium(); // Extracción correcta de datos del contexto
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  // Créditos restantes: constante según estado premium/free
  const questionsRemaining = isPremium ? 999 : chatCredits;

  // Initialize with the initial report as first message
  useEffect(() => {
    if (visible && initialReport) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: initialReport
      }]);
    }
  }, [visible, initialReport]);

  const copyMessage = async (text: string) => {
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== 'web') {
      // Opcional: Feedback haptico o pequeño toast si existiera
    }
  };

  const TypingIndicator = () => {
    const opacity = useSharedValue(0.3);
    useEffect(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 })
        ),
        -1,
        true
      );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value
    }));

    return (
      <Animated.View style={[styles.assistantBubble, styles.typingBubble, animatedStyle]}>
        <Ionicons name="sparkles" size={16} color="#F1C40F" style={styles.messageIcon} />
        <Text style={styles.thinkingText}>{t('CHAT_THINKING') || 'LogiQ está analizando...'}</Text>
      </Animated.View>
    );
  };

  const handleSendQuestion = async () => {
    if (!inputText.trim() || loading || questionsRemaining <= 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const backendUrl = 'https://logiq-production.up.railway.app/api';

      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      conversationHistory.push({ role: 'user', content: userMessage.content });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const response = await fetch(`${backendUrl}/ai-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          category,
          question: userMessage.content,
          conversation_history: conversationHistory,
          device_id: deviceId,
          language: i18n.language,
          session_id: sessionId,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'out_of_credits') {
          throw new Error('out_of_credits');
        }
        throw new Error('Failed');
      }

      const data = await response.json();

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response
      }]);

      // Actualizamos los créditos desde el backend
      await refreshUserStatus();

    } catch (error: any) {
      let errorMessage = t('ERR_AI_RESPONSE') || 'Error al conectar con la IA. Intenta de nuevo.';

      if (error.message === 'out_of_credits') {
        errorMessage = t('ERR_OUT_OF_CREDITS') || 'Has agotado tus créditos de chat.';
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage
      }]);

      // Si se agotaron los créditos, actualizamos el estado
      if (error.message === 'out_of_credits') {
        await refreshUserStatus();
      }
    } finally {
      setLoading(false);
      // Aseguramos scroll al final
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const suggestedQuestions = [
    t('CHAT_SUGGESTION_STEPS'),
    t('CHAT_SUGGESTION_RISKS'),
    t('CHAT_SUGGESTION_IMPROVE'),
    t('CHAT_SUGGESTION_ALTERNATIVES')
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={24} color="#F1C40F" />
              <View>
                <Text style={styles.title}>{t('CHAT_TITLE')}</Text>
                <Text style={styles.subtitle}>
                  {questionsRemaining > 0
                    ? t('CHAT_REMAINING_QUESTIONS', { count: questionsRemaining })
                    : t('CHAT_NO_QUESTIONS_LEFT')}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#2C3E50" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((message) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => copyMessage(message.content)}
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.role === 'user' ? styles.userContainer : styles.assistantContainer
                ]}
              >
                <View style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  message.role === 'assistant' && styles.proAssistantBubble
                ]}>
                  {message.role === 'assistant' && (
                    <Ionicons name="sparkles" size={16} color="#F1C40F" style={styles.messageIcon} />
                  )}
                  <Text style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText
                  ]}>
                    {message.content}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {loading && (
              <View style={styles.assistantContainer}>
                <TypingIndicator />
              </View>
            )}
          </ScrollView>

          {/* Suggested Questions (only show if no user messages yet) */}
          {messages.length === 1 && questionsRemaining > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>{t('CHAT_SUGGESTIONS_TITLE')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestedQuestions.map((q, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionChip}
                    onPress={() => setInputText(q)}
                  >
                    <Text style={styles.suggestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Area */}
          {questionsRemaining > 0 ? (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={t('CHAT_PLACEHOLDER')}
                placeholderTextColor="#95A5A6"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                onPress={handleSendQuestion}
                disabled={!inputText.trim() || loading}
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.limitReachedContainer}>
              <Ionicons name="lock-closed" size={20} color="#95A5A6" />
              <Text style={styles.limitReachedText}>
                {t('CHAT_LIMIT_REACHED')}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  subtitle: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 16,
  },
  messageContainer: {
    width: '100%',
    marginVertical: 4,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  assistantContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#3498DB',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#F5F6FA',
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  proAssistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBF5FB',
  },
  typingBubble: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F1F2F6',
  },
  messageIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2C3E50',
    flexShrink: 1,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  thinkingText: {
    color: '#7F8C8D',
    fontSize: 14,
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  suggestionChip: {
    backgroundColor: '#EBF5FB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  suggestionText: {
    color: '#3498DB',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F5F6FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 15,
    color: '#2C3E50',
  },
  sendButton: {
    backgroundColor: '#3498DB',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  limitReachedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
    backgroundColor: '#F5F6FA',
  },
  limitReachedText: {
    color: '#95A5A6',
    fontSize: 14,
  },
});

export default AIChatModal;