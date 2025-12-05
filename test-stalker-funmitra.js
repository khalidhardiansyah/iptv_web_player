// Test script for Funmitra Stalker portal
const testFunmitraPortal = async () => {
  const baseUrl = 'http://www.funmitra.com:8080';
  const mac = '00:1A:79:73:32:6A';
  
  console.log('='.repeat(60));
  console.log('FUNMITRA PORTAL TEST');
  console.log('='.repeat(60));
  console.log('Portal:', baseUrl);
  console.log('MAC:', mac);
  console.log('='.repeat(60));
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
    'Cookie': `mac=${mac}; stb_lang=en; timezone=Europe/Kiev`,
    'Accept': '*/*',
    'Referer': baseUrl + '/c/',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'close'
  };
  
  // Helper to log response
  const logResponse = async (name, response) => {
    console.log(`\n[${name}] Status:`, response.status);
    try {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        console.log('Response (JSON):', JSON.stringify(data, null, 2).substring(0, 1000) + (JSON.stringify(data).length > 1000 ? '...' : ''));
        return data;
      } catch {
        console.log('Response (Text):', text.substring(0, 500));
        return null;
      }
    } catch (e) {
      console.log('Error reading response:', e.message);
      return null;
    }
  };

  // Helper to test a specific base URL
  const testBaseUrl = async (testUrl, label) => {
    console.log(`\n[TEST] Testing Base URL: ${testUrl} (${label})`);
    console.log('-'.repeat(40));
    
    try {
      const handshakeUrl = `${testUrl}/server/load.php?type=stb&action=handshake&token=&mac=${mac}`;
      console.log('URL:', handshakeUrl);
      const response = await fetch(handshakeUrl, { headers });
      console.log('Status:', response.status);
      
      if (response.ok) {
        const text = await response.text();
        
        // Capture cookies
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
          console.log('🍪 Set-Cookie received:', setCookie);
        }

        try {
          const data = JSON.parse(text);
          console.log('✅ SUCCESS! Found valid endpoint.');
          console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200));
          return { token: data?.js?.token, cookie: setCookie };
        } catch {
          console.log('Response (Text):', text.substring(0, 200));
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
    return null;
  };

  // Try different variations
  const variations = [
    { url: 'http://www.funmitra.com:8080/c', label: 'Standard /c/' },
    { url: 'http://www.funmitra.com:8080', label: 'Root' },
    { url: 'http://www.funmitra.com:8080/portal', label: '/portal' },
    { url: 'http://www.funmitra.com:8080/stalker_portal/c', label: '/stalker_portal/c' }
  ];

  for (const v of variations) {
    const result = await testBaseUrl(v.url, v.label);
    if (result && result.token) {
      const { token, cookie } = result;
      console.log('\n✅ Handshake successful. Proceeding with category tests on this URL...');
      const baseUrl = v.url;
      
      // Update headers with received cookie
      if (cookie) {
        // Simple cookie parsing (taking the first part before ;)
        // In reality, might need to merge with existing cookies
        const newCookie = cookie.split(';')[0];
        headers['Cookie'] = `${headers['Cookie']}; ${newCookie}`;
        console.log('Updated Cookie header:', headers['Cookie']);
      }
      
      // Helper to test auth variations
      const testAuth = async (name, headers, params) => {
        console.log(`\n[TEST] ${name}`);
        const url = `${baseUrl}/server/load.php?type=itv&action=get_genres${params}`;
        console.log('URL:', url);
        try {
          const response = await fetch(url, { headers });
          const text = await response.text();
          if (text.length > 0) {
            console.log('✅ SUCCESS! Response length:', text.length);
            console.log('Response:', text.substring(0, 200));
            return true;
          } else {
            console.log('❌ Empty response');
          }
        } catch (e) {
          console.log('Error:', e.message);
        }
        return false;
      };

      // Variation 1: Standard Bearer + Query Params
      await testAuth('Standard Bearer + Query Params', 
        { ...headers, 'Authorization': `Bearer ${token}` },
        `&mac=${mac}&token=${token}`
      );

      // Variation 2: No Bearer (just token) + Query Params
      await testAuth('No Bearer (just token) + Query Params', 
        { ...headers, 'Authorization': token },
        `&mac=${mac}&token=${token}`
      );

      // Variation 3: Token in Cookie + Query Params
      await testAuth('Token in Cookie + Query Params', 
        { ...headers, 'Cookie': `${headers['Cookie']}; token=${token}` },
        `&mac=${mac}&token=${token}`
      );

      // Variation 4: No Authorization Header (just Query Params)
      await testAuth('No Authorization Header (just Query Params)', 
        headers,
        `&mac=${mac}&token=${token}`
      );
      
      break;
      
      break;
    }
  }
};

testFunmitraPortal();
