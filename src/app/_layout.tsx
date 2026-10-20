import { setAudioModeAsync } from 'expo-audio';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { startSync } from '@/lib/sync';
import { useAppTheme } from '@/theme/use-app-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useAppTheme();
  const { colors } = theme;

  useEffect(() => {
    // Stores load synchronously, so the first render already has the right theme.
    SplashScreen.hideAsync();
    // Step sounds: play even with the iPhone silent switch on, without stopping the user's music.
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    startSync();
  }, []);

  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [colors]
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        {/* On wide web screens, keep the app in a readable centred column. */}
        <View style={Platform.OS === 'web' ? styles.webColumn : styles.fill}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.text, fontWeight: '700' },
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="build/[id]" options={{ title: '' }} />
            <Stack.Screen name="edit/[id]" options={{ title: 'Edit build' }} />
            <Stack.Screen name="play/[id]" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="community/[id]" options={{ title: '' }} />
            <Stack.Screen name="account" options={{ title: 'Player key' }} />
          </Stack>
        </View>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = {
  fill: { flex: 1 },
  webColumn: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center' },
} as const;
