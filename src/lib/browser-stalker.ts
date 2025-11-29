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

  constructor(config: StalkerConfig) {
    this.baseUrl = config.baseUrl;
    this.mac = config.mac;
    this.cookies.set('mac', config.mac);
    this.cookies.set('stb_lang', 'en');
    this.cookies.set('timezone', 'Europe/Kiev');
  }

  private getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  private async makeRequest(params: Record<string, any>, method: 'GET' | 'POST' = 'GET', isRetry = false, signal?: AbortSignal): Promise<any> {
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
    
    // For GET requests, append params to URL
    // For POST requests, we'll send them in body but we also need to append them to targetUrl 
    // because the proxy needs to know where to send the request, and Stalker often expects params in URL even for POST
    // BUT for this specific case (Star4k), we want to avoid params in URL if possible or at least send them in body
    
    // Let's stick to appending to URL for targetUrl construction for the proxy's sake
    // The proxy will strip them if we move them to body? No, the proxy forwards query params.
    
    // If we are doing POST, we should probably NOT put params in the URL if the goal is to hide them or if the server blocks them.
    // However, the proxy takes 'url' param. 
    
    if (method === 'GET') {
      // For GET, append params to targetUrl
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      
      // Construct the full target URL with params
      // We use string concatenation to avoid double encoding issues with URL object
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
      method: method,
      headers,
      signal, // Add abort signal support
    };

    if (method === 'POST') {
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
        // If GET failed and we haven't retried yet, try POST
        if (method === 'GET' && !isRetry) {
          console.log('GET request failed, retrying with POST...');
          return this.makeRequest(params, 'POST', true);
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
        return data;
      } catch {
        // If we got text but expected JSON, and it's a GET request, maybe try POST?
        // Some servers return HTML error pages with 200 OK (like Cloudflare sometimes)
        if (method === 'GET' && !isRetry && text.includes('<!DOCTYPE html>')) {
           console.log('Received HTML response for GET, retrying with POST...');
           return this.makeRequest(params, 'POST', true);
        }
        return text;
      }
    } catch (error) {
      // Network error or other fetch error
      if (method === 'GET' && !isRetry) {
        console.log('Request failed, retrying with POST...', error);
        return this.makeRequest(params, 'POST', true);
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

  async getChannels(genreId: string, firstPageOnly = false, signal?: AbortSignal) {
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
      // If firstPageOnly is true, stop after first page
      if (firstPageOnly || allChannels.length >= totalItems || channels.length === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
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

  async getVODItems(categoryId: string, firstPageOnly = false, signal?: AbortSignal) {
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

      if (firstPageOnly || allItems.length >= totalItems || items.length === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
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

  async getSeriesItems(categoryId: string, firstPageOnly = false, signal?: AbortSignal) {
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

      if (firstPageOnly || allItems.length >= totalItems || items.length === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
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
}
