import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Ride: undefined;
  Nearby: undefined;
  History: undefined;
  Settings: undefined;
};

export interface NearbyDetailParam {
  poi: {
    id?: string | number;
    type: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    distanceM: number;
    source?: 'db' | 'kakao';
  };
  myLat: number;
  myLng: number;
}

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  RideDetail: { rideId: number };
  NearbyDetail: NearbyDetailParam;
};

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
