#!/usr/bin/env node

/**
 * Test script for invite code functionality
 * Tests room creation, invite-only setting, and access control
 */

const BASE_URL = 'http://localhost:8788';

// Generate random test data
const generateUserId = () => crypto.randomUUID();
const generateRoomCode = () => Math.random().toString(36).substring(2, 7).toUpperCase();

async function testInviteCodeFunctionality() {
  console.log('🧪 Testing Invite Code Functionality\n');

  // Test data
  const creatorId = generateUserId();
  const memberWhoShouldJoin = generateUserId();
  const memberWhoShouldNotJoin = generateUserId();
  const roomCode = generateRoomCode();

  console.log(`📋 Test Setup:`);
  console.log(`  Room Code: ${roomCode}`);
  console.log(`  Creator ID: ${creatorId.substring(0, 8)}...`);
  console.log(`  Valid Member ID: ${memberWhoShouldJoin.substring(0, 8)}...`);
  console.log(`  Invalid Member ID: ${memberWhoShouldNotJoin.substring(0, 8)}...\n`);

  try {
    // Step 1: Creator creates room
    console.log('1️⃣ Creator creates room...');
    const createResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        displayName: 'TestCreator',
        userId: creatorId
      })
    });

    const createResult = await createResponse.json();
    console.log(`   ✅ Room created: ${createResult.ok ? 'SUCCESS' : 'FAILED'}`);

    if (!createResult.ok) {
      console.log(`   ❌ Error: ${createResult.error}`);
      return;
    }

    // Step 2: Get room management info to see initial state
    console.log('\n2️⃣ Getting initial room state...');
    const manageResponse = await fetch(`${BASE_URL}/impulse-api/room-manage?roomCode=${roomCode}&userId=${creatorId}`);
    const manageResult = await manageResponse.json();

    console.log(`   Initial invite-only: ${manageResult.room?.inviteOnly}`);
    console.log(`   Initial invite code: ${manageResult.room?.inviteCode || 'NONE'}`);

    // Step 3: Set room to invite-only
    console.log('\n3️⃣ Setting room to invite-only...');
    const updateResponse = await fetch(`${BASE_URL}/impulse-api/room-manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        userId: creatorId,
        inviteOnly: true
      })
    });

    const updateResult = await updateResponse.json();
    console.log(`   ✅ Update result: ${updateResult.ok ? 'SUCCESS' : 'FAILED'}`);

    if (!updateResult.ok) {
      console.log(`   ❌ Error: ${updateResult.error}`);
      return;
    }

    const inviteCode = updateResult.room?.inviteCode;
    console.log(`   🔐 Generated invite code: ${inviteCode}`);

    if (!inviteCode) {
      console.log(`   ❌ FAILED: No invite code generated!`);
      return;
    }

    // Step 4: Try to join WITHOUT invite code (should fail)
    console.log('\n4️⃣ Testing join WITHOUT invite code (should fail)...');
    const joinWithoutCodeResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        displayName: 'UnauthorizedUser',
        userId: memberWhoShouldNotJoin
        // No inviteCode provided
      })
    });

    const joinWithoutCodeResult = await joinWithoutCodeResponse.json();
    const shouldFailTest = !joinWithoutCodeResult.ok && joinWithoutCodeResult.error_code === 'ROOM_INVITE_ONLY';
    console.log(`   ${shouldFailTest ? '✅' : '❌'} Correctly blocked: ${shouldFailTest ? 'YES' : 'NO'}`);
    console.log(`   Response: ${joinWithoutCodeResult.error || 'UNEXPECTED SUCCESS'}`);

    // Step 5: Try to join WITH wrong invite code (should fail)
    console.log('\n5️⃣ Testing join with WRONG invite code (should fail)...');
    const joinWrongCodeResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        displayName: 'UnauthorizedUser2',
        userId: memberWhoShouldNotJoin,
        inviteCode: 'WRONGCODE'
      })
    });

    const joinWrongCodeResult = await joinWrongCodeResponse.json();
    const shouldFailTest2 = !joinWrongCodeResult.ok && joinWrongCodeResult.error_code === 'ROOM_INVITE_ONLY';
    console.log(`   ${shouldFailTest2 ? '✅' : '❌'} Correctly blocked: ${shouldFailTest2 ? 'YES' : 'NO'}`);
    console.log(`   Response: ${joinWrongCodeResult.error || 'UNEXPECTED SUCCESS'}`);

    // Step 6: Try to join WITH correct invite code (should succeed)
    console.log('\n6️⃣ Testing join with CORRECT invite code (should succeed)...');
    const joinWithCodeResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        displayName: 'AuthorizedUser',
        userId: memberWhoShouldJoin,
        inviteCode: inviteCode
      })
    });

    const joinWithCodeResult = await joinWithCodeResponse.json();
    console.log(`   ${joinWithCodeResult.ok ? '✅' : '❌'} Join successful: ${joinWithCodeResult.ok ? 'YES' : 'NO'}`);
    if (!joinWithCodeResult.ok) {
      console.log(`   Response: ${joinWithCodeResult.error}`);
    }

    // Step 7: Verify the member is actually in the room
    if (joinWithCodeResult.ok) {
      console.log('\n7️⃣ Verifying member was added to room...');
      const verifyResponse = await fetch(`${BASE_URL}/impulse-api/room-manage?roomCode=${roomCode}&userId=${creatorId}`);
      const verifyResult = await verifyResponse.json();

      const memberCount = verifyResult.memberCount || 0;
      const expectedMembers = 2; // Creator + new member
      console.log(`   Member count: ${memberCount} (expected: ${expectedMembers})`);
      console.log(`   ${memberCount === expectedMembers ? '✅' : '❌'} Correct member count: ${memberCount === expectedMembers ? 'YES' : 'NO'}`);
    }

    // Step 8: Test that room creator can always join
    console.log('\n8️⃣ Testing that room creator can always rejoin...');
    const creatorRejoinResponse = await fetch(`${BASE_URL}/impulse-api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode,
        displayName: 'CreatorRejoin',
        userId: creatorId
        // Creator shouldn't need invite code
      })
    });

    const creatorRejoinResult = await creatorRejoinResponse.json();
    console.log(`   ${creatorRejoinResult.ok ? '✅' : '❌'} Creator can rejoin: ${creatorRejoinResult.ok ? 'YES' : 'NO'}`);

    console.log('\n🎯 TEST SUMMARY:');
    console.log('   ✅ Invite codes should be generated when room set to invite-only');
    console.log('   ✅ Users without invite codes should be blocked');
    console.log('   ✅ Users with wrong invite codes should be blocked');
    console.log('   ✅ Users with correct invite codes should be allowed');
    console.log('   ✅ Room creators should always be able to join');
    console.log('   ✅ Members should be properly tracked');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testInviteCodeFunctionality().catch(console.error);
}

module.exports = { testInviteCodeFunctionality };