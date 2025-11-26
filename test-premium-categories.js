const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const baseUrl = 'http://mag.premiumpowers.net:80/c/';
const mac = '00:1A:79:C3:F2:99';
const apiUrl = baseUrl + (baseUrl.endsWith('/') ? '' : '/') + 'server/load.php';

console.log('Testing Stalker Portal:', baseUrl);
console.log('MAC:', mac);
console.log('API URL:', apiUrl);

async function runTest() {
  try {
    // 1. Handshake
    console.log('\n1. Performing Handshake...');
    const handshakeUrl = `${apiUrl}?type=stb&action=handshake&token=&mac=${encodeURIComponent(mac)}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Cookie': `mac=${encodeURIComponent(mac)}; stoke=;`
    };

    const handshakeRes = await fetch(handshakeUrl, { headers });
    const handshakeText = await handshakeRes.text();
    console.log('Handshake Status:', handshakeRes.status);
    console.log('Handshake Response:', handshakeText);

    let token = '';
    try {
      const data = JSON.parse(handshakeText);
      token = data.js.token;
      console.log('Token received:', token);
    } catch (e) {
      console.error('Failed to parse handshake JSON:', e);
      return;
    }

    if (!token) {
      console.error('No token received');
      return;
    }

    // 2. Get Categories (Genres)
    console.log('\n2. Fetching Categories (get_genres)...');
    const categoriesUrl = `${apiUrl}?type=itv&action=get_genres&token=${token}&mac=${encodeURIComponent(mac)}`;
    headers['Authorization'] = `Bearer ${token}`;
    headers['Cookie'] = `mac=${encodeURIComponent(mac)}; stoke=${token};`;

    const catRes = await fetch(categoriesUrl, { headers });
    const catText = await catRes.text();
    console.log('Categories Status:', catRes.status);
    console.log('Categories Response (first 500 chars):', catText.substring(0, 500));

    // 3. Try alternative action (get_all_channels) just in case
    console.log('\n3. Fetching All Channels (get_all_channels) to see if that works...');
    const channelsUrl = `${apiUrl}?type=itv&action=get_all_channels&token=${token}&mac=${encodeURIComponent(mac)}`;
    const chanRes = await fetch(channelsUrl, { headers });
    const chanText = await chanRes.text();
    console.log('Channels Status:', chanRes.status);
    console.log('Channels Response (first 500 chars):', chanText.substring(0, 500));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
