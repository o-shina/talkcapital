/** @type {WebSocket | null} */
let ws = null;
/** @type {AudioContext | null} */
let audioCtx = null;
/** @type {MediaStream | null} */
let mediaStream = null;
/** @type {AudioWorkletNode | null} */
let workletNode = null;
let waitingForFinal = false;

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const graphicEl = document.getElementById('graphic');
const graphicPlaceholder = document.getElementById('graphic-placeholder');

let finalText = '';
let partialText = '';

function setStatus(msg) {
  statusEl.textContent = msg;
}

function updateTranscript() {
  while (transcriptEl.firstChild) {
    transcriptEl.removeChild(transcriptEl.firstChild);
  }

  if (finalText) {
    const finalSpan = document.createElement('span');
    finalSpan.textContent = finalText;
    transcriptEl.appendChild(finalSpan);
  }

  if (partialText) {
    const partialSpan = document.createElement('span');
    partialSpan.className = 'partial';
    partialSpan.textContent = partialText;
    transcriptEl.appendChild(partialSpan);
  }
}

function showGraphic(base64) {
  graphicEl.src = 'data:image/png;base64,' + base64;
  graphicEl.style.display = 'block';
  graphicPlaceholder.style.display = 'none';
}

function cleanupAudio() {
  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

function closeWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

function resetUI() {
  btnStart.disabled = false;
  btnStop.disabled = true;
  waitingForFinal = false;
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    setStatus('接続済み');
    ws.send(JSON.stringify({ type: 'session_start' }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case 'transcript_partial':
        partialText = msg.text;
        updateTranscript();
        break;
      case 'transcript_final':
        finalText += msg.text;
        partialText = '';
        updateTranscript();
        break;
      case 'graphic_update':
        showGraphic(msg.png);
        break;
      case 'graphic_final':
        showGraphic(msg.png);
        setStatus('最終版グラレコ生成完了');
        // 最終版を受信したら接続を閉じる
        if (waitingForFinal) {
          closeWebSocket();
          resetUI();
        }
        break;
      case 'status':
        setStatus(msg.message);
        break;
      case 'error':
        setStatus('エラー: ' + msg.message);
        console.error('Server error:', msg.message);
        break;
    }
  };

  ws.onclose = () => {
    setStatus(waitingForFinal ? '切断（最終版生成中に切断されました）' : '切断');
    ws = null;
    cleanupAudio();
    resetUI();
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    setStatus('接続エラー');
  };
}

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    audioCtx = new AudioContext({ sampleRate: 16000 });
    await audioCtx.audioWorklet.addModule('audio-processor.js');

    const source = audioCtx.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');

    workletNode.port.onmessage = (event) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data);
      }
    };

    source.connect(workletNode);
    workletNode.connect(audioCtx.destination);

    connectWebSocket();

    btnStart.disabled = true;
    btnStop.disabled = false;
    setStatus('録音中...');
    finalText = '';
    partialText = '';
    while (transcriptEl.firstChild) {
      transcriptEl.removeChild(transcriptEl.firstChild);
    }
  } catch (err) {
    console.error('Recording start failed:', err);
    cleanupAudio();
    setStatus('マイクの使用が許可されていません');
  }
}

async function stopRecording() {
  btnStop.disabled = true;
  setStatus('最終版を生成中...');
  waitingForFinal = true;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'session_end' }));
  }

  cleanupAudio();
}

btnStart.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
