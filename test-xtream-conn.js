const url = 'http://livaocak26.xyz:80/get.php?username=mehmet58&password=58mehmet&type=m3u_plus';

console.log('Testing connection to:', url);

async function testConnection() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    const text = await response.text();
    console.log('Body length:', text.length);
    console.log('First 100 chars:', text.substring(0, 100));
  } catch (error) {
    console.error('Connection failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

testConnection();
