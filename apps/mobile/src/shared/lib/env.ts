import { z } from 'zod';

// Expo inlines any EXPO_PUBLIC_* variable from .env at build time — see .env.example.
const envSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url(),
});

function loadEnv() {
  const result = envSchema.safeParse({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  });

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables — see .env.example.');
  }

  return result.data;
}

// Fails fast on boot if required config is missing or malformed — see ARCHITECTURE.md §10.
export const env = loadEnv();
