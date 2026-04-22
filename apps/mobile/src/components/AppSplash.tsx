import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

/**
 * Expo Go / dev-client 환경에서 네이티브 스플래시가 꺼진 직후 잠깐 노출되는
 * 빈 화면을 가리기 위한 사용자 지정 스플래시.
 *
 * 개발용 로딩 오버레이("Loading from ...") 와 자연스럽게 이어지도록
 * 흰 배경 + 중앙 앱 아이콘 + 은은한 로딩 인디케이터만 남긴 미니멀 구성.
 */
export function AppSplash() {
  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/splash.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator style={styles.spinner} size="small" color="#999999" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 220,
  },
  spinner: {
    position: 'absolute',
    bottom: 80,
  },
});
