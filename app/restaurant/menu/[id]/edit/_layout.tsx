import { Stack } from 'expo-router/stack';

export default function EditMenuLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[itemId]" />
    </Stack>
  );
}