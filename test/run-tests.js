#!/usr/bin/env node

// Automated API testing script for Impulse Wallet
// This script will test all API endpoints locally

const BASE_URL = 'http://localhost:8788'; // Default wrangler dev port

async function testEndpoint(method, path, body = null, expectedStatus = 200) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json().catch(() => ({}));
    
    const status = response.status === expectedStatus ? '✅' : '❌';
    console.log(`${status} ${method} ${path} - ${response.status} (expected ${expectedStatus})`);
    
    if (response.status !== expectedStatus) {
      console.log(`   Response:`, data);
    }
    
    return { success: response.status === expectedStatus, data };
  } catch (error) {
    console.log(`❌ ${method} ${path} - ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Starting API Tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test health endpoint
  console.log('--- Health Check ---');
  const health = await testEndpoint('GET', '/impulse-api/health');
  health.success ? passed++ : failed++;
  
  // Test user endpoints
  console.log('\n--- User Endpoints ---');
  
  // Test missing userId
  const userNoId = await testEndpoint('GET', '/impulse-api/user', null, 400);
  userNoId.success ? passed++ : failed++;
  
  // Test user creation
  const testUser = {
    userId: 'test-user-' + Date.now(),
    email: 'test@example.com',
    displayName: 'Test User'
  };
  
  const createUser = await testEndpoint('POST', '/impulse-api/user', testUser, 200); // Changed to 200 - UPSERT behavior
  createUser.success ? passed++ : failed++;
  
  // Test user retrieval
  const getUser = await testEndpoint('GET', `/impulse-api/user?userId=${testUser.userId}`);
  getUser.success ? passed++ : failed++;
  
  // Test user update (should return 200, not 201)
  const updateUser = await testEndpoint('POST', '/impulse-api/user', {
    ...testUser,
    displayName: 'Updated Test User'
  }, 200);
  updateUser.success ? passed++ : failed++;

  // Test events endpoint
  console.log('\n--- Events Endpoint ---');
  const eventsTest = await testEndpoint('GET', '/impulse-api/events?limit=10');
  eventsTest.success ? passed++ : failed++;
  
  // Test room suggestions endpoint
  console.log('\n--- Room Features ---');
  const suggestionsTest = await testEndpoint('GET', '/impulse-api/room-suggestions?baseName=TEST&count=3');
  suggestionsTest.success ? passed++ : failed++;
  
  // Test room validation with invalid codes
  const shortRoomTest = await testEndpoint('POST', '/impulse-api/room', { roomCode: 'AB' }, 400);
  shortRoomTest.success ? passed++ : failed++;
  
  const reservedRoomTest = await testEndpoint('POST', '/impulse-api/room', { roomCode: 'ADMIN' }, 400);
  reservedRoomTest.success ? passed++ : failed++;
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running
async function checkServer() {
  try {
    await fetch(`${BASE_URL}/impulse-api/health`);
    return true;
  } catch {
    console.log('❌ Local dev server not running. Start with: npm run dev');
    return false;
  }
}

// Main
async function main() {
  if (await checkServer()) {
    await runTests();
  } else {
    process.exit(1);
  }
}

main();