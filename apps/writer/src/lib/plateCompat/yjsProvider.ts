/**
 * Adapts the existing y-partykit provider (still created/cached exactly as
 * before in PlateEditor.tsx — same room id, same Y.Doc, same PartyKit host)
 * to Plate's `UnifiedProvider` interface so @platejs/yjs can drive it.
 *
 * Only the wire format on top of that Y.Doc changes (Plate binds through
 * @slate-yjs/core instead of y-prosemirror) — the transport, the room, and
 * the reconnect/backoff behavior of y-partykit itself are untouched.
 */
import type YPartyKitProvider from "y-partykit/provider";

export class PartyKitUnifiedProvider {
  readonly type = "partykit";

  constructor(private provider: YPartyKitProvider) {}

  get awareness() {
    return this.provider.awareness;
  }

  get document() {
    return this.provider.doc;
  }

  get isConnected(): boolean {
    return !!(this.provider as any).wsconnected;
  }

  get isSynced(): boolean {
    return !!(this.provider as any).synced;
  }

  connect = () => this.provider.connect();
  disconnect = () => this.provider.disconnect();
  destroy = () => {
    // The room's doc/provider lifecycle is owned by acquireCollaborationRoom
    // in PlateEditor.tsx (ref-counted across StrictMode remounts) — this
    // adapter must not destroy the shared provider itself.
  };
}
