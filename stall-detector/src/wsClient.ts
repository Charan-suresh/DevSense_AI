import * as vscode from 'vscode';
import WebSocket from 'ws';

export class WsClient {
    private ws: WebSocket | null = null;

    private onMessageEvent = new vscode.EventEmitter<{ uri: string, resolution: string }>();
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

        try {
            this.ws = new WebSocket(url);

            this.ws.on('message', (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
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
                    console.error('Failed to parse WebSocket message', e);
                }
            });

            this.ws.on('error', (err) => {
                console.error('WebSocket error:', err);
            });

            this.ws.on('close', () => {
                console.log('WebSocket closed');
            });
        } catch (e) {
            console.error('Failed to connect to WebSocket', e);
        }
    }

    public sendPayload(payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        } else {
            console.warn('WebSocket is not open. Initializing connection and re-sending...');
            this.connect();
            // simple retry after a bit
            setTimeout(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify(payload));
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
