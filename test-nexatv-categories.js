// Test nexatv.be categories
const testCategories = async () => {
  const baseUrl = 'http://new.nexatv.be/stalker_portal/c/';
  const mac = '00:1A:79:00:00:09';
  
  console.log('Testing nexatv.be categories...\n');
  
  // Step 1: Handshake
  const handshakeUrl = `${baseUrl}server/load.php?type=stb&action=handshake&token=&mac=${encodeURIComponent(mac)}`;
  const handshakeResponse = await fetch(handshakeUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
    },
  });
  
  const handshakeData = await handshakeResponse.json();
  const token = handshakeData.js?.token;
  console.log('Token:', token);
  
  if (!token) {
    console.error('No token!');
    return;
  }
  
  // Step 2: Get genres
  const genresUrl = `${baseUrl}server/load.php?type=itv&action=get_genres&mac=${encodeURIComponent(mac)}&token=${token}`;
  console.log('\nGenres URL:', genresUrl);
  
  const genresResponse = await fetch(genresUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
      'Cookie': `mac=${encodeURIComponent(mac)}; stb_lang=en; timezone=UTC`,
    },
  });
  
  console.log('Genres Status:', genresResponse.status);
  
  const genresData = await genresResponse.json();
  console.log('\nGenres Response:', JSON.stringify(genresData, null, 2));
  
  if (genresData.js && Array.isArray(genresData.js)) {
    console.log('\n✅ Number of categories:', genresData.js.length);
    if (genresData.js.length > 0) {
      console.log('First 3 categories:');
      genresData.js.slice(0, 3).forEach((cat, i) => {
        console.log(`${i + 1}.`, cat);
      });
    } else {
      console.log('⚠️ No categories returned!');
    }
  } else {
    console.log('❌ Invalid response format');
  }
};

testCategories();
