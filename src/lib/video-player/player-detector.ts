/**
 * Player Detector Utility
 * Detects stream formats, player capabilities, and browser features
 */

import { StreamFormat } from '@/types/video-player.types';

/**
 * Detect if URL is a Stalker stream
 */
export function isStalkerStream(url: string): boolean {
  return url.includes('play_token=') || url.includes('/play/live.php');
}

/**
 * Detect if URL is an Xtream stream
 */
export function isXtreamStream(url: string): boolean {
  return url.includes('.ts') && !isStalkerStream(url);
}

/**
 * Detect if URL is an M3U8/HLS stream
 */
export function isHlsStream(url: string): boolean {
  return url.includes('.m3u8') || url.includes('m3u8');
}

/**
 * Detect if URL is an MPD/DASH stream
 */
export function isDashStream(url: string): boolean {
  return url.includes('.mpd') || url.includes('mpd');
}

/**
 * Detect if URL is an MPEGTS stream
 */
export function isMpegtsStream(url: string): boolean {
  return url.includes('.ts') || url.includes('mpegts');
}

/**
 * Detect if URL is an MKV file
 */
export function isMkvFile(url: string): boolean {
  return url.toLowerCase().includes('.mkv');
}

/**
 * Detect stream format from URL
 */
export function detectStreamFormat(url: string): StreamFormat {
  if (isHlsStream(url)) return StreamFormat.HLS;
  if (isDashStream(url)) return StreamFormat.DASH;
  if (isMpegtsStream(url)) return StreamFormat.MPEGTS;
  if (isMkvFile(url)) return StreamFormat.MKV;
  return StreamFormat.NATIVE;
}

/**
 * Check if stream should use proxy
 */
export function shouldUseProxy(
  url: string,
  format: StreamFormat,
  useProxyProp?: boolean
): boolean {
  // Explicit proxy request
  if (useProxyProp) return true;
  
  // Already proxied
  if (url.includes('/api/stream') || url.includes('/api/proxy')) return false;
  
  // Stalker always needs proxy
  if (isStalkerStream(url)) return true;
  
  // Xtream usually works directly
  if (isXtreamStream(url)) return false;
  
  // MPEGTS needs proxy for CORS
  if (format === StreamFormat.MPEGTS) return true;
  
  return false;
}

/**
 * Build proxy URL with headers
 */
export function buildProxyUrl(
  url: string,
  userAgent?: string,
  cookies?: string,
  token?: string
): string {
  const encodedUrl = encodeURIComponent(url);
  let proxyUrl = '';

  // Convert to absolute URL for worker compatibility
  if (typeof window !== 'undefined') {
    proxyUrl = `${window.location.origin}/api/stream?url=${encodedUrl}`;
  } else {
    proxyUrl = `/api/stream?url=${encodedUrl}`;
  }

  // Append optional params
  if (userAgent) proxyUrl += `&ua=${encodeURIComponent(userAgent)}`;
  if (cookies) proxyUrl += `&cookie=${encodeURIComponent(cookies)}`;
  if (token) proxyUrl += `&token=${encodeURIComponent(token)}`;

  return proxyUrl;
}

/**
 * Get final playback URL (with or without proxy)
 */
export function getFinalUrl(
  src: string,
  format: StreamFormat,
  useProxy?: boolean,
  userAgent?: string,
  cookies?: string,
  token?: string
): string {
  if (shouldUseProxy(src, format, useProxy)) {
    return buildProxyUrl(src, userAgent, cookies, token);
  }
  return src;
}
