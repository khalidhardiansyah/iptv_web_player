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

    // 2. Try get_all_channels
    console.log('\n=== Testing get_all_channels ===');
    const allChannelsUrl = `${apiUrl}?type=itv&action=get_all_channels&token=${token}&mac=${encodeURIComponent(mac)}`;
    const allChanRes = await fetch(allChannelsUrl, { headers });
    const allChanText = await allChanRes.text();
    
    try {
      const allChanData = JSON.parse(allChanText);
      const allChannels = allChanData.js?.data || allChanData.js || [];
      console.log(`✓ get_all_channels returned ${allChannels.length} channels`);
      
      if (allChannels.length > 0) {
        console.log('\nFirst 5 channels:');
        allChannels.slice(0, 5).forEach((ch, idx) => {
          console.log(`${idx + 1}. ${ch.name} (ID: ${ch.id})`);
        });
      }
    } catch (e) {
      console.log('✗ get_all_channels failed or returned non-JSON');
      console.log('Response:', allChanText.substring(0, 200));
    }

    // 3. Get first category channels for comparison
    console.log('\n=== Testing get_ordered_list (category *) ===');
    const catChannelsUrl = `${apiUrl}?type=itv&action=get_ordered_list&genre=*&token=${token}&mac=${encodeURIComponent(mac)}`;
    const catChanRes = await fetch(catChannelsUrl, { headers });
    const catChanData = await catChanRes.json();
    const catChannels = catChanData.js?.data || catChanData.js || [];
    console.log(`✓ get_ordered_list (genre=*) returned ${catChannels.length} channels`);

    // 4. Compare
    console.log('\n=== Comparison ===');
    console.log(`get_all_channels: ${allChannels?.length || 0} channels`);
    console.log(`get_ordered_list (genre=*): ${catChannels.length} channels`);

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

runTest();
