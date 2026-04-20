import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCourses } from '../hooks/useCourse';
import { useNavigationStore } from '../store/navigationStore';
import { colors, spacing, typography } from '../theme';
import type { TabScreenProps } from '../navigation/types';
import { MonoButton } from '../components/MonoButton';

type Props = TabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { data, isLoading, error, refetch } = useCourses();
  const setCourseId = useNavigationStore((s) => s.setCourseId);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>국토종주 네비</Text>
        <Text style={styles.subtitle}>코스를 선택하세요</Text>
      </View>

      {isLoading && <ActivityIndicator color={colors.text} style={{ marginTop: 24 }} />}
      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>코스를 불러올 수 없습니다.</Text>
          <MonoButton label="다시 시도" variant="outline" onPress={() => refetch()} />
        </View>
      )}

      <FlatList
        data={data ?? []}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
            onPress={() => {
              setCourseId(item.id);
              navigation.navigate('Ride');
            }}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {item.total_distance_km ? `${item.total_distance_km} km` : '-'}
              {item.description ? `  ·  ${item.description}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  card: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
  },
  cardTitle: { ...typography.h3, color: colors.text },
  cardSub: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  sep: { height: 1, backgroundColor: colors.divider },
  error: { padding: spacing.lg, gap: spacing.md },
  errorText: { color: colors.text, ...typography.body },
});
