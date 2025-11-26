const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseUrl = 'http://185.243.7.101:80/c/';
const mac = '00:1A:79:6F:A3:84';
const apiUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 'server/load.php';

console.log('Testing Portal:', baseUrl);
console.log('MAC:', mac);

async function runTest() {
  try {
    // 1. Handshake
    console.log('\n=== STEP 1: Handshake ===');
    const handshakeUrl = `${apiUrl}?type=stb&action=handshake&token=&mac=${encodeURIComponent(mac)}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Cookie': `mac=${encodeURIComponent(mac)}; stoke=;`
    };

    const handshakeRes = await fetch(handshakeUrl, { headers });
    const handshakeText = await handshakeRes.text();
    console.log('Status:', handshakeRes.status);
    console.log('Response:', handshakeText.substring(0, 200));

    let token = '';
    try {
      const data = JSON.parse(handshakeText);
      token = data.js.token;
      console.log('✓ Token received:', token);
    } catch (e) {
      console.error('✗ Failed to parse handshake JSON');
      return;
    }

    // Update headers with token
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `mac=${encodeURIComponent(mac)}; stoke=${token};`;

    // 2. Get Categories
    console.log('\n=== STEP 2: Get Categories ===');
    const categoriesUrl = `${apiUrl}?type=itv&action=get_genres&token=${token}&mac=${encodeURIComponent(mac)}`;
    const catRes = await fetch(categoriesUrl, { headers });
    const catText = await catRes.text();
    
    let categories = [];
    try {
      const catData = JSON.parse(catText);
      categories = catData.js || [];
      console.log(`✓ Found ${categories.length} categories`);
      console.log('First 3 categories:');
      categories.slice(0, 3).forEach(cat => {
        console.log(`  - ID: ${cat.id}, Title: ${cat.title}`);
      });
    } catch (e) {
      console.error('✗ Failed to parse categories JSON');
      return;
    }

    if (categories.length === 0) {
      console.log('No categories found!');
      return;
    }

    // 3. Get channels from FIRST category
    const firstCategory = categories[0];
    console.log(`\n=== STEP 3: Get Channels from Category "${firstCategory.title}" (ID: ${firstCategory.id}) ===`);
    
    const channelsUrl = `${apiUrl}?type=itv&action=get_ordered_list&genre=${firstCategory.id}&token=${token}&mac=${encodeURIComponent(mac)}`;
    console.log('Request URL:', channelsUrl);
    
    const chanRes = await fetch(channelsUrl, { headers });
    const chanText = await chanRes.text();
    console.log('Response status:', chanRes.status);
    console.log('Response length:', chanText.length);
    
    try {
      const chanData = JSON.parse(chanText);
      const channels = chanData.js?.data || chanData.js || [];
      console.log(`\n✓ Total channels in response: ${channels.length}`);
      
      // Analyze channel structure
      if (channels.length > 0) {
        console.log('\nFirst channel structure:');
        console.log(JSON.stringify(channels[0], null, 2));
        
        console.log('\nAll channels summary:');
        channels.forEach((ch, idx) => {
          console.log(`${idx + 1}. ${ch.name || ch.title || 'NO NAME'} (ID: ${ch.id}, Num: ${ch.num || 'N/A'})`);
        });
      }
      
    } catch (e) {
      console.error('✗ Failed to parse channels JSON');
      console.log('Raw response (first 500 chars):', chanText.substring(0, 500));
    }

  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

runTest();
