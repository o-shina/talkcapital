import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type AudioStream,
  type TranscriptResultStream,
} from '@aws-sdk/client-transcribe-streaming';

export interface TranscribeStreamEvents {
  partial: [text: string];
  final: [text: string];
  error: [error: Error];
  close: [];
}

export interface TranscribeStreamDeps {
  client?: TranscribeStreamingClient;
}

const SILENCE_INTERVAL_MS = 10_000;
const SAMPLE_RATE = 16_000;
// 100ms of silence (16kHz, 16-bit mono = 3200 bytes)
const SILENCE_CHUNK = new Uint8Array(SAMPLE_RATE * 2 * 0.1);

export class TranscribeStream extends EventEmitter<TranscribeStreamEvents> {
  private audioPassThrough: PassThrough;
  private client: TranscribeStreamingClient;
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(region: string, deps?: TranscribeStreamDeps) {
    super();
    this.audioPassThrough = new PassThrough();
    this.client =
      deps?.client ?? new TranscribeStreamingClient({ region });
  }

  async start(): Promise<void> {
    const audioStream = this.createAudioStream();

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: 'ja-JP',
      MediaSampleRateHertz: SAMPLE_RATE,
      MediaEncoding: 'pcm',
      AudioStream: audioStream,
    });

    try {
      const response = await this.client.send(command);
      this.startSilenceTimer();
      this.consumeResultStream(response.TranscriptResultStream);
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  feedAudio(chunk: Buffer | Uint8Array): void {
    if (this.closed) return;
    this.audioPassThrough.write(chunk);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopSilenceTimer();
    this.audioPassThrough.end();
  }

  private async *createAudioStream(): AsyncIterable<AudioStream> {
    for await (const chunk of this.audioPassThrough) {
      yield { AudioEvent: { AudioChunk: chunk as Uint8Array } };
    }
  }

  private async consumeResultStream(
    stream: AsyncIterable<TranscriptResultStream> | undefined,
  ): Promise<void> {
    if (!stream) {
      this.emit('error', new Error('TranscriptResultStream is undefined'));
      return;
    }

    try {
      for await (const event of stream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results ?? [];
          for (const result of results) {
            const transcript =
              result.Alternatives?.[0]?.Transcript ?? '';
            if (!transcript) continue;

            if (result.IsPartial) {
              this.emit('partial', transcript);
            } else {
              this.emit('final', transcript);
            }
          }
        } else if (event.BadRequestException) {
          this.emit(
            'error',
            new Error(`BadRequest: ${event.BadRequestException.Message}`),
          );
        } else if (event.LimitExceededException) {
          this.emit(
            'error',
            new Error(
              `LimitExceeded: ${event.LimitExceededException.Message}`,
            ),
          );
        } else if (event.InternalFailureException) {
          this.emit(
            'error',
            new Error(
              `InternalFailure: ${event.InternalFailureException.Message}`,
            ),
          );
        } else if (event.ServiceUnavailableException) {
          this.emit(
            'error',
            new Error(
              `ServiceUnavailable: ${event.ServiceUnavailableException.Message}`,
            ),
          );
        }
      }
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.emit('close');
    }
  }

  private startSilenceTimer(): void {
    this.silenceTimer = setInterval(() => {
      if (!this.closed) {
        this.audioPassThrough.write(SILENCE_CHUNK);
      }
    }, SILENCE_INTERVAL_MS);
  }

  private stopSilenceTimer(): void {
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
