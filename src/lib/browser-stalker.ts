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

  private async makeRequest(params: Record<string, any>) {
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
    Object.entries(params).forEach(([key, value]) => {
      targetUrl.searchParams.append(key, String(value));
    });
    
    url.searchParams.set('url', targetUrl.toString());

    const headers: HeadersInit = {
      'x-user-agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'x-cookie': this.getCookieString(),
    };

    if (this.token) {
      headers['x-authorization'] = `Bearer ${this.token}`;
    }

    console.log('Stalker API request:', {
      action: params.type + '/' + params.action,
      targetUrl: targetUrl.toString(),
      hasToken: !!this.token,
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
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
      console.log('API Response:', {
        action: params.type + '/' + params.action,
        success: true,
        dataKeys: Object.keys(data),
      });
      return data;
    } catch {
      console.log('API Response (text):', text.substring(0, 100));
      return text;
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

  async getChannels(genreId: string) {
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
      });

      const channels = response?.js?.data || [];
      const totalItems = response?.js?.total_items || 0;
      const maxPageItems = response?.js?.max_page_items || 14;

      if (channels.length > 0) {
        allChannels = allChannels.concat(channels);
        console.log(`Fetched page ${currentPage}: ${channels.length} channels (total so far: ${allChannels.length}/${totalItems})`);
      }

      // Check if there are more pages
      if (allChannels.length >= totalItems || channels.length === 0) {
        hasMorePages = false;
      } else {
        currentPage++;
      }
    }

    console.log(`Total channels fetched for genre ${genreId}: ${allChannels.length}`);
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

  async getVODItems(categoryId: string) {
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
      });

      const items = response?.js?.data || [];
      const totalItems = response?.js?.total_items || 0;

      if (items.length > 0) {
        allItems = allItems.concat(items);
        console.log(`Fetched VOD page ${currentPage}: ${items.length} items (total: ${allItems.length}/${totalItems})`);
      }

      if (allItems.length >= totalItems || items.length === 0) {
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

  async getSeriesItems(categoryId: string) {
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
      });

      const items = response?.js?.data || [];
      const totalItems = response?.js?.total_items || 0;

      if (items.length > 0) {
        allItems = allItems.concat(items);
        console.log(`Fetched Series page ${currentPage}: ${items.length} items (total: ${allItems.length}/${totalItems})`);
      }

      if (allItems.length >= totalItems || items.length === 0) {
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
