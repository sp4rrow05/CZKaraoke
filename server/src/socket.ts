import type { Server, Socket } from 'socket.io';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '../../shared/types.ts';
import { RoomError, type Member, type Room, type RoomStore } from './rooms.ts';

interface SocketData {
  code: string;
  memberId: string;
}

type IO = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function registerSocketHandlers(io: IO, store: RoomStore) {
  const broadcast = (room: Room) => io.to(room.code).emit('room:state', store.toState(room));

  // Only members holding a valid token get a socket.
  io.use((socket, next) => {
    const { code, memberId, token } = socket.handshake.auth ?? {};
    const auth = store.authenticate(code, memberId, token);
    if (!auth) {
      console.log(`[socket] rejected connection for room ${code} (unknown room or bad token)`);
      return next(new Error('unauthorized'));
    }
    socket.data = { code: auth.room.code, memberId: auth.member.id };
    next();
  });

  io.on('connection', (socket: ClientSocket) => {
    const context = (): { room: Room; member: Member } => {
      const room = store.get(socket.data.code);
      const member = room?.members.get(socket.data.memberId);
      if (!room || !member) throw new RoomError('This room no longer exists.');
      return { room, member };
    };

    // Runs an action, broadcasts the new state, and reports errors through the ack.
    const handle =
      <A extends unknown[]>(action: (room: Room, member: Member, ...args: A) => void) =>
      (...args: [...A, Ack?]) => {
        const last = args[args.length - 1];
        const ack = typeof last === 'function' ? (last as Ack) : undefined;
        const params = (ack ? args.slice(0, -1) : args) as unknown as A;
        try {
          const { room, member } = context();
          action(room, member, ...params);
          broadcast(room);
          ack?.({ ok: true });
        } catch (err) {
          const error = err instanceof RoomError ? err.message : 'Something went wrong.';
          if (!(err instanceof RoomError)) console.error(err);
          ack?.({ ok: false, error });
        }
      };

    const { room, member } = context();
    const log = (msg: string) => console.log(`[${room.code}] ${member.nickname}: ${msg}`);
    log(`connected via ${socket.conn.transport.name}`);
    socket.conn.once('upgrade', () => log(`upgraded to ${socket.conn.transport.name}`));
    socket.join(room.code);
    store.connect(room, member);
    broadcast(room);

    socket.on(
      'queue:add',
      handle((r, m, video) => {
        const item = store.addToQueue(r, m, video);
        log(`reserved "${item.title}"`);
      }),
    );
    socket.on('queue:remove', handle((r, m, itemId: string) => store.removeFromQueue(r, m, itemId)));
    socket.on('queue:move', handle((r, m, itemId: string, dir: -1 | 1) => store.moveInQueue(r, m, itemId, dir)));
    socket.on(
      'queue:playNow',
      handle((r, m, itemId: string) => {
        const item = store.playNow(r, m, itemId);
        log(`started "${item.title}" now`);
      }),
    );
    socket.on(
      'queue:playNext',
      handle((r, m, itemId: string) => {
        const item = store.playNext(r, m, itemId);
        log(`moved "${item.title}" to play next`);
      }),
    );
    socket.on('player:play', handle((r, m) => store.play(r, m)));
    socket.on('player:pause', handle((r, m) => store.pause(r, m)));
    socket.on('player:stop', handle((r, m) => store.stop(r, m)));
    socket.on('player:next', handle((r, m) => store.next(r, m)));

    socket.on('player:ended', (playId) => {
      const r = store.get(socket.data.code);
      const m = r?.members.get(socket.data.memberId);
      if (r && m && store.isScreen(r, m) && store.ended(r, playId)) broadcast(r);
    });

    socket.on(
      'room:setScreen',
      handle((r, m, targetId: string) => {
        const target = store.setScreen(r, m, targetId);
        log(`made ${target.nickname} the screen`);
      }),
    );

    socket.on(
      'room:resetInvite',
      handle((r, m) => {
        store.resetInvite(r, m);
        log('made a new QR code');
      }),
    );

    socket.on('room:close', (ack?: Ack) => {
      try {
        const { room: r, member: m } = context();
        store.close(r, m);
        log('closed the room');
        ack?.({ ok: true });
        io.to(r.code).emit('room:closed', 'host');
        io.in(r.code).disconnectSockets(true);
      } catch (err) {
        ack?.({ ok: false, error: err instanceof RoomError ? err.message : 'Something went wrong.' });
      }
    });

    socket.on('disconnect', (reason) => {
      log(`disconnected (${reason})`);
      const r = store.get(socket.data.code);
      const m = r?.members.get(socket.data.memberId);
      if (!r || !m) return;
      store.disconnect(r, m);
      broadcast(r);
    });
  });

  // Close idle rooms.
  setInterval(() => {
    for (const code of store.sweep()) {
      io.to(code).emit('room:closed', 'idle');
      io.in(code).disconnectSockets(true);
    }
  }, 10 * 60 * 1000).unref();
}
