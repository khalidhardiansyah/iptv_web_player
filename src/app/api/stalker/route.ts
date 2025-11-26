import { NextResponse } from 'next/server';
import { getOrCreateClient } from '@/lib/client-cache';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, baseUrl, mac, ...params } = body;

    if (!baseUrl || !mac) {
      return NextResponse.json({ error: 'Missing baseUrl or mac' }, { status: 400 });
    }

    const client = getOrCreateClient(baseUrl, mac);

    let result;
    switch (action) {
      case 'login':
        // Handshake to establish session
        await client.handshake();
        result = { success: true };
        break;
      case 'categories':
        result = await client.getCategories();
        break;
      case 'channels':
        result = await client.getChannels(params.genreId);
        break;
      case 'link':
        result = await client.getLink(params.cmd);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
    });
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      details: error.code 
    }, { status: 500 });
  }
}
