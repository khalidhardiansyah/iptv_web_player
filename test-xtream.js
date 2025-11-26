// Test script to check Xtream API responses - cleaner version
const testXtreamAPI = async () => {
  // Parse the M3U URL to extract credentials
  const m3uUrl = 'http://jackofclubs.vip/get.php?username=tdtony40&password=Zomo4mee&type=m3u&output=ts';
  const url = new URL(m3uUrl);
  const username = url.searchParams.get('username');
  const password = url.searchParams.get('password');
  const baseUrl = `${url.protocol}//${url.host}`;

  console.log('='.repeat(60));
  console.log('XTREAM API TEST');
  console.log('='.repeat(60));
  console.log('Base URL:', baseUrl);
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('='.repeat(60));

  // Test 1: Authentication
  console.log('\n[TEST 1] Authentication');
  console.log('-'.repeat(60));
  try {
    const authUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}`;
    console.log('URL:', authUrl);
    
    const authResponse = await fetch(authUrl);
    const authData = await authResponse.json();
    console.log('Status:', authResponse.status);
    console.log('Auth Status:', authData.user_info?.auth === 1 ? 'SUCCESS' : 'FAILED');
    if (authData.user_info) {
      console.log('User:', authData.user_info.username);
      console.log('Status:', authData.user_info.status);
      console.log('Expire:', authData.user_info.exp_date);
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }

  // Test 2: Get Live Categories
  console.log('\n[TEST 2] Live Categories');
  console.log('-'.repeat(60));
  try {
    const categoriesUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_live_categories`;
    console.log('URL:', categoriesUrl);
    
    const categoriesResponse = await fetch(categoriesUrl);
    const categoriesData = await categoriesResponse.json();
    console.log('Status:', categoriesResponse.status);
    console.log('Is Array:', Array.isArray(categoriesData));
    console.log('Count:', Array.isArray(categoriesData) ? categoriesData.length : 'N/A');
    
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
      console.log('\nFirst 5 categories:');
      categoriesData.slice(0, 5).forEach((cat, idx) => {
        console.log(`  ${idx + 1}. [${cat.category_id}] ${cat.category_name}`);
      });
    } else {
      console.log('Response:', JSON.stringify(categoriesData).substring(0, 200));
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }

  // Test 3: Get VOD Categories
  console.log('\n[TEST 3] VOD Categories');
  console.log('-'.repeat(60));
  try {
    const vodCategoriesUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`;
    console.log('URL:', vodCategoriesUrl);
    
    const vodCategoriesResponse = await fetch(vodCategoriesUrl);
    const vodCategoriesData = await vodCategoriesResponse.json();
    console.log('Status:', vodCategoriesResponse.status);
    console.log('Is Array:', Array.isArray(vodCategoriesData));
    console.log('Count:', Array.isArray(vodCategoriesData) ? vodCategoriesData.length : 'N/A');
    
    if (Array.isArray(vodCategoriesData) && vodCategoriesData.length > 0) {
      console.log('\nFirst 5 VOD categories:');
      vodCategoriesData.slice(0, 5).forEach((cat, idx) => {
        console.log(`  ${idx + 1}. [${cat.category_id}] ${cat.category_name}`);
      });
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
};

testXtreamAPI();
