import * as Y from 'yjs';
import YPartyKitProvider from 'y-partykit/provider';
import WebSocket from 'ws';

const doc = new Y.Doc({ guid: 'f47c1038-94fa-44cb-bd30-ef9d88fb54f7' });
const provider = new YPartyKitProvider(
  '127.0.0.1:1999',
  'f47c1038-94fa-44cb-bd30-ef9d88fb54f7',
  doc,
  { WebSocketPolyfill: WebSocket }
);

provider.on('status', (e) => console.log('STATUS EVENT:', JSON.stringify(e)));
provider.on('sync', (isSynced) => console.log('SYNC EVENT:', isSynced));
provider.on('connection-error', (e) => console.log('CONNECTION ERROR EVENT:', e));
provider.on('connection-close', (e) => console.log('CONNECTION CLOSE EVENT:', e && e.reason));

setTimeout(() => {
  console.log('--- after 3s ---');
  console.log('wsconnected:', provider.wsconnected);
  console.log('wsconnecting:', provider.wsconnecting);
  console.log('synced:', provider.synced);
  console.log('ws readyState:', provider.ws ? provider.ws.readyState : null);
  process.exit(0);
}, 3000);
