import * as vscode from 'vscode';
import WebSocket from 'ws';
import { logDevSense } from './logger';

export class WsClient {
    private ws: WebSocket | null = null;

    private onMessageEvent = new vscode.EventEmitter<{ uri: string, resolution: any }>();
    public readonly onDidReceiveResolution = this.onMessageEvent.event;

    constructor() {
        this.connect();

        // Handle config change
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('stallDetector.websocketUrl')) {
                this.connect();
            }
        });
    }

    private connect() {
        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
        }

        const config = vscode.workspace.getConfiguration('stallDetector');
        const url = config.get<string>('websocketUrl', 'ws://localhost:8000/ws');
        logDevSense('Connecting WebSocket', { url });

        try {
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                logDevSense('WebSocket connected', { url });
            });

            this.ws.on('message', (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    logDevSense('WebSocket message received', parsed);
                    // Expecting payload: { uri: string, resolution: string }
                    if (parsed.uri && parsed.resolution) {
                        this.onMessageEvent.fire({
                            uri: parsed.uri,
                            resolution: parsed.resolution
                        });
                    } else if (parsed.resolution) {
                        // Fallback if uri not sent back, target active editor
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            this.onMessageEvent.fire({
                                uri: editor.document.uri.toString(),
                                resolution: parsed.resolution
                            });
                        }
                    }
                } catch (e) {
                    logDevSense('Failed to parse WebSocket message', String(e));
                    console.error('Failed to parse WebSocket message', e);
                }
            });

            this.ws.on('error', (err) => {
                logDevSense('WebSocket error', String(err));
                console.error('WebSocket error:', err);
            });

            this.ws.on('close', () => {
                logDevSense('WebSocket closed');
                console.log('WebSocket closed');
            });
        } catch (e) {
            logDevSense('Failed to connect to WebSocket', String(e));
            console.error('Failed to connect to WebSocket', e);
        }
    }

    public sendPayload(payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            logDevSense('WebSocket sending payload', {
                uri: payload?.uri,
                stallType: payload?.stallType
            });
            this.ws.send(JSON.stringify(payload));
        } else {
            logDevSense('WebSocket not open, reconnecting before send', {
                uri: payload?.uri,
                stallType: payload?.stallType
            });
            console.warn('WebSocket is not open. Initializing connection and re-sending...');
            this.connect();
            // simple retry after a bit
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    logDevSense('WebSocket retry send succeeded', {
                        uri: payload?.uri,
                        stallType: payload?.stallType
                    });
                    this.ws.send(JSON.stringify(payload));
                } else {
                    logDevSense('WebSocket retry send failed', {
                        uri: payload?.uri,
                        stallType: payload?.stallType
                    });
                }
            }, 1000);
        }
    }

    public dispose() {
        if (this.ws) {
            this.ws.close();
        }
        this.onMessageEvent.dispose();
    }
}
