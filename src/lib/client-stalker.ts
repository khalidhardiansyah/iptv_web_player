'use client';

interface StalkerConfig {
  baseUrl: string;
  mac: string;
}

export class ClientStalkerClient {
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

  private async makeRequest(params: Record<string, any>) {
    const url = new URL('/server/load.php', this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'X-User-Agent': 'Model: MAG250; Link: WiFi',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      credentials: 'include', // This will send cookies
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
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
    const response = await this.makeRequest({
      type: 'itv',
      action: 'get_ordered_list',
      genre: genreId,
      force_ch_link_check: 0,
      fav: 0,
      sortby: 'number',
      hd: 0,
      p: 1,
    });
    return response?.js?.data || [];
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
}
