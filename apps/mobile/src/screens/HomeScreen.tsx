import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCourses } from '../hooks/useCourse';
import { useNavigationStore } from '../store/navigationStore';
import { colors, spacing, typography, radius } from '../theme';
import type { TabScreenProps } from '../navigation/types';
import { MonoButton } from '../components/MonoButton';

type Props = TabScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { data, isLoading, error, refetch } = useCourses();
  const setCourseId = useNavigationStore((s) => s.setCourseId);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image
            source={require('../../assets/hero.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroEyebrow}>GUKTO · BIKE · NAVIGATION</Text>
            <Text style={styles.heroTitle}>국토를 달리다</Text>
            <Text style={styles.heroSubtitle}>
              한강에서 낙동강까지{'\n'}검증된 공식 자전거길
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric label="코스" value={data?.length ? `${data.length}` : '-'} />
          <View style={styles.metricDivider} />
          <Metric label="공식데이터" value="행안부" />
          <View style={styles.metricDivider} />
          <Metric label="모드" value="주행" />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>코스 선택</Text>
          <Text style={styles.sectionCaption}>원하는 구간을 선택하세요</Text>
        </View>

        {isLoading && (
          <ActivityIndicator color={colors.text} style={{ marginTop: 24 }} />
        )}
        {error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>코스를 불러올 수 없습니다.</Text>
            <MonoButton
              label="다시 시도"
              variant="outline"
              onPress={() => refetch()}
            />
          </View>
        )}

        <FlatList
          scrollEnabled={false}
          data={data ?? []}
          keyExtractor={(it) => String(it.id)}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item, index }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.6 }]}
              onPress={() => {
                setCourseId(item.id);
                navigation.navigate('Ride');
              }}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardIndex}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.total_distance_km
                    ? `${Number(item.total_distance_km).toFixed(1)} km`
                    : '-'}
                  {item.description ? `  ·  ${item.description}` : ''}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const HERO_HEIGHT = 280;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  hero: {
    height: HERO_HEIGHT,
    backgroundColor: colors.bgInverse,
    overflow: 'hidden',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroTextWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  heroEyebrow: {
    color: colors.textInverse,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
    opacity: 0.75,
    marginBottom: spacing.sm,
  },
  heroTitle: {
    color: colors.textInverse,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSubtitle: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.85,
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.divider,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
  },

  sectionHead: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionCaption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  cardLeft: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIndex: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  cardBody: { flex: 1 },
  cardTitle: { ...typography.h3, color: colors.text },
  cardSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  sep: {
    height: 1,
    backgroundColor: colors.divider,
    marginLeft: spacing.lg,
  },
  error: { padding: spacing.lg, gap: spacing.md },
  errorText: { color: colors.text, ...typography.body },
});
