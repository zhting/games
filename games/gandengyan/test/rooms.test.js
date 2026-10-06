'use strict';
const assert = require('node:assert/strict');
// Use in-memory participants; matching tests must not write the player's saved database.
const store = require('../lib/store');
store.save = function () {};
const rooms = require('../lib/rooms');
// Advance only matchmaking intervals; game turn timers stay real and are cleaned up below.
const realNow = Date.now, realSetInterval = global.setInterval, realClearInterval = global.clearInterval;
let clock = realNow();
Date.now = () => clock;
global.setInterval = (tick, ms) => ({ tick, ms, active: true });
global.clearInterval = timer => {
  if (timer && typeof timer.tick === 'function') timer.active = false;
  else realClearInterval(timer);
};
const participants = new Map();
function enter(name, mode) {
  let result;
  const packets = [];
  const user = { name, avatar: 'a1', energy: 1000 };
  const socket = { emit(event, data) { packets.push({ event, data }); } };
  participants.set(name, { user, socket, packets });
  rooms.enterMode(user, socket, mode, res => { result = res; });
  assert.equal(result.ok, true);
  return result.room;
}
try {
  for (const mode of ['practice', 'arena', 'master']) {
    const name = 'test-initial-wait-' + mode;
    const waiting = enter(name, mode);
    assert.equal(waiting.phase, 'waiting', mode + ' must show the waiting screen');
    assert.equal(waiting.countdown, 30000);
    assert.equal(waiting.seats.filter(Boolean).length, 1);
    assert.equal(waiting.seats.length, 5);
    const timer = waiting.waitTimer;
    const { user, socket } = participants.get(name);
    rooms.leaveRoom(user, socket);
    assert.equal(rooms.rooms.has(waiting.id), false);
    assert.equal(timer.active, false, 'empty waiting rooms must stop their countdown');
  }
  let outsideResult;
  rooms.startNow({ name: 'test-outside-room' }, {}, res => { outsideResult = res; });
  assert.equal(outsideResult.ok, false, 'players outside a room cannot start a match');
  for (const mode of ['practice', 'arena', 'master']) {
    const names = ['test-start-now-' + mode + '-host'];
    const immediate = enter(names[0], mode);
    if (mode !== 'practice') {
      names.push('test-start-now-' + mode + '-peer1', 'test-start-now-' + mode + '-peer2');
      names.slice(1).forEach(name => assert.equal(enter(name, mode), immediate));
      // A briefly disconnected seat remains reserved; only vacant seats become bots.
      immediate.seats[0].connected = false;
      immediate.seats[0].socket = null;
    }
    const initiator = participants.get(names[names.length - 1]);
    const originalSeats = immediate.seats.slice();
    const timer = immediate.waitTimer;
    let started;
    rooms.startNow(initiator.user, {}, res => { started = res; });
    assert.equal(started.ok, false, 'an obsolete socket cannot start a room');
    assert.equal(immediate.phase, 'waiting');
    assert.equal(timer.active, true);
    rooms.startNow(initiator.user, initiator.socket, res => { started = res; });
    assert.equal(started.ok, true, 'any connected participant can start immediately');
    assert.equal(started.room, immediate);
    assert.equal(started.seat, names.length - 1);
    assert.equal(immediate.phase, 'playing');
    assert.equal(immediate.roundNo, 1);
    assert.equal(immediate.countdown, 0);
    assert.equal(immediate.waitTimer, null);
    assert.equal(timer.active, false);
    assert.equal(immediate.seats.filter(s => s.isBot).length, 5 - names.length);
    originalSeats.forEach((seat, idx) => {
      if (seat) assert.equal(immediate.seats[idx], seat, 'existing humans keep their seats');
    });
    assert.ok(immediate.seats.every(s => s.hand.length === 5));
    assert.ok(immediate.seats.filter(s => s.isBot).every(s => s.level === rooms.MODES[mode].botLevel));
    assert.equal(immediate.deck.length, 29);
    assert.equal(new Set(immediate.deck.concat(...immediate.seats.map(s => s.hand))).size, 54);
    names.forEach(name => assert.equal(participants.get(name).user.energy, 1000 - rooms.MODES[mode].entry));
    const firstDeck = immediate.deck;
    rooms.startNow(initiator.user, initiator.socket, res => { started = res; });
    assert.equal(started.ok, false, 'repeated starts cannot restart an active game');
    clock += 30001;
    timer.tick();
    assert.equal(immediate.roundNo, 1, 'an expired waiting callback cannot start a second round');
    assert.equal(immediate.deck, firstDeck, 'duplicate requests and timers must not redeal');
    names.forEach(name => assert.equal(participants.get(name).user.energy, 1000 - rooms.MODES[mode].entry, 'entry is charged only once'));
    assert.ok(initiator.packets.some(p => p.event === 'g' && p.data.state.phase === 'playing'));
  }
  const room = enter('test-five-player-practice', 'practice');
  const waitTimer = room.waitTimer;
  clock += 30001; waitTimer.tick();
  assert.equal(waitTimer.active, false);
  assert.equal(room.phase, 'playing', 'waiting timeout must start the game');
  assert.equal(room.seats.length, 5);
  assert.equal(room.seats.filter(s => s.isBot).length, 4);
  assert.ok(room.seats.every(s => s.hand.length === 5));
  assert.equal(room.deck.length, 29);
  assert.equal(new Set(room.deck.concat(...room.seats.map(s => s.hand))).size, 54);
  for (let viewer = 0; viewer < 5; viewer++) {
    const snapshot = rooms.stateFor(room, viewer);
    assert.equal(snapshot.seats.length, 5);
    assert.ok(snapshot.seats.every((s, idx) => idx === viewer ? s.hand.length === 5 : s.hand === undefined));
    assert.ok(snapshot.seats.every((s, idx) => idx === viewer ? s.energy === 1000 : s.energy === undefined));
  }
  room.turn = 4;
  const card = room.seats[4].hand[0];
  assert.equal(rooms.tryPlay(room, 4, [card]).ok, true);
  assert.equal(room.turn, 0, 'fifth seat must rotate back to the first');
  for (let seat = 0; seat < 4; seat++) {
    assert.equal(rooms.tryPass(room, seat).ok, true);
    if (seat < 3) assert.ok(room.pending, 'three passes must not clear a five-player table');
  }
  assert.equal(room.pending, null);
  assert.equal(room.turn, 4, 'after four passes, the last player leads again');
  let matched;
  for (let i = 0; i < 5; i++) {
    const current = enter('test-five-human-' + i, 'arena');
    if (!matched) matched = current;
    assert.equal(current, matched);
    assert.equal(current.phase, i < 4 ? 'waiting' : 'playing');
  }
  assert.equal(matched.seats.filter(s => !s.isBot).length, 5);
  assert.equal(matched.waitTimer, null, 'five humans must cancel the waiting countdown');
  const alreadyPlaying = participants.get('test-five-human-0');
  let rejected;
  rooms.changeTable(alreadyPlaying.user, alreadyPlaying.socket, res => { rejected = res; });
  assert.equal(rejected.ok, false, 'change table must not interrupt an active game');
  assert.equal(rooms.userRoom.get(alreadyPlaying.user.name), matched.id);
  const sixth = enter('test-sixth-human', 'arena');
  assert.notEqual(sixth, matched, 'the sixth player must join another room');
  const old = enter('test-switch-host', 'master');
  assert.equal(enter('test-switch-peer', 'master'), old);
  assert.equal(rooms.stateFor(old, 0).seats[1].energy, 1000, 'waiting podiums show real balances');
  rooms.broadcastRoom(old);
  const peer = participants.get('test-switch-peer');
  const packet = peer.packets.find(p => p.event === 'r').data;
  assert.equal(packet.seat, 1, 'room updates carry the viewer seat');
  assert.equal(packet.seats[0].energy, 1000);
  const host = participants.get('test-switch-host');
  let changed;
  rooms.changeTable(host.user, host.socket, res => { changed = res; });
  assert.equal(changed.ok, true);
  assert.notEqual(changed.room.id, old.id, 'switching must exclude the previous room');
  assert.equal(changed.room.mode, 'master');
  assert.equal(changed.room.phase, 'waiting');
  assert.equal(old.seats[0], null);
  assert.equal(old.seats[1].name, peer.user.name, 'other players remain in the original room');
  rooms.leaveRoom(host.user, host.socket);
  const realSetTimeout = global.setTimeout;
  let expireDisconnect;
  try {
    global.setTimeout = (fn, ms) => {
      assert.equal(ms, 5000);
      expireDisconnect = fn;
      return {};
    };
    rooms.handleDisconnect(old, 1, peer.socket);
    assert.equal(rooms.rooms.has(old.id), true, 'refresh preserves the waiting seat briefly');
    assert.equal(old.seats[1].connected, false);
    let reconnected;
    rooms.enterMode(peer.user, peer.socket, 'master', res => { reconnected = res; });
    assert.equal(reconnected.room, old);
    assert.equal(reconnected.seat, 1);
    expireDisconnect();
    assert.equal(old.seats[1].connected, true, 'a stale disconnect callback cannot remove a reconnected player');
    rooms.handleDisconnect(old, 1, peer.socket);
    expireDisconnect();
    assert.equal(rooms.rooms.has(old.id), false, 'expired last-player disconnect clears the room');
    assert.equal(rooms.userRoom.has(peer.user.name), false);
  } finally { global.setTimeout = realSetTimeout; }
  assert.ok([...rooms.rooms.values()].every(r => r.seats.length === 5));
  console.log('Rooms: all-mode waiting, immediate start/auth/one-time fees, timeout, five-player dealing/privacy, full-room start, change table and exit passed.');
} finally {
  for (const room of rooms.rooms.values()) {
    clearTimeout(room.timer); clearTimeout(room.overTimer); clearInterval(room.waitTimer);
    room.seats.forEach(seat => { if (seat) clearTimeout(seat.disconnectTimer); });
  }
  Date.now = realNow; global.setInterval = realSetInterval; global.clearInterval = realClearInterval;
}
