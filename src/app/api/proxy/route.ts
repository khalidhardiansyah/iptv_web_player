import { NextRequest, NextResponse } from 'next/server';

// Configuration
const TIMEOUT_MS = 60000; // Increase to 60 seconds for slow portals
const MAX_RETRIES = 2; // Retry failed requests

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    return await fetch(url, options);
  } catch (error: any) {
    if (retries > 0 && (error.name === 'AbortError' || error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNRESET')) {
      console.log(`Retrying request... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

async function handleRequest(request: NextRequest) {
  try {
    const targetUrl = request.nextUrl.searchParams.get('url');
    
    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Forward all query params except 'url'
    const url = new URL(targetUrl);
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'url') {
        url.searchParams.append(key, value);
      }
    });

    // Forward headers from client
    const headers: HeadersInit = {
      'User-Agent': request.headers.get('x-user-agent') || 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Connection': 'keep-alive', // Changed to keep-alive for better performance
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    };
    
    // Add Referer header from target URL origin (some portals check this)
    try {
      const targetUrlObj = new URL(targetUrl);
      headers['Referer'] = targetUrlObj.origin + '/';
    } catch (e) {
      // If URL parsing fails, skip Referer
    }

    // Forward cookies if present
    const cookie = request.headers.get('x-cookie');
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const authorization = request.headers.get('x-authorization');
    if (authorization) {
      headers['Authorization'] = authorization;
    }

    // Forward Content-Type for POST requests
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Abort upstream request if client disconnects
    if (request.signal.aborted) {
      controller.abort();
    }
    request.signal.addEventListener('abort', () => {
      controller.abort();
    });

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
      };

      // Forward body for POST requests
      if (request.method === 'POST') {
        const body = await request.text();
        fetchOptions.body = body;
      }

      const response = await fetchWithRetry(url.toString(), fetchOptions);

      clearTimeout(timeoutId);

      const data = await response.text();
      
      // Forward response headers
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', response.headers.get('content-type') || 'application/json');
      
      // Forward cookies from response
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        responseHeaders.set('x-set-cookie', setCookie);
      }

      return new NextResponse(data, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Handle specific fetch errors
      if (fetchError.name === 'AbortError') {
        console.error(`Request timeout after ${TIMEOUT_MS / 1000} seconds`);
        return NextResponse.json({ 
          error: 'Request timeout',
          details: `The server took too long to respond (${TIMEOUT_MS / 1000}s timeout)`,
          url: url.toString(),
        }, { status: 504 });
      }
      
      throw fetchError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('Proxy error details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name,
    });
    
    // Provide more specific error messages
    let errorMessage = error.message;
    let errorDetails = '';
    
    if (error.cause?.code === 'ENOTFOUND') {
      errorMessage = 'Server not found';
      errorDetails = 'The server hostname could not be resolved. Please check the URL.';
    } else if (error.cause?.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
      errorDetails = 'The server refused the connection. The server may be down.';
    } else if (error.cause?.code === 'ETIMEDOUT' || error.cause?.code === 'ECONNRESET') {
      errorMessage = 'Connection timeout';
      errorDetails = 'The server did not respond in time. Please try again.';
    } else if (error.message?.includes('certificate')) {
      errorMessage = 'SSL Certificate error';
      errorDetails = 'The server has an invalid SSL certificate.';
    }
    
    return NextResponse.json({ 
      error: 'Proxy request failed',
      message: errorMessage,
      details: errorDetails || error.message,
      type: error.name,
      code: error.cause?.code,
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

// Increase route timeout for slow portals
export const maxDuration = 60; // 60 seconds
