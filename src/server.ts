import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, type Config } from './config/index.js';
import { PlaywrightPool } from './streaming/playwright-pool.js';
import { StreamingSession } from './streaming/session.js';
import type { WsClientMessage, WsServerMessage } from './types/ws-messages.js';

const MAX_SESSIONS = Number(process.env.STREAMING_MAX_SESSIONS ?? '1');
const PORT = Number(process.env.PORT ?? '8080');

let config: Config;
let pool: PlaywrightPool;
let activeSessions = 0;
const activeClosePromises = new Set<Promise<void>>();

function sendJson(ws: WebSocket, msg: WsServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function handleConnection(ws: WebSocket): Promise<void> {
  if (activeSessions >= MAX_SESSIONS) {
    sendJson(ws, {
      type: 'error',
      message: `同時セッション数の上限(${MAX_SESSIONS})に達しています`,
    });
    ws.close();
    return;
  }

  let session: StreamingSession | null = null;
  let ending = false;

  ws.on('message', async (data, isBinary) => {
    // バイナリ = PCM audio chunk
    if (isBinary) {
      if (session) {
        const buf = Buffer.isBuffer(data)
          ? data
          : Buffer.from(data as ArrayBuffer);
        session.feedAudio(buf);
      }
      return;
    }

    // テキスト = JSON メッセージ
    let msg: WsClientMessage;
    try {
      msg = JSON.parse(data.toString()) as WsClientMessage;
    } catch {
      sendJson(ws, { type: 'error', message: '不正なメッセージ形式です' });
      return;
    }

    if (msg.type === 'session_start') {
      if (session) {
        sendJson(ws, { type: 'error', message: 'セッションは既に開始されています' });
        return;
      }

      activeSessions++;
      session = new StreamingSession(config, { playwrightPool: pool });

      const closePromise = new Promise<void>((resolve) => {
        session!.on('close', () => {
          activeSessions--;
          session = null;
          ending = false;
          resolve();
        });
      });
      activeClosePromises.add(closePromise);
      closePromise.then(() => activeClosePromises.delete(closePromise));

      session.on('transcript_partial', (text) =>
        sendJson(ws, { type: 'transcript_partial', text }),
      );
      session.on('transcript_final', (text) =>
        sendJson(ws, { type: 'transcript_final', text }),
      );
      session.on('graphic_update', (png) =>
        sendJson(ws, { type: 'graphic_update', png }),
      );
      session.on('graphic_final', (png) =>
        sendJson(ws, { type: 'graphic_final', png }),
      );
      session.on('status', (message) =>
        sendJson(ws, { type: 'status', message }),
      );
      session.on('error', (err) =>
        sendJson(ws, { type: 'error', message: err.message }),
      );

      try {
        await session.start();
      } catch (err) {
        sendJson(ws, {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
        activeSessions--;
        session = null;
      }
    } else if (msg.type === 'session_end') {
      if (!session || ending) {
        sendJson(ws, { type: 'error', message: 'セッションが開始されていません' });
        return;
      }
      ending = true;
      await session.end();
    }
  });

  ws.on('close', async () => {
    if (session && !ending) {
      ending = true;
      try {
        await session.end();
      } catch {
        // セッション終了エラーは無視
      }
    }
  });
}

async function main(): Promise<void> {
  config = loadConfig();
  pool = new PlaywrightPool();
  await pool.init();

  const app = express();

  // 静的ファイル配信
  app.use(express.static(resolve(process.cwd(), 'public')));

  // ヘルスチェック
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', activeSessions });
  });

  const server = createServer(app);

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    handleConnection(ws).catch((err) => {
      console.error('WebSocket handler error:', err);
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    wss.close();
    server.close();
    // 既存セッションの終了を待つ
    await Promise.all([...activeClosePromises]);
    await pool.destroy();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(PORT, () => {
    console.log(`TalkCapital streaming server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
