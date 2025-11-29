const axios = require('axios');
const http = require('http');
const https = require('https');

const MAC = '00:1A:79:00:28:53';
const BASE_URL_ORIGINAL = 'http://cf.star4k.me/c/';

async function testConnection(baseUrl, label) {
    console.log(`\nTesting ${label}: ${baseUrl}`);
    
    const cookies = [`mac=${encodeURIComponent(MAC)}`, 'stb_lang=en', 'timezone=Europe/Kiev'];
    
    const client = axios.create({
        baseURL: baseUrl,
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
            'X-User-Agent': 'Model: MAG250; Link: WiFi',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cookie': cookies.join('; '),
            'Referer': baseUrl + '/',
        },
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
    });

    try {
        console.log('Sending handshake...');
        const response = await client.get('/server/load.php', {
            params: {
                type: 'stb',
                action: 'handshake',
                token: '',
                mac: MAC,
            },
            validateStatus: () => true // Don't throw on error status
        });

        console.log('Status:', response.status);
        const contentType = response.headers['content-type'];
        console.log('Content-Type:', contentType);
        
        if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
             console.log('Response is HTML (likely Cloudflare or 404):');
             console.log(response.data.substring(0, 200) + '...');
        } else {
             console.log('Data:', JSON.stringify(response.data, null, 2).substring(0, 500));
        }

        if (response.data && response.data.js && response.data.js.token) {
            console.log('SUCCESS: Token received:', response.data.js.token);
            return true;
        } else {
            console.log('FAILURE: No token in response');
            return false;
        }
    } catch (error) {
        console.error('ERROR:', error.message);
        return false;
    }
}

async function testApi(url, headers) {
    console.log(`\nTesting API: ${url}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    try {
        const response = await axios.get(url, {
            params: {
                type: 'stb',
                action: 'handshake',
                token: '',
                mac: MAC,
            },
            timeout: 10000,
            validateStatus: () => true,
            headers: headers
        });
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);
        if (response.data && response.data.js && response.data.js.token) {
            console.log('SUCCESS: Token received:', response.data.js.token);
        } else {
             if (typeof response.data === 'string') {
                 console.log('Data start:', response.data.substring(0, 200));
             } else {
                 console.log('Data:', JSON.stringify(response.data).substring(0, 200));
             }
        }
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

async function testCookieFlow() {
    const baseUrl = 'http://cf.star4k.me/c/';
    console.log(`\nTesting Cookie Flow: ${baseUrl}`);
    
    try {
        // Step 1: Get Portal Page to get Cookies
        console.log('Step 1: Fetching portal page...');
        const response1 = await axios.get(baseUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3'
            }
        });
        
        console.log('Status 1:', response1.status);
        const setCookie = response1.headers['set-cookie'];
        console.log('Set-Cookie:', setCookie);
        
        let cookies = [];
        if (setCookie) {
            cookies = setCookie.map(c => c.split(';')[0]);
        }
        
        // Add standard Stalker cookies
        cookies.push(`mac=${encodeURIComponent(MAC)}`);
        cookies.push('stb_lang=en');
        cookies.push('timezone=Europe/Kiev');
        
        const cookieHeader = cookies.join('; ');
        console.log('Using Cookie Header:', cookieHeader);
        
        // Step 2: Call API
        const apiUrl = 'http://cf.star4k.me/c/server/load.php';
        console.log(`Step 2: Calling API: ${apiUrl}`);
        
        const response2 = await axios.get(apiUrl, {
            params: {
                type: 'stb',
                action: 'handshake',
                token: '',
                mac: MAC,
            },
            timeout: 10000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
                'Referer': baseUrl,
                'Cookie': cookieHeader,
                'X-User-Agent': 'Model: MAG250; Link: WiFi'
            }
        });
        
        console.log('Status 2:', response2.status);
        console.log('Content-Type 2:', response2.headers['content-type']);
        if (response2.data && response2.data.js && response2.data.js.token) {
            console.log('SUCCESS: Token received:', response2.data.js.token);
        } else {
             if (typeof response2.data === 'string') {
                 console.log('Data start:', response2.data.substring(0, 200));
             } else {
                 console.log('Data:', JSON.stringify(response2.data).substring(0, 200));
             }
        }

    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

async function testPath(path) {
    const url = `http://cf.star4k.me/c/${path}`;
    console.log(`\nTesting Path: ${url}`);
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
                'Referer': 'http://cf.star4k.me/c/'
            }
        });
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

async function testMethod(url, method, params) {
    console.log(`\nTesting ${method} ${url}`);
    try {
        const config = {
            method: method,
            url: url,
            timeout: 10000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
                'Referer': 'http://cf.star4k.me/c/',
                'Cookie': `mac=${encodeURIComponent(MAC)}; stb_lang=en; timezone=Europe/Kiev`
            }
        };
        
        if (params) {
            if (method === 'GET') config.params = params;
            else config.data = params; // For POST, usually form-data or json, but Stalker often uses query params even with POST?
            // Actually Stalker usually uses GET. But let's try POST with body.
        }

        const response = await axios(config);
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);
        if (typeof response.data === 'string') {
             console.log('Data start:', response.data.substring(0, 200));
        }
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

async function testPost(url, data, contentType) {
    console.log(`\nTesting POST ${url}`);
    console.log('Data:', data);
    try {
        const response = await axios.post(url, data, {
            timeout: 10000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
                'Referer': 'http://cf.star4k.me/c/',
                'Cookie': `mac=${encodeURIComponent(MAC)}; stb_lang=en; timezone=Europe/Kiev`,
                'Content-Type': contentType
            }
        });
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);
        console.log('Body:', typeof response.data === 'object' ? JSON.stringify(response.data) : response.data);
    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

async function run() {
    const url = 'http://cf.star4k.me/c/server/load.php';
    const params = {
        type: 'stb',
        action: 'handshake',
        token: '',
        mac: MAC,
    };
    const qs = require('querystring');
    
    // Test 1: POST form-urlencoded
    await testPost(url, qs.stringify(params), 'application/x-www-form-urlencoded');
    
    // Test 2: POST JSON
    await testPost(url, params, 'application/json');
}

run();
