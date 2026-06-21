import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { submitSupportRequest } from '../services/api.js';
import { getUser } from '../utils/secureStorage.js';
import { useAppTheme } from '../theme/appTheme.js';

const SupportScreen = () => {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await getUser();
      if (currentUser?.email) {
        setEmail(currentUser.email);
      }
    };

    loadUser();
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || !subject.trim() || !message.trim()) {
      Alert.alert('Missing info', 'Email, subject, and message are required.');
      return;
    }

    setLoading(true);

    try {
      const response = await submitSupportRequest({
        name,
        email,
        subject,
        message,
        source: 'mobile_support'
      });

      if (!response.success) {
        Alert.alert('Support request failed', response.error || 'Unable to send your message right now.');
        return;
      }

      Alert.alert('Support request sent', 'We have received your message at support@emmaline.app.');
      setSubject('');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.contentContainer}>
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>Support</Text>
        <Text style={[styles.description, { color: colors.mutedText }]}>Send a support request, privacy question, data access request, or deletion follow-up without leaving the app.</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Your name"
          placeholderTextColor={colors.mutedText}
          value={name}
          onChangeText={setName}
          editable={!loading}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Subject</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="What do you need help with?"
          placeholderTextColor={colors.mutedText}
          value={subject}
          onChangeText={setSubject}
          editable={!loading}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Message</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Describe the issue, privacy request, or account question."
          placeholderTextColor={colors.mutedText}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          editable={!loading}
        />
      </View>

      <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.text }]} onPress={handleSubmit} activeOpacity={0.85} disabled={loading}>
        <Text style={[styles.submitButtonText, { color: colors.surface }]}>{loading ? 'Sending...' : 'Send support request'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: '700'
  },
  description: {
    fontSize: 14,
    lineHeight: 21
  },
  formGroup: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 150,
    fontSize: 14
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700'
  }
});

export default SupportScreen;