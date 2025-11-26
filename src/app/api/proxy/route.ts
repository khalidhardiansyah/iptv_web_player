import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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
      'Connection': 'close', // Force close connection to avoid keep-alive issues with legacy servers
    };

    // Forward cookies if present
    const cookie = request.headers.get('x-cookie');
    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const authorization = request.headers.get('x-authorization');
    if (authorization) {
      headers['Authorization'] = authorization;
    }



    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout (increased for slow servers)

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store', // Disable caching
        redirect: 'follow',
        signal: controller.signal,
      });

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
        console.error('Request timeout after 15 seconds');
        return NextResponse.json({ 
          error: 'Request timeout',
          details: 'The server took too long to respond (15s timeout)',
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
