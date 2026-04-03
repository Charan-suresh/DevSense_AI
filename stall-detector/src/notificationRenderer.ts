import * as vscode from 'vscode';
import { WsClient } from './wsClient';

export class NotificationRenderer implements vscode.CodeLensProvider {
    private resolutions = new Map<string, { line: number, message: any, timestamp: number }>();

    private readonly _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(wsClient: WsClient) {
        wsClient.onDidReceiveResolution(e => this.addResolution(e.uri, e.resolution));

        // Clean up old resolutions every few seconds
        setInterval(() => {
            const now = Date.now();
            let changed = false;
            for (const [key, val] of this.resolutions.entries()) {
                if (now - val.timestamp > 15000) { // 15s timeout
                    this.resolutions.delete(key);
                    changed = true;
                }
            }
            if (changed) {
                this._onDidChangeCodeLenses.fire();
            }
        }, 5000);
    }

    private addResolution(uriString: string, resolution: any) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uriString);
        if (!editor) {return;}

        let line = editor.selection.active.line;
        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        if (errors.length > 0) {
            line = errors[0].range.start.line;
        }

        this.resolutions.set(uriString, {
            line,
            message: resolution,
            timestamp: Date.now()
        });

        this._onDidChangeCodeLenses.fire();
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        const res = this.resolutions.get(document.uri.toString());
        if (res) {
            const range = new vscode.Range(res.line, 0, res.line, 0);
            
            const explanation = res.message?.explanation || "Stall detected";
            const fix = res.message?.fix || "Inspect the code below.";
            const codeToReplace = res.message?.codeToReplace || "";

            const explanationLens = new vscode.CodeLens(range, {
                title: `💡 ${explanation}`,
                command: ''
            });

            const fixLens = new vscode.CodeLens(range, {
                title: `⚡ DevSense: ${fix}`,
                command: ''
            });

            const applyLens = new vscode.CodeLens(range, {
                title: `✨ Apply Fix`,
                command: 'stall-detector.applyFix',
                arguments: [document.uri.toString(), res.line, codeToReplace]
            });

            return [explanationLens, fixLens, applyLens];
        }
        return [];
    }
}
