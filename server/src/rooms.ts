import type { PlayerStatus, QueueItem, RoomState, Video } from '../../shared/types.ts';
import {
  generateId,
  generateRoomCode,
  generateToken,
  hashPassword,
  safeEqual,
  verifyPassword,
} from './security.ts';

export interface Member {
  id: string;
  nickname: string;
  token: string;
  isHost: boolean;
  connections: number;
}

export interface Room {
  code: string;
  passwordHash: string;
  hostId: string;
  members: Map<string, Member>;
  queue: QueueItem[];
  current: QueueItem | null;
  status: PlayerStatus;
  playId: number;
  lastActivity: number;
}

export class RoomError extends Error {}

export const MIN_PASSWORD_LENGTH = 4;
const MAX_QUEUE = 100;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

function cleanNickname(nickname: unknown): string {
  const name = typeof nickname === 'string' ? nickname.trim().slice(0, 24) : '';
  if (!name) throw new RoomError('Please enter a nickname.');
  return name;
}

function cleanVideo(video: Video): Video {
  if (!video || typeof video.videoId !== 'string' || !/^[\w-]{11}$/.test(video.videoId)) {
    throw new RoomError('Invalid video.');
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    videoId: video.videoId,
    title: str(video.title, 200) || 'Untitled',
    channel: str(video.channel, 100),
    thumbnail: str(video.thumbnail, 300),
    duration: str(video.duration, 12),
  };
}

export class RoomStore {
  private rooms = new Map<string, Room>();

  create(nickname: unknown, password: unknown): { room: Room; member: Member } {
    const name = cleanNickname(nickname);
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new RoomError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    let code: string;
    do code = generateRoomCode();
    while (this.rooms.has(code));

    const member = this.newMember(name, true);
    const room: Room = {
      code,
      passwordHash: hashPassword(password),
      hostId: member.id,
      members: new Map([[member.id, member]]),
      queue: [],
      current: null,
      status: 'stopped',
      playId: 0,
      lastActivity: Date.now(),
    };
    this.rooms.set(code, room);
    return { room, member };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** Returns null when the room doesn't exist or the password is wrong. */
  join(code: unknown, nickname: unknown, password: unknown): { room: Room; member: Member } | null {
    const name = cleanNickname(nickname);
    const room = typeof code === 'string' ? this.get(code) : undefined;
    if (!room || typeof password !== 'string' || !verifyPassword(password, room.passwordHash)) {
      return null;
    }
    const member = this.newMember(name, false);
    room.members.set(member.id, member);
    this.touch(room);
    return { room, member };
  }

  authenticate(code: unknown, memberId: unknown, token: unknown): { room: Room; member: Member } | null {
    if (typeof code !== 'string' || typeof memberId !== 'string' || typeof token !== 'string') return null;
    const room = this.get(code);
    const member = room?.members.get(memberId);
    if (!room || !member || !safeEqual(member.token, token)) return null;
    return { room, member };
  }

  // --- permissions ---

  canControl(room: Room, member: Member): boolean {
    return member.isHost || (room.current !== null && room.current.reservedBy === member.id);
  }

  private requireControl(room: Room, member: Member) {
    if (!this.canControl(room, member)) {
      throw new RoomError('Only the host or the singer of the current song can do that.');
    }
  }

  // --- queue ---

  addToQueue(room: Room, member: Member, video: Video): QueueItem {
    if (room.queue.length >= MAX_QUEUE) throw new RoomError('The queue is full.');
    const item: QueueItem = {
      ...cleanVideo(video),
      id: generateId(),
      reservedBy: member.id,
      reservedByName: member.nickname,
    };
    room.queue.push(item);
    // Nothing on stage: start right away.
    if (!room.current) this.advance(room);
    this.touch(room);
    return item;
  }

  removeFromQueue(room: Room, member: Member, itemId: string): void {
    const index = room.queue.findIndex((q) => q.id === itemId);
    if (index === -1) throw new RoomError('That song is no longer in the queue.');
    if (!member.isHost && room.queue[index].reservedBy !== member.id) {
      throw new RoomError('You can only remove your own songs.');
    }
    room.queue.splice(index, 1);
    this.touch(room);
  }

  moveInQueue(room: Room, member: Member, itemId: string, dir: -1 | 1): void {
    if (!member.isHost) throw new RoomError('Only the host can reorder the queue.');
    const index = room.queue.findIndex((q) => q.id === itemId);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= room.queue.length) return;
    [room.queue[index], room.queue[target]] = [room.queue[target], room.queue[index]];
    this.touch(room);
  }

  // --- player ---

  play(room: Room, member: Member): void {
    this.requireControl(room, member);
    if (!room.current) {
      this.advance(room);
    } else if (room.status === 'stopped') {
      room.playId++; // restart from the beginning
      room.status = 'playing';
    } else {
      room.status = 'playing';
    }
    this.touch(room);
  }

  pause(room: Room, member: Member): void {
    this.requireControl(room, member);
    if (room.current && room.status === 'playing') room.status = 'paused';
    this.touch(room);
  }

  stop(room: Room, member: Member): void {
    this.requireControl(room, member);
    if (room.current) room.status = 'stopped';
    this.touch(room);
  }

  next(room: Room, member: Member): void {
    this.requireControl(room, member);
    this.advance(room);
    this.touch(room);
  }

  /** The host screen reports the video with this playId finished (or failed). */
  ended(room: Room, playId: number): boolean {
    if (playId !== room.playId || !room.current) return false; // stale report
    this.advance(room);
    this.touch(room);
    return true;
  }

  private advance(room: Room): void {
    room.current = room.queue.shift() ?? null;
    room.status = room.current ? 'playing' : 'stopped';
    room.playId++;
  }

  // --- presence & lifecycle ---

  connect(room: Room, member: Member): void {
    member.connections++;
    this.touch(room);
  }

  disconnect(room: Room, member: Member): void {
    member.connections = Math.max(0, member.connections - 1);
  }

  /** Removes rooms idle for longer than the TTL. Returns the removed codes. */
  sweep(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      if (now - room.lastActivity > ROOM_TTL_MS) {
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }

  toState(room: Room): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      members: [...room.members.values()].map((m) => ({
        id: m.id,
        nickname: m.nickname,
        isHost: m.isHost,
        online: m.connections > 0,
      })),
      queue: room.queue,
      current: room.current,
      status: room.status,
      playId: room.playId,
    };
  }

  private newMember(nickname: string, isHost: boolean): Member {
    return { id: generateId(), nickname, token: generateToken(), isHost, connections: 0 };
  }

  private touch(room: Room) {
    room.lastActivity = Date.now();
  }
}
