import { Stack } from 'expo-router/stack';

export default function SubscriptionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="plans" />
      <Stack.Screen name="success" />
      <Stack.Screen name="cancel" />
    </Stack>
  );
}