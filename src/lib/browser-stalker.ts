'use client';

interface StalkerConfig {
  baseUrl: string;
  mac: string;
}

export class BrowserStalkerClient {
  private baseUrl: string;
  private mac: string;
  private token: string | null = null;
  private cookies: Map<string, string> = new Map();
  private preferredMethod: 'GET' | 'POST' | null = null;

  constructor(config: StalkerConfig) {
    this.baseUrl = config.baseUrl;
    this.mac = config.mac;
    this.cookies.set('mac', config.mac);
    this.cookies.set('stb_lang', 'en');
    this.cookies.set('timezone', 'Europe/Kiev');
    
    // Load preferred method from localStorage
    this.preferredMethod = this.getStoredMethod();
  }

  public getToken(): string | null {
    return this.token;
  }

  public getCookies(): string {
    return this.getCookieString();
  }

  private getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  private getNormalizedBaseUrl(): string {
    let normalized = this.baseUrl;
    // Remove /c/ suffix if present
    if (normalized.endsWith('/c/')) {
      normalized = normalized.slice(0, -3);
    } else if (normalized.endsWith('/c')) {
      normalized = normalized.slice(0, -2);
    }
    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  private getStorageKey(): string {
    return `stalker_method_${this.getNormalizedBaseUrl()}`;
  }

  private getStoredMethod(): 'GET' | 'POST' | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(this.getStorageKey());
    if (stored === 'GET' || stored === 'POST') {
      console.log(`Using saved method preference: ${stored}`);
      return stored;
    }
    return null;
  }

  private savePreferredMethod(method: 'GET' | 'POST'): void {
    if (typeof window === 'undefined') return;
    this.preferredMethod = method;
    localStorage.setItem(this.getStorageKey(), method);
    console.log(`Saved method preference: ${method}`);
  }

  private isValidResponse(response: any): boolean {
    // Check if response has expected Stalker structure
    return response && 
           typeof response === 'object' &&
           (response.js !== undefined || 
            response.token !== undefined ||
            (response.hasOwnProperty('js') && response.js !== null));
  }

