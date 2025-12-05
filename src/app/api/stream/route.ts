import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const ua = request.nextUrl.searchParams.get('ua');
  const cookie = request.nextUrl.searchParams.get('cookie');
  const token = request.nextUrl.searchParams.get('token');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  try {
    const targetUrl = new URL(url);
    
    // Create headers for the upstream request
    const headers = new Headers();
    
    // Use custom UA if provided, otherwise use default Chrome UA
    const userAgent = ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    headers.set('User-Agent', userAgent);
    headers.set('Accept', '*/*');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Connection', 'keep-alive');
    
    // Forward specific headers if needed
    const range = request.headers.get('range');
    if (range) {
      headers.set('Range', range);
    }

    // Add Referer and Origin headers (some servers require this)
    const referer = targetUrl.origin;
    headers.set('Referer', referer);
    headers.set('Origin', referer);

    // Forward cookies if provided
    if (cookie) {
      headers.set('Cookie', cookie);
    }

    // Forward token if provided
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    console.log(`[Stream] Fetching: ${targetUrl.toString()}`);
    console.log(`[Stream] User-Agent: ${userAgent.substring(0, 50)}...`);
    if (cookie) console.log(`[Stream] Cookie: ${cookie.substring(0, 50)}...`);

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'follow', // CRITICAL: Follow redirects for Stalker streams
    });

    console.log(`[Stream] Response status: ${response.status}`);
    console.log(`[Stream] Final URL after redirects: ${response.url}`);

    if (!response.ok) {
      // Try to get error body for more details
      let errorBody = '';
      let userMessage = '';
      
      try {
        errorBody = await response.text();
        console.error(`[Stream] Proxy failed: ${response.status} ${response.statusText}`);
        console.error(`[Stream] Error URL: ${targetUrl.toString()}`);
        console.error(`[Stream] Error body: ${errorBody.substring(0, 500)}`);
      } catch (e) {
        console.error(`[Stream] Could not read error body:`, e);
      }
      
      // Provide user-friendly error messages for common IPTV error codes
      switch (response.status) {
        case 456:
          userMessage = 'Stream unavailable (Error 456). This may indicate:\n' +
                       '- The stream format (MKV) is not supported by the server for web playback\n' +
                       '- Your session has expired (try reconnecting)\n' +
                       '- The stream URL is invalid\n\n' +
                       'For MKV files, please use the Download button to watch in VLC or other media player.';
          break;
        case 403:
          userMessage = 'Access forbidden. Your account may not have permission to access this channel.';
          break;
        case 404:
          userMessage = 'Stream not found. The channel may have been removed or is temporarily unavailable.';
          break;
        case 401:
          userMessage = 'Authentication required. Please reconnect to your portal.';
          break;
        case 458:
          userMessage = 'Stream error (458). The server rejected the request. This might be due to an invalid token or incompatible stream format.';
          break;
        default:
          userMessage = `Stream unavailable (HTTP ${response.status}). Please try another channel.`;
      }
      
      return new NextResponse(userMessage, { status: response.status });
    }

    // Prepare response headers
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Forward content headers
    const contentType = response.headers.get('content-type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    
    const contentLength = response.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    
    const contentRange = response.headers.get('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders.set('Accept-Ranges', acceptRanges);

    // Check if response body exists
    if (!response.body) {
      console.error('[Stream] Response has no body!');
      return new NextResponse('Stream has no content', { status: 500 });
    }

    console.log('[Stream] ✅ Streaming data to client...');

    // Return the stream - IMPORTANT: Don't await or buffer the body
    // Pass the ReadableStream directly to NextResponse
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('[Stream] ❌ Proxy error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      name: error.name,
    });
    
    // Return detailed error for debugging
    return new NextResponse(JSON.stringify({
      error: 'Stream proxy failed',
      message: error.message,
      type: error.name,
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
