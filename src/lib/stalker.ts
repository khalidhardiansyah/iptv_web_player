import axios, { AxiosInstance } from 'axios';
import http from 'http';
import https from 'https';

export interface StalkerConfig {
  baseUrl: string;
  mac: string;
  timezone?: string;
}

export class StalkerClient {
  private client: AxiosInstance;
  private token: string | null = null;
  private mac: string;
  private cookies: string[] = [];

  constructor(config: StalkerConfig) {
    this.mac = config.mac;
    this.cookies = [`mac=${encodeURIComponent(config.mac)}`, 'stb_lang=en', 'timezone=Europe/Kiev'];
    
    const httpAgent = new http.Agent({ 
      keepAlive: true,
      timeout: 30000
    });
    const httpsAgent = new https.Agent({ 
      keepAlive: true, 
      rejectUnauthorized: false,
      timeout: 30000
    });

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      httpAgent,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'X-User-Agent': 'Model: MAG250; Link: WiFi',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive'
      },
    });

    // Add interceptor to save cookies
    this.client.interceptors.response.use((response) => {
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        if (Array.isArray(setCookie)) {
            setCookie.forEach(c => this.updateCookie(c));
        } else {
            this.updateCookie(setCookie);
        }
      }
      return response;
    });

    // Add interceptor to attach cookies
    this.client.interceptors.request.use((config) => {
      config.headers['Cookie'] = this.cookies.join('; ');
      config.headers['Referer'] = this.client.defaults.baseURL + '/c/';
      if (this.token) {
        config.headers['Authorization'] = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  private updateCookie(cookieStr: string) {
    const cookieName = cookieStr.split('=')[0].trim();
    const cookieValue = cookieStr.split(';')[0].trim(); // Get name=value part
    
    // Remove existing cookie with same name
    this.cookies = this.cookies.filter(c => !c.trim().startsWith(cookieName + '='));
    // Add new cookie
    this.cookies.push(cookieValue);
  }

  async handshake() {
    try {
      // First try to get a token via handshake
      const response = await this.client.get('/server/load.php', {
        params: {
          type: 'stb',
          action: 'handshake',
          token: '',
          mac: this.mac,
        },
      });

      if (response.data?.js?.token) {
        this.token = response.data.js.token;
      }
      
      // Some portals require a profile request to fully activate the session
      await this.getProfile();
      
      return this.token;
    } catch (error) {
      console.error('Handshake failed:', error);
      throw error;
    }
  }

  async getProfile() {
    const response = await this.client.get('/server/load.php', {
      params: {
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
        metrics: JSON.stringify({mac: this.mac, sn: '0000000000000', model: 'MAG250', type: 'STB', uid: ''})
      },
    });
    return response.data;
  }

  async getCategories() {
    const response = await this.client.get('/server/load.php', {
      params: {
        type: 'itv',
        action: 'get_genres',
      },
    });
    return response.data?.js || [];
  }

  async getChannels(genreId: string) {
    const response = await this.client.get('/server/load.php', {
      params: {
        type: 'itv',
        action: 'get_ordered_list',
        genre: genreId,
        force_ch_link_check: 0,
        fav: 0,
        sortby: 'number',
        hd: 0,
        p: 1, // Page 1
      },
    });
    return response.data?.js?.data || [];
  }

  async getLink(cmd: string) {
    // cmd usually looks like "ffrt http://..." or just the ID
    // We need to call create_link
    const response = await this.client.get('/server/load.php', {
      params: {
        type: 'itv',
        action: 'create_link',
        cmd: cmd,
        series: 0,
        forced_storage: 0,
        disable_ad: 0,
        download: 0,
        force_ch_link_check: 0,
      },
    });
    
    return response.data?.js?.cmd || null;
  }
}