  private async makeRequest(params: Record<string, any>, method?: 'GET' | 'POST', isRetry = false, signal?: AbortSignal): Promise<any> {
    // Determine which method to use
    let requestMethod: 'GET' | 'POST';
    
    if (method) {
      // Explicit method specified
      requestMethod = method;
    } else if (this.preferredMethod) {
      // Use saved preference
      requestMethod = this.preferredMethod;
      console.log(`Using preferred method: ${requestMethod}`);
    } else {
      // No preference yet, default to GET
      requestMethod = 'GET';
      console.log('No method preference found, trying GET first');
    }

    const url = new URL('/api/proxy', window.location.origin);
    
    // Add target URL
    // Handle portal URLs that end with /c/
    let baseUrl = this.baseUrl;
    if (baseUrl.endsWith('/c/')) {
      baseUrl = baseUrl.slice(0, -3); // Remove /c/
    } else if (baseUrl.endsWith('/c')) {
      baseUrl = baseUrl.slice(0, -2); // Remove /c
    }

    // Ensure baseUrl doesn't end with slash for consistent path joining
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    const targetUrl = new URL(`${baseUrl}/server/load.php`);
    
    if (requestMethod === 'GET') {
      // For GET, append params to targetUrl
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      
      // Construct the full target URL with params
      const separator = targetUrl.toString().includes('?') ? '&' : '?';
      const fullTargetUrl = `${targetUrl.toString()}${separator}${searchParams.toString()}`;
      
      url.searchParams.set('url', fullTargetUrl);
    } else {
      // For POST, we send the base URL to proxy, and params in body
      url.searchParams.set('url', targetUrl.toString());
    }

    const headers: HeadersInit = {
      'x-user-agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'x-cookie': this.getCookieString(),
    };

    if (this.token) {
      headers['x-authorization'] = `Bearer ${this.token}`;
    }

    const fetchOptions: RequestInit = {
      method: requestMethod,
      headers,
      signal,
    };

    if (requestMethod === 'POST') {
      // Create form data string
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      fetchOptions.body = searchParams.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);

      if (!response.ok) {
        // If request failed and we haven't retried yet, try the other method
        if (!isRetry) {
          const alternateMethod = requestMethod === 'GET' ? 'POST' : 'GET';
          console.log(`${requestMethod} request failed (${response.status}), retrying with ${alternateMethod}...`);
          return this.makeRequest(params, alternateMethod, true, signal);
        }

        let errorMessage = `HTTP error! status: ${response.status}`;
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `${errorMessage} - ${errorData.error}`;
          }
          if (errorData.details) {
            errorMessage = `${errorMessage}: ${errorData.details}`;
          }
          console.error('API Error:', errorData);
        } catch {
          // Response is not JSON, use status text
          errorMessage = `${errorMessage} - ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      // Update cookies from response
      const setCookie = response.headers.get('x-set-cookie');
      if (setCookie) {
        const cookies = setCookie.split(',');
        cookies.forEach(cookie => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          if (name && value) {
            this.cookies.set(name.trim(), value.trim());
          }
        });
      }

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        
        // If this is a valid response and we don't have a saved preference yet, save it
        if (this.isValidResponse(data) && !this.preferredMethod) {
          console.log(`${requestMethod} method successful, saving preference`);
          this.savePreferredMethod(requestMethod);
        }
        
        return data;
      } catch {
        // If we got text but expected JSON, and it's a GET request, maybe try POST?
        if (requestMethod === 'GET' && !isRetry && text.includes('<!DOCTYPE html>')) {
           console.log('Received HTML response for GET, retrying with POST...');
           return this.makeRequest(params, 'POST', true, signal);
        }
        return text;
      }
    } catch (error) {
      // Network error or other fetch error
      if (!isRetry) {
        const alternateMethod = requestMethod === 'GET' ? 'POST' : 'GET';
        console.log(`Request failed with ${requestMethod}, retrying with ${alternateMethod}...`, error);
        return this.makeRequest(params, alternateMethod, true, signal);
      }
      throw error;
    }
  }

  async handshake() {
    try {
      const response = await this.makeRequest({
        type: 'stb',
        action: 'handshake',
        token: '',
        mac: this.mac,
      });

      if (response?.js?.token) {
        this.token = response.js.token;
      }

      await this.getProfile();
      return this.token;
    } catch (error) {
      console.error('Handshake failed:', error);
      throw error;
    }
  }

  async getProfile() {
    const response = await this.makeRequest({
      type: 'stb',
      action: 'get_profile',
      hd: 1,
      ver: 'ImageDescription: 0.2.18-r14-250; ImageDate: Fri Jan 15 15:20:44 EET 2016; PORTAL version: 5.1.0; API Version: JS',
      num_banks: 2,
      sn: '0000000000000',
      stb_type: 'MAG250',
      client_type: 'STB',
      image_version: '218',
      video_out: 'hdmi',
      device_id: '0000000000000',
      device_id2: '0000000000000',
      signature: '',
      auth_second_step: 0,
      hw_version: '1.7-BD-00',
      not_valid_token: 0,
      metrics: JSON.stringify({ mac: this.mac, sn: '0000000000000', model: 'MAG250', type: 'STB', uid: '' })
    });
    return response;
  }

  async getCategories() {
    const response = await this.makeRequest({
      type: 'itv',
      action: 'get_genres',
    });
    return response?.js || [];
  }

  async getChannels(genreId: string, firstPageOnly = false, signal?: AbortSignal, maxChannels = 500) {
    let allChannels: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await this.makeRequest({
        type: 'itv',
        action: 'get_ordered_list',
        genre: genreId,
        force_ch_link_check: 0,
        fav: 0,
        sortby: 'number',
        hd: 0,
        p: currentPage,
      }, 'GET', false, signal);

      const channels = response?.js?.data || [];
      const totalItems = response?.js?.total_items || 0;
      const maxPageItems = response?.js?.max_page_items || 14;

      if (channels.length > 0) {
        allChannels = allChannels.concat(channels);
      }

      // Check if there are more pages
      // Stop if: firstPageOnly, reached total items, no more channels, or reached max limit
      if (firstPageOnly || 
          allChannels.length >= totalItems || 
          channels.length === 0 ||
          allChannels.length >= maxChannels) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    // Trim to max if exceeded
    if (allChannels.length > maxChannels) {
      allChannels = allChannels.slice(0, maxChannels);
    }

    return allChannels;
  }

  async getAllChannels() {
    const response = await this.makeRequest({
      type: 'itv',
      action: 'get_all_channels',
    });
    return response?.js?.data || response?.js || [];
  }

  async getLink(cmd: string) {
    const response = await this.makeRequest({
      type: 'itv',
      action: 'create_link',
      cmd: cmd,
      series: 0,
      forced_storage: 0,
      disable_ad: 0,
      download: 0,
      force_ch_link_check: 0,
    });

    return response?.js?.cmd || null;
  }

  // VOD (Movies) methods
  async getVODCategories() {
    const response = await this.makeRequest({
      type: 'vod',
      action: 'get_categories',
    });
    return response?.js || [];
  }

  async getVODItems(categoryId: string, firstPageOnly = false, signal?: AbortSignal, maxItems = 500) {
    let allItems: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await this.makeRequest({
        type: 'vod',
        action: 'get_ordered_list',
        category: categoryId,
        p: currentPage,
        sortby: 'added',
      }, 'GET', false, signal);

      const items = response?.js?.data || [];
      const totalItems = response?.js?.total_items || 0;

      if (items.length > 0) {
        allItems = allItems.concat(items);
      }

      if (firstPageOnly || 
          allItems.length >= totalItems || 
          items.length === 0 ||
          allItems.length >= maxItems) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    if (allItems.length > maxItems) {
      allItems = allItems.slice(0, maxItems);
    }

    return allItems;
  }

  async getVODLink(cmd: string) {
    const response = await this.makeRequest({
      type: 'vod',
      action: 'create_link',
      cmd: cmd,
      forced_storage: 0,
      disable_ad: 0,
      download: 0,
    });
    return response?.js?.cmd || null;
  }

  // Series (TV Shows) methods
  async getSeriesCategories() {
    const response = await this.makeRequest({
      type: 'series',
      action: 'get_categories',
    });
    return response?.js || [];
  }

  async getSeriesItems(categoryId: string, firstPageOnly = false, signal?: AbortSignal, maxItems = 500) {
    let allItems: any[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await this.makeRequest({
        type: 'series',
        action: 'get_ordered_list',
        category: categoryId,
        p: currentPage,
        sortby: 'added',
      }, 'GET', false, signal);

      const items = response?.js?.data || [];
      const totalItems = response?.js?.total_items || 0;

      if (items.length > 0) {
        allItems = allItems.concat(items);
      }

      if (firstPageOnly || 
          allItems.length >= totalItems || 
          items.length === 0 ||
          allItems.length >= maxItems) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    if (allItems.length > maxItems) {
      allItems = allItems.slice(0, maxItems);
    }

    return allItems;
  }

  async getSeriesSeasons(seriesId: string) {
    const response = await this.makeRequest({
      type: 'series',
      action: 'get_ordered_list',
      movie_id: seriesId,
      season_id: 0,
    });
    return response?.js?.data || [];
  }

  async getSeriesEpisodes(seriesId: string, seasonId: string) {
    const response = await this.makeRequest({
      type: 'series',
      action: 'get_ordered_list',
      movie_id: seriesId,
      season_id: seasonId,
    });
    return response?.js?.data || [];
  }

  async getSeriesLink(cmd: string, seriesId: string) {
    const response = await this.makeRequest({
      type: 'series',
      action: 'create_link',
      cmd: cmd,
      series: seriesId,
      forced_storage: 0,
      disable_ad: 0,
    });
    return response?.js?.cmd || null;
  }

  async getEpg(channelId: string, period: number = 7) {
    try {
      console.log(`Stalker: Fetching EPG for channel ${channelId}, period: ${period} days`);
      const response = await this.makeRequest({
        type: 'itv',
        action: 'get_epg_info',
        period: period,
        ch_id: channelId
      });

      const epgData = response?.js || [];
      console.log(`Stalker: Received ${Array.isArray(epgData) ? epgData.length : 0} EPG entries`);
      return epgData;
    } catch (error: any) {
      console.error('Stalker: Failed to fetch EPG', error);
      // Don't throw, return empty array if EPG fails
      return [];
    }
  }
}
