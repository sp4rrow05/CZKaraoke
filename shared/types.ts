// Types shared by server and client. Type-only: no runtime code here.

export type PlayerStatus = 'playing' | 'paused' | 'stopped';

export interface Video {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string; // formatted, e.g. "4:05"
}

export interface QueueItem extends Video {
  id: string;
  reservedBy: string; // member id
  reservedByName: string;
}

export interface PublicMember {
  id: string;
  nickname: string;
  isHost: boolean;
  online: boolean;
}

/** Room state as broadcast to clients (no secrets). */
export interface RoomState {
  code: string;
  hostId: string;
  members: PublicMember[];
  queue: QueueItem[];
  current: QueueItem | null;
  status: PlayerStatus;
  /** Bumped whenever the current song (re)starts, so the screen can reload the same video. */
  playId: number;
}

export interface Session {
  code: string;
  memberId: string;
  token: string;
  nickname: string;
}

export type Ack = (res: { ok: true } | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  'queue:add': (video: Video, ack?: Ack) => void;
  'queue:remove': (itemId: string, ack?: Ack) => void;
  'queue:move': (itemId: string, dir: -1 | 1, ack?: Ack) => void;
  'player:play': (ack?: Ack) => void;
  'player:pause': (ack?: Ack) => void;
  'player:stop': (ack?: Ack) => void;
  'player:next': (ack?: Ack) => void;
  /** Sent by the host screen when a video ends or fails to play. */
  'player:ended': (playId: number) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'room:closed': () => void;
}
