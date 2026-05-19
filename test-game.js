#!/usr/bin/env node
// Quick integration test — simulates 3 players going through a full game round.
// Run from project root:  node test-game.js
// Requires backend running on localhost:3000

'use strict';

const { io } = require('./backend/node_modules/socket.io-client');

const BASE     = 'http://localhost:3000';
const ROOM_ID  = 'test-' + Math.random().toString(36).slice(2, 6);
const PLAYERS  = ['ALICE', 'BOB', 'CHARLIE'];

let passed = 0;
let failed = 0;

function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, detail) { console.error(`  ❌ ${label}${detail ? ': ' + detail : ''}`); failed++; }

async function api(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  return { status: r.status, data };
}

function makePlayer(name) {
  return new Promise((resolve) => {
    const socket = io(BASE, { transports: ['websocket'] });
    const state = { name, socket, events: [] };
    ['player_joined', 'new_message', 'phase_updated', 'player_disconnected'].forEach(ev => {
      socket.on(ev, (d) => state.events.push({ ev, d }));
    });
    socket.on('connect', () => resolve(state));
    socket.on('connect_error', (e) => { fail(`${name} socket connect`, e.message); resolve(null); });
  });
}

function waitForEvent(state, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const check = setInterval(() => {
      const found = state.events.find(e => e.ev === eventName);
      if (found) { clearInterval(check); resolve(found.d); }
    }, 50);
    setTimeout(() => { clearInterval(check); reject(new Error(`timeout waiting for ${eventName}`)); }, timeoutMs);
  });
}

function waitForPhase(state, phase, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const check = setInterval(() => {
      const found = state.events.find(e => e.ev === 'phase_updated' && e.d.phase === phase);
      if (found) { clearInterval(check); resolve(found.d); }
    }, 50);
    setTimeout(() => { clearInterval(check); reject(new Error(`timeout waiting for phase_updated:${phase}`)); }, timeoutMs);
  });
}

