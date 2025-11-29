/**
 * MKV Handler using Mediabunny
 * Transmuxes MKV files to MP4 for browser playback
 */

import { Input, Output, Mp4OutputFormat, BufferTarget, Conversion, UrlSource, ALL_FORMATS } from 'mediabunny';

/**
 * Check if browser supports WebCodecs API (required for Mediabunny)
 */
export function supportsWebCodecs(): boolean {
  if (typeof window === 'undefined') return false;
  return 'VideoDecoder' in window && 'VideoEncoder' in window;
}

/**
 * Check if URL is an MKV file
 */
export function isMKVFile(url: string): boolean {
  return url.toLowerCase().includes('.mkv');
}

/**
 * Convert MKV to MP4 using Mediabunny
 * @param mkvUrl - URL of the MKV file
 * @param onProgress - Optional progress callback (0-100)
 * @returns Blob URL of the converted MP4
 */
export async function convertMKVToMP4(
  mkvUrl: string,
  onProgress?: (progress: number, message: string) => void
): Promise<string> {
  try {
    // Check browser support first
    if (!supportsWebCodecs()) {
      throw new Error('Browser does not support WebCodecs API. Please use Chrome 94+, Edge 94+, or Safari 16.4+');
    }

    onProgress?.(0, 'Initializing conversion...');

    // Create input from the MKV URL
    const input = new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(mkvUrl)
    });

    // Create output for MP4
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget()
    });

    onProgress?.(5, 'Setting up converter...');

    // Initialize conversion
    const conversion = await Conversion.init({
      input,
      output
    });

    // Check if conversion is valid
    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map(t => t.reason).join(', ');
      throw new Error(`Conversion is not valid. Discarded tracks: ${reasons}`);
    }

    onProgress?.(10, 'Starting conversion...');

    // Set up progress monitoring
    conversion.onProgress = (progress: number) => {
      // Progress is 0-1, convert to 10-90%
      const percentage = 10 + (progress * 80);
      onProgress?.(percentage, `Converting... ${Math.round(progress * 100)}%`);
    };

    // Execute the conversion
    await conversion.execute();

    onProgress?.(95, 'Finalizing...');

    // Get the result buffer
    const buffer = (output.target as BufferTarget).buffer;
    
    if (!buffer) {
      throw new Error('Conversion produced no output');
    }
    
    // Create blob and URL
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    onProgress?.(100, 'Conversion complete!');

    return blobUrl;

  } catch (error: any) {
    console.error('MKV conversion error:', error);
    throw new Error(`Failed to convert MKV: ${error.message}`);
  }
}

/**
 * Estimate file size from URL (if possible)
 */
export async function estimateMKVSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? parseInt(contentLength) : null;
  } catch {
    return null;
  }
}

