import { Stack } from 'expo-router/stack';

export default function MenuLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/edit/[itemId]" />
    </Stack>
  );
}