async function run() {
  console.log(`\n🎮  Reverse Mafia — integration test  (room: ${ROOM_ID})\n`);

  // ── 1. Create room ──────────────────────────────────────────────────────
  console.log('1. Room setup');
  const { status: s1, data: d1 } = await api('POST', '/api/rooms', { roomId: ROOM_ID });
  s1 === 201 ? ok('room created') : fail('room created', `HTTP ${s1}: ${d1.error}`);

  // ── 2. Connect 3 players via socket ─────────────────────────────────────
  console.log('2. Socket connections');
  const [alice, bob, charlie] = await Promise.all(PLAYERS.map(makePlayer));
  if (!alice || !bob || !charlie) { console.error('\nAborted: socket connections failed.'); process.exit(1); }
  ok('all 3 sockets connected');

  // ── 3. Join room ─────────────────────────────────────────────────────────
  console.log('3. Join room');
  [alice, bob, charlie].forEach(p => {
    p.socket.emit('join_room', { roomId: ROOM_ID, playerName: p.name });
  });
  await new Promise(r => setTimeout(r, 300));

  // Each player should have received player_joined events
  const aliceJoined = alice.events.filter(e => e.ev === 'player_joined');
  aliceJoined.length > 0 ? ok(`alice got ${aliceJoined.length} player_joined event(s)`) : fail('alice player_joined');
  const lastJoined = aliceJoined[aliceJoined.length - 1];
  lastJoined?.d?.players?.length === 3 ? ok('room has 3 players') : fail('room player count', JSON.stringify(lastJoined?.d?.players));

  // ── 4. Start game ─────────────────────────────────────────────────────────
  console.log('4. Start game');
  const { status: s4, data: d4 } = await api('POST', '/api/start-game', {
    roomId: ROOM_ID,
    players: PLAYERS,
  });
  s4 === 200 ? ok('start-game accepted') : fail('start-game', `HTTP ${s4}: ${d4.error}`);

  const hasRoles = d4.playerInstructions && Object.keys(d4.playerInstructions).length === 3;
  hasRoles ? ok(`roles assigned (hasAI: ${d4.hasAI})`) : fail('playerInstructions missing');

  // Host emits phase_change → all players get phase_updated { phase: 'playing' }
  alice.socket.emit('phase_change', { roomId: ROOM_ID });
  await new Promise(r => setTimeout(r, 300));

  try {
    await waitForPhase(bob, 'playing');
    ok('bob received phase_updated: playing');
  } catch (e) { fail('phase_updated playing', e.message); }

  // ── 5. Chat messages ──────────────────────────────────────────────────────
  console.log('5. Chat');
  alice.socket.emit('send_message', { text: 'my earliest memory is getting lost at a mall' });
  bob.socket.emit('send_message', { text: 'lol same honestly' });
  charlie.socket.emit('send_message', { text: 'I do not have a memory of that type of event.' });
  await new Promise(r => setTimeout(r, 400));

  const aliceMsgs = alice.events.filter(e => e.ev === 'new_message');
  aliceMsgs.length >= 3 ? ok(`alice received ${aliceMsgs.length} messages`) : fail('alice messages', `got ${aliceMsgs.length}`);

  // ── 6. Role relay (broadcast all roles, each player reads their own) ──────
  console.log('6. Role relay');
  const rolesPayload = {};
  PLAYERS.forEach(pName => {
    rolesPayload[pName] = { role: 'regular', roleText: 'Act naturally.', allPlayers: d4.players };
  });
  alice.socket.emit('send_message', { text: `__ROLES__:${JSON.stringify(rolesPayload)}` });
  await new Promise(r => setTimeout(r, 300));

  const bobRoleMsg = bob.events.find(e => e.ev === 'new_message' && e.d.text?.startsWith('__ROLES__:'));
  bobRoleMsg ? ok('bob received __ROLES__ broadcast') : fail('bob __ROLES__ broadcast not received');

  // ── 7. Voting ─────────────────────────────────────────────────────────────
  console.log('7. Voting');
  const { status: s7, data: d7 } = await api('POST', '/api/start-voting', { roomId: ROOM_ID });
  s7 === 200 ? ok('voting phase started') : fail('start-voting', `HTTP ${s7}: ${d7.error}`);

  // Check all players get phase_updated: voting
  alice.socket.emit('phase_change', { roomId: ROOM_ID });
  await new Promise(r => setTimeout(r, 300));
  try {
    await waitForPhase(charlie, 'voting');
    ok('charlie received phase_updated: voting');
  } catch (e) { fail('phase_updated voting', e.message); }

  // Submit votes
  const votes = [
    { voter: 'ALICE',   votedFor: 'CHARLIE' },
    { voter: 'BOB',     votedFor: 'CHARLIE' },
    { voter: 'CHARLIE', votedFor: 'ALICE'   },
  ];
  for (const v of votes) {
    const { status, data } = await api('POST', '/api/vote', { roomId: ROOM_ID, ...v });
    status === 200 ? ok(`${v.voter} voted for ${v.votedFor} (phase: ${data.phase})`) : fail(`${v.voter} vote`, data.error);
  }

  // ── 8. Reveal ─────────────────────────────────────────────────────────────
  console.log('8. Reveal');
  const { status: s8, data: d8 } = await api('GET', `/api/reveal?roomId=${ROOM_ID}`);
  s8 === 200 ? ok('reveal fetched') : fail('reveal', `HTTP ${s8}: ${d8.error}`);

  if (s8 === 200) {
    ok(`most voted: ${d8.mostVoted}  |  AI present: ${d8.hasAI}  |  AI won: ${d8.aiWon}`);
    console.log('\n     Leaderboard:');
    d8.leaderboard.forEach(({ name, score }) => console.log(`       ${name}: ${score > 0 ? '+' : ''}${score}`));
  }

  // ── 9. Next round ─────────────────────────────────────────────────────────
  console.log('9. Next round');
  const { status: s9, data: d9 } = await api('POST', '/api/next-round', { roomId: ROOM_ID });
  s9 === 200 && d9.phase === 'lobby' ? ok('reset to lobby') : fail('next-round', `HTTP ${s9}: ${d9.error}`);

  // ── Done ───────────────────────────────────────────────────────────────────
  [alice, bob, charlie].forEach(p => p.socket.disconnect());

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  ${passed} passed   ${failed} failed`);
  if (failed === 0) console.log('  All checks passed 🎉');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('\n💥 Unhandled error:', err); process.exit(1); });
