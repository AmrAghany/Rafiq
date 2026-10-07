import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="about" />
      <Stack.Screen name="scan" />
      <Stack.Screen name="health" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
