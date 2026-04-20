import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { RideScreen } from '../screens/RideScreen';
import { NearbyScreen } from '../screens/NearbyScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<
  keyof TabParamList,
  { active: IoniconName; inactive: IoniconName }
> = {
  Home: { active: 'compass', inactive: 'compass-outline' },
  Ride: { active: 'bicycle', inactive: 'bicycle-outline' },
  Nearby: { active: 'location', inactive: 'location-outline' },
  History: { active: 'time', inactive: 'time-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

function makeScreenOptions({
  route,
}: {
  route: { name: keyof TabParamList };
}): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarStyle: {
      backgroundColor: colors.bg,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: 64,
      paddingBottom: 10,
      paddingTop: 8,
    },
    tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.textSubtle,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    tabBarIcon: ({ focused, color, size }) => {
      const iconSet = TAB_ICONS[route.name];
      const name = focused ? iconSet.active : iconSet.inactive;
      return <Ionicons name={name} color={color} size={size ?? 22} />;
    },
  };
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={makeScreenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '홈' }} />
      <Tab.Screen name="Ride" component={RideScreen} options={{ title: '주행' }} />
      <Tab.Screen
        name="Nearby"
        component={NearbyScreen}
        options={{ title: '주변' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: '기록' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정' }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
