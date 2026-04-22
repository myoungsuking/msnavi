import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './navigation/RootNavigator';
import { AppSplash } from './components/AppSplash';
import { colors } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const SPLASH_DURATION_MS = 1200;

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar
          style="dark"
          backgroundColor={colors.bg}
          translucent={false}
        />
        {splashDone ? <RootNavigator /> : <AppSplash />}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
