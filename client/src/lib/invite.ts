/**
 * The room's join link for QR codes and sharing. The invite key lets people join with just a
 * name. It sits after "#", so browsers never send it to a server in a request.
 */
export const inviteUrl = (code: string, inviteToken: string) =>
  `${window.location.origin}/room/${code}#invite=${inviteToken}`;
