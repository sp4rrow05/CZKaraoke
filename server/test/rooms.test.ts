import { describe, expect, it } from 'vitest';
import { RoomError, RoomStore } from '../src/rooms.ts';
import { formatDuration } from '../src/youtube.ts';

const video = (n: number) => ({
  videoId: `vid${String(n).padStart(8, '0')}`,
  title: `Song ${n}`,
  channel: 'Channel',
  thumbnail: '',
  duration: '3:00',
});

function setup() {
  const store = new RoomStore();
  const { room, member: host } = store.create('Host', 'secret');
  const alice = store.join(room.code, 'Alice', 'secret')!.member;
  const bob = store.join(room.code, 'Bob', 'secret')!.member;
  return { store, room, host, alice, bob };
}

describe('rooms', () => {
  it('rejects short passwords and wrong passwords', () => {
    const store = new RoomStore();
    expect(() => store.create('Host', 'abc')).toThrow(RoomError);
    const { room } = store.create('Host', 'secret');
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.passwordHash).not.toContain('secret');
    expect(store.join(room.code, 'X', 'wrong')).toBeNull();
    expect(store.join('NOPE00', 'X', 'secret')).toBeNull();
    expect(store.join(room.code.toLowerCase(), 'X', 'secret')).not.toBeNull();
  });

  it('authenticates members by token', () => {
    const { store, room, alice } = setup();
    expect(store.authenticate(room.code, alice.id, alice.token)?.member).toBe(alice);
    expect(store.authenticate(room.code, alice.id, 'bad-token')).toBeNull();
  });

  it('auto-starts the first reservation and advances through the queue', () => {
    const { store, room, alice, bob } = setup();
    store.addToQueue(room, alice, video(1));
    expect(room.current?.title).toBe('Song 1');
    expect(room.status).toBe('playing');

    store.addToQueue(room, bob, video(2));
    expect(room.queue).toHaveLength(1);

    const playId = room.playId;
    expect(store.ended(room, playId - 1)).toBe(false); // stale report ignored
    expect(store.ended(room, playId)).toBe(true);
    expect(room.current?.title).toBe('Song 2');

    store.ended(room, room.playId);
    expect(room.current).toBeNull();
    expect(room.status).toBe('stopped');
  });

  it('only lets the host or current singer control playback', () => {
    const { store, room, host, alice, bob } = setup();
    store.addToQueue(room, alice, video(1));
    store.addToQueue(room, bob, video(2));

    expect(() => store.pause(room, bob)).toThrow(RoomError);
    expect(() => store.next(room, bob)).toThrow(RoomError);

    store.pause(room, alice);
    expect(room.status).toBe('paused');
    store.play(room, host);
    expect(room.status).toBe('playing');

    const before = room.playId;
    store.stop(room, alice);
    expect(room.status).toBe('stopped');
    store.play(room, alice); // restart from beginning
    expect(room.playId).toBe(before + 1);

    store.next(room, alice);
    expect(room.current?.reservedBy).toBe(bob.id);
    expect(() => store.pause(room, alice)).toThrow(RoomError);
  });

  it('restricts queue removal and reordering', () => {
    const { store, room, host, alice, bob } = setup();
    store.addToQueue(room, alice, video(1)); // becomes current
    const a2 = store.addToQueue(room, alice, video(2));
    const b3 = store.addToQueue(room, bob, video(3));

    expect(() => store.removeFromQueue(room, bob, a2.id)).toThrow(RoomError);
    expect(() => store.moveInQueue(room, alice, b3.id, -1)).toThrow(RoomError);

    store.moveInQueue(room, host, b3.id, -1);
    expect(room.queue.map((q) => q.id)).toEqual([b3.id, a2.id]);

    store.removeFromQueue(room, alice, a2.id);
    store.removeFromQueue(room, host, b3.id);
    expect(room.queue).toHaveLength(0);
  });

  it('rejects invalid videos', () => {
    const { store, room, alice } = setup();
    expect(() => store.addToQueue(room, alice, { ...video(1), videoId: '<script>' })).toThrow(RoomError);
  });

  it('sweeps idle rooms', () => {
    const { store, room } = setup();
    expect(store.sweep(Date.now() + 7 * 60 * 60 * 1000)).toEqual([room.code]);
    expect(store.get(room.code)).toBeUndefined();
  });
});

describe('formatDuration', () => {
  it('formats ISO 8601 durations', () => {
    expect(formatDuration('PT4M5S')).toBe('4:05');
    expect(formatDuration('PT1H2M3S')).toBe('1:02:03');
    expect(formatDuration('PT45S')).toBe('0:45');
  });
});
