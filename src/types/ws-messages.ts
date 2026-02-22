// クライアント → サーバー
export interface WsSessionStart {
  type: 'session_start';
}
export interface WsSessionEnd {
  type: 'session_end';
}
export type WsClientMessage = WsSessionStart | WsSessionEnd;

// サーバー → クライアント
export interface WsTranscriptPartial {
  type: 'transcript_partial';
  text: string;
}
export interface WsTranscriptFinal {
  type: 'transcript_final';
  text: string;
}
export interface WsGraphicUpdate {
  type: 'graphic_update';
  png: string; // base64
}
export interface WsGraphicFinal {
  type: 'graphic_final';
  png: string; // base64
}
export interface WsStatus {
  type: 'status';
  message: string;
}
export interface WsError {
  type: 'error';
  message: string;
}
export type WsServerMessage =
  | WsTranscriptPartial
  | WsTranscriptFinal
  | WsGraphicUpdate
  | WsGraphicFinal
  | WsStatus
  | WsError;
