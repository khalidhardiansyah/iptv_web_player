import { NextResponse } from 'next/server';
import { XtreamClient } from '@/lib/xtream-client';

// Cache clients to reuse connections
const clientCache = new Map<string, XtreamClient>();

function getOrCreateClient(baseUrl: string, username: string, password: string): XtreamClient {
  const key = `${baseUrl}:${username}`;
  
  if (!clientCache.has(key)) {
    clientCache.set(key, new XtreamClient({ baseUrl, username, password }));
  }
  
  return clientCache.get(key)!;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, baseUrl, username, password, ...params } = body;

    if (!baseUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing baseUrl, username, or password' }, { status: 400 });
    }

    const client = getOrCreateClient(baseUrl, username, password);

    let result;
    switch (action) {
      case 'authenticate':
        result = await client.authenticate();
        break;
      case 'profile':
        result = await client.getProfile();
        break;
      case 'categories':
        result = await client.getCategories();
        break;
      case 'channels':
        result = await client.getChannels(params.categoryId);
        break;
      case 'link':
        result = await client.getLink(params.streamId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Xtream API Error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
