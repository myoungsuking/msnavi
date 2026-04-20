import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore } from '../store/settingsStore';
import { colors, spacing, typography } from '../theme';
import { appConfig } from '../config/appConfig';

export function SettingsScreen() {
  const gpsIntervalMs = useSettingsStore((s) => s.gpsIntervalMs);
  const battery = useSettingsStore((s) => s.batterySaverEnabled);
  const setBatterySaver = useSettingsStore((s) => s.setBatterySaver);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>설정</Text>
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>배터리 절약 모드</Text>
          <Text style={styles.sub}>GPS 주기 {gpsIntervalMs / 1000}초</Text>
        </View>
        <Switch
          value={battery}
          onValueChange={setBatterySaver}
          trackColor={{ false: colors.border, true: colors.bgInverse }}
          thumbColor={colors.bg}
        />
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>API 서버</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {appConfig.apiBaseUrl}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.divider,
  },
  label: { ...typography.body, color: colors.text, fontWeight: '600' },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
});
