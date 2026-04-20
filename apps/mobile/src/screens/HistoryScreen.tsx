import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export function HistoryScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.title}>주행 기록</Text>
        <Text style={styles.sub}>
          (MVP) 서버에 저장된 내 기록을 여기에 표시합니다.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.sm },
  title: { ...typography.h2, color: colors.text },
  sub: { ...typography.body, color: colors.textMuted },
});
