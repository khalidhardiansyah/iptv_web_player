// Test script for Stalker portal - check what responses we get
const testStalkerPortal = async () => {
  const baseUrl = 'http://breakfa5t.club';
  const mac = '00:1a:79:aa:e0:3f';
  
  console.log('='.repeat(60));
  console.log('STALKER PORTAL TEST');
  console.log('='.repeat(60));
  console.log('Portal:', baseUrl);
  console.log('MAC:', mac);
  console.log('='.repeat(60));
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
    'Cookie': `mac=${mac}; stb_lang=en; timezone=Europe/Kiev`
  };
  
  // Test 1: Handshake
  console.log('\n[TEST 1] Handshake');
  console.log('-'.repeat(60));
  try {
    const handshakeUrl = `${baseUrl}/server/load.php?type=stb&action=handshake&token=&mac=${mac}`;
    console.log('URL:', handshakeUrl);
    
    const response = await fetch(handshakeUrl, { headers });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data?.js?.token) {
      console.log('✅ Token received:', data.js.token);
      headers['Authorization'] = `Bearer ${data.js.token}`;
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }
  
  // Test 2: Get Genres (Live TV Categories)
  console.log('\n[TEST 2] Get Genres (Live TV Categories)');
  console.log('-'.repeat(60));
  try {
    const genresUrl = `${baseUrl}/server/load.php?type=itv&action=get_genres`;
    console.log('URL:', genresUrl);
    
    const response = await fetch(genresUrl, { headers });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data?.js) {
      console.log('Categories count:', Array.isArray(data.js) ? data.js.length : 'Not an array');
      if (Array.isArray(data.js) && data.js.length > 0) {
        console.log('First category:', data.js[0]);
      }
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }
  
  // Test 3: Get All Channels
  console.log('\n[TEST 3] Get All Channels');
  console.log('-'.repeat(60));
  try {
    const channelsUrl = `${baseUrl}/server/load.php?type=itv&action=get_all_channels`;
    console.log('URL:', channelsUrl);
    
    const response = await fetch(channelsUrl, { headers });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response keys:', Object.keys(data));
    
    if (data?.js?.data) {
      console.log('Channels count:', data.js.data.length);
      if (data.js.data.length > 0) {
        console.log('First channel:', data.js.data[0]);
      }
    } else if (data?.js) {
      console.log('JS response:', Array.isArray(data.js) ? `Array with ${data.js.length} items` : typeof data.js);
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }
  
  // Test 4: Try GET method for genres
  console.log('\n[TEST 4] Get Genres with GET method');
  console.log('-'.repeat(60));
  try {
    const genresUrl = `${baseUrl}/server/load.php?type=itv&action=get_genres`;
    console.log('URL:', genresUrl);
    console.log('Method: GET');
    
    const response = await fetch(genresUrl, { 
      method: 'GET',
      headers 
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('ERROR:', error.message);
  }
  
  // Test 5: Try POST method for genres
  console.log('\n[TEST 5] Get Genres with POST method');
  console.log('-'.repeat(60));
  try {
    const genresUrl = `${baseUrl}/server/load.php`;
    console.log('URL:', genresUrl);
    console.log('Method: POST');
    
    const params = new URLSearchParams();
    params.append('type', 'itv');
    params.append('action', 'get_genres');
    
    const response = await fetch(genresUrl, { 
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('ERROR:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
};

testStalkerPortal();
