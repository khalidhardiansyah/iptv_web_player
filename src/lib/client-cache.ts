import { StalkerClient } from '@/lib/stalker';

// In-memory cache for client instances (in production, use Redis or similar)
const clientCache = new Map<string, { client: StalkerClient; lastUsed: number }>();

// Cleanup old clients every 5 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes
  
  for (const [key, value] of clientCache.entries()) {
    if (now - value.lastUsed > timeout) {
      clientCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function getOrCreateClient(baseUrl: string, mac: string): StalkerClient {
  const key = `${baseUrl}:${mac}`;
  
  let cached = clientCache.get(key);
  
  if (!cached) {
    const client = new StalkerClient({ baseUrl, mac });
    cached = { client, lastUsed: Date.now() };
    clientCache.set(key, cached);
  } else {
    cached.lastUsed = Date.now();
  }
  
  return cached.client;
}
