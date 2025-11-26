const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseUrl = 'http://185.243.7.101:80/c/';
const mac = '00:1A:79:6F:A3:84';
const apiUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 'server/load.php';

async function runTest() {
  try {
    // 1. Handshake
    console.log('=== Handshake ===');
    const handshakeUrl = `${apiUrl}?type=stb&action=handshake&token=&mac=${encodeURIComponent(mac)}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Cookie': `mac=${encodeURIComponent(mac)}; stoke=;`
    };

    const handshakeRes = await fetch(handshakeUrl, { headers });
    const handshakeData = await handshakeRes.json();
    const token = handshakeData.js.token;
    console.log('✓ Token:', token);

    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `mac=${encodeURIComponent(mac)}; stoke=${token};`;

    // 2. Get categories to find "Indonesia" or similar
    console.log('\n=== Get Categories ===');
    const categoriesUrl = `${apiUrl}?type=itv&action=get_genres&token=${token}&mac=${encodeURIComponent(mac)}`;
    const catRes = await fetch(categoriesUrl, { headers });
    const catData = await catRes.json();
    const categories = catData.js || [];
    
    console.log(`Found ${categories.length} categories`);
    const indonesiaCategory = categories.find(cat => 
      cat.title?.toLowerCase().includes('indonesia') || 
      cat.title?.toLowerCase().includes('indo')
    );
    
    if (indonesiaCategory) {
      console.log(`\n✓ Found category: "${indonesiaCategory.title}" (ID: ${indonesiaCategory.id})`);
      
      // 3. Test with different page numbers
      console.log('\n=== Testing Pagination ===');
      
      for (let page = 1; page <= 3; page++) {
        console.log(`\n--- Page ${page} ---`);
        const channelsUrl = `${apiUrl}?type=itv&action=get_ordered_list&genre=${indonesiaCategory.id}&token=${token}&mac=${encodeURIComponent(mac)}&p=${page}`;
        
        const chanRes = await fetch(channelsUrl, { headers });
        const chanData = await chanRes.json();
        const channels = chanData.js?.data || chanData.js || [];
        
        console.log(`Channels returned: ${channels.length}`);
        console.log(`Total in response: ${chanData.js?.total_items || 'N/A'}`);
        console.log(`Max page: ${chanData.js?.max_page_items || 'N/A'}`);
        
        if (channels.length > 0) {
          console.log('First 3 channels:');
          channels.slice(0, 3).forEach((ch, idx) => {
            console.log(`  ${idx + 1}. ${ch.name} (ID: ${ch.id})`);
          });
        }
        
        if (channels.length === 0) {
          console.log('No more channels, stopping pagination test');
          break;
        }
      }
    } else {
      console.log('\n✗ Indonesia category not found');
      console.log('Available categories:');
      categories.slice(0, 10).forEach(cat => {
        console.log(`  - ${cat.title} (ID: ${cat.id})`);
      });
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTest();
