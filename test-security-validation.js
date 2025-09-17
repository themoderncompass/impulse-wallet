#!/usr/bin/env node

/**
 * SECURITY TEST: Verify private rooms are actually protected
 * This test focuses specifically on ensuring unauthorized access is prevented
 */

const BASE_URL = 'http://localhost:8788';

const generateUserId = () => crypto.randomUUID();
const generateDisplayName = () => `TestUser${Math.random().toString(36).substring(2, 8)}`;

async function testPrivateRoomSecurity() {
  console.log('🔒 SECURITY TEST: Private Room Protection\n');

  // Step 1: Create a private room
  console.log('1️⃣ Creating private room...');
  const creatorId = generateUserId();
  const creatorName = generateDisplayName();

  const createResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: creatorName,
      userId: creatorId
    })
  });

  const createResult = await createResponse.json();
  console.log(`   Room created: ${createResult.ok ? 'SUCCESS' : 'FAILED'}`);

  if (!createResult.ok) {
    console.log(`   ERROR: ${createResult.error}`);
    return false;
  }

  const roomCode = createResult.room?.code;
  console.log(`   Room code: ${roomCode}`);

  // Get room details to confirm it's private and get invite code
  const manageResponse = await fetch(`${BASE_URL}/impulse-api/room-manage?roomCode=${roomCode}&userId=${creatorId}`);
  const manageResult = await manageResponse.json();

  const isPrivate = manageResult.room?.inviteOnly;
  const inviteCode = manageResult.room?.inviteCode;

  console.log(`   Is private: ${isPrivate ? 'YES' : 'NO'}`);
  console.log(`   Invite code: ${inviteCode}`);

  if (!isPrivate || !inviteCode) {
    console.log('   ❌ SECURITY FAILURE: Room is not private or missing invite code!');
    return false;
  }

  // Step 2: Attempt all possible unauthorized access methods
  console.log('\n2️⃣ Testing unauthorized access methods...');

  const attackerId = generateUserId();
  const attackerName = generateDisplayName();

  // Attack 1: Try to join with just the room code (old method)
  console.log('\n   Attack 1: Direct room code access');
  try {
    const attack1Response = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: roomCode,  // Use actual room code
        displayName: attackerName,
        userId: attackerId
        // No invite code
      })
    });

    const attack1Result = await attack1Response.json();
    console.log(`     Status: ${attack1Response.status}`);
    console.log(`     Success: ${attack1Result.ok ? 'YES (BAD!)' : 'NO (GOOD)'}`);
    console.log(`     Error: ${attack1Result.error || 'None'}`);

    if (attack1Result.ok) {
      console.log('     ❌ SECURITY BREACH: Unauthorized user got into private room!');
      return false;
    }
  } catch (error) {
    console.log(`     Network error: ${error.message}`);
  }

  // Attack 2: Try with INVITE placeholder but no invite code
  console.log('\n   Attack 2: INVITE placeholder with no code');
  try {
    const attack2Response = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'INVITE',
        displayName: attackerName + '2',
        userId: generateUserId()
        // No invite code
      })
    });

    const attack2Result = await attack2Response.json();
    console.log(`     Status: ${attack2Response.status}`);
    console.log(`     Success: ${attack2Result.ok ? 'YES (BAD!)' : 'NO (GOOD)'}`);
    console.log(`     Error: ${attack2Result.error || 'None'}`);

    if (attack2Result.ok) {
      console.log('     ❌ SECURITY BREACH: INVITE placeholder allowed unauthorized access!');
      return false;
    }
  } catch (error) {
    console.log(`     Network error: ${error.message}`);
  }

  // Attack 3: Try with empty invite code
  console.log('\n   Attack 3: Empty invite code');
  try {
    const attack3Response = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'INVITE',
        displayName: attackerName + '3',
        userId: generateUserId(),
        inviteCode: ''  // Empty string
      })
    });

    const attack3Result = await attack3Response.json();
    console.log(`     Status: ${attack3Response.status}`);
    console.log(`     Success: ${attack3Result.ok ? 'YES (BAD!)' : 'NO (GOOD)'}`);
    console.log(`     Error: ${attack3Result.error || 'None'}`);

    if (attack3Result.ok) {
      console.log('     ❌ SECURITY BREACH: Empty invite code allowed access!');
      return false;
    }
  } catch (error) {
    console.log(`     Network error: ${error.message}`);
  }

  // Attack 4: Try with wrong invite code
  console.log('\n   Attack 4: Wrong invite code');
  try {
    const attack4Response = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: 'INVITE',
        displayName: attackerName + '4',
        userId: generateUserId(),
        inviteCode: 'WRONGCD1'  // Wrong code
      })
    });

    const attack4Result = await attack4Response.json();
    console.log(`     Status: ${attack4Response.status}`);
    console.log(`     Success: ${attack4Result.ok ? 'YES (BAD!)' : 'NO (GOOD)'}`);
    console.log(`     Error: ${attack4Result.error || 'None'}`);

    if (attack4Result.ok) {
      console.log('     ❌ SECURITY BREACH: Wrong invite code allowed access!');
      return false;
    }
  } catch (error) {
    console.log(`     Network error: ${error.message}`);
  }

  // Step 3: Verify legitimate access still works
  console.log('\n3️⃣ Testing legitimate access...');
  const legitUserId = generateUserId();
  const legitUserName = generateDisplayName();

  const legitResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: 'INVITE',
      displayName: legitUserName,
      userId: legitUserId,
      inviteCode: inviteCode  // Correct invite code
    })
  });

  const legitResult = await legitResponse.json();
  console.log(`   Legitimate access: ${legitResult.ok ? 'SUCCESS' : 'FAILED'}`);

  if (!legitResult.ok) {
    console.log(`   ERROR: ${legitResult.error}`);
    console.log('   ❌ SECURITY MISCONFIGURATION: Legitimate users cannot access!');
    return false;
  }

  // Step 4: Final verification - check member count
  console.log('\n4️⃣ Final verification...');
  const finalCheckResponse = await fetch(`${BASE_URL}/impulse-api/room-manage?roomCode=${roomCode}&userId=${creatorId}`);
  const finalCheckResult = await finalCheckResponse.json();

  const memberCount = finalCheckResult.memberCount || 0;
  const expectedMembers = 2; // Creator + legitimate user

  console.log(`   Member count: ${memberCount} (expected: ${expectedMembers})`);
  console.log(`   Members: ${finalCheckResult.members?.map(m => m.name).join(', ')}`);

  if (memberCount !== expectedMembers) {
    console.log('   ❌ SECURITY BREACH: Unexpected member count suggests unauthorized access!');
    return false;
  }

  console.log('\n🎉 SECURITY TEST PASSED!');
  console.log('✅ Private rooms are properly protected');
  console.log('✅ All unauthorized access attempts blocked');
  console.log('✅ Legitimate access with invite code works');
  console.log('✅ Member tracking is accurate');

  return true;
}

// Run the security test
if (require.main === module) {
  testPrivateRoomSecurity().then(success => {
    if (success) {
      console.log('\n🔒 SECURITY VALIDATION: PASSED');
      console.log('Private rooms are secure and ready for production.');
    } else {
      console.log('\n💥 SECURITY VALIDATION: FAILED');
      console.log('CRITICAL: Private room security is compromised!');
      process.exit(1);
    }
  }).catch(error => {
    console.error('\n💥 SECURITY TEST ERROR:', error.message);
    process.exit(1);
  });
}

module.exports = { testPrivateRoomSecurity };