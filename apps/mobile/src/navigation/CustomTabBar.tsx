import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '../theme';
import type { TabParamList } from './types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_META: Record<
  keyof TabParamList,
  { active: IoniconName; inactive: IoniconName; label: string }
> = {
  Home: { active: 'compass', inactive: 'compass-outline', label: '홈' },
  Ride: { active: 'bicycle', inactive: 'bicycle-outline', label: '주행' },
  Nearby: { active: 'location', inactive: 'location-outline', label: '주변' },
  History: { active: 'time', inactive: 'time-outline', label: '기록' },
  Settings: {
    active: 'settings-sharp',
    inactive: 'settings-outline',
    label: '설정',
  },
};

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_META[route.name as keyof TabParamList];
          if (!meta) return null;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={styles.item}
              hitSlop={8}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={isFocused ? meta.active : meta.inactive}
                  size={22}
                  color={isFocused ? colors.text : colors.textSubtle}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  isFocused ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {meta.label}
              </Text>
              <View
                style={[
                  styles.indicator,
                  isFocused
                    ? { backgroundColor: colors.text }
                    : { backgroundColor: 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  bar: {
    flexDirection: 'row',
    height: 58,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  iconWrap: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 4,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  labelInactive: {
    color: colors.textSubtle,
    fontWeight: '500',
  },
  indicator: {
    marginTop: 6,
    width: 16,
    height: 2,
    borderRadius: 2,
  },
});
