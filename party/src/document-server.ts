import type * as Party from 'partykit/server';
import { onConnect } from 'y-partykit';

// One room per writer session (room id = WriterSession.id). y-partykit
// handles the Yjs websocket sync protocol and persists the document state
// in the room's own PartyKit storage — no separate Postgres column needed
// for the live document; Postgres only stores named "Simpan Versi" snapshots.
export default class DocumentServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    return onConnect(conn, this.room, {
      persist: { mode: 'snapshot' },
    });
  }
}

DocumentServer satisfies Party.Worker;
