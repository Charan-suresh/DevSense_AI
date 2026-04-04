import * as vscode from 'vscode';
import { IdleTracker } from './idleTracker';
import { EditTracker } from './editTracker';
import { ErrorTracker } from './errorTracker';
import { ProgressTracker } from './progressTracker';
import { WsClient } from './wsClient';
import { logDevSense } from './logger';

export class StallDetector {
    private idleTracker: IdleTracker;
    private editTracker: EditTracker;
    private errorTracker: ErrorTracker;
    private progressTracker: ProgressTracker;
    private wsClient: WsClient;

    // To avoid spamming, we can remember when we last reported a stall for a URI
    private lastReportedStalls: Map<string, number> = new Map();
    private readonly STALL_COOLDOWN = 5000; // 5 seconds cooldown per file for easier testing

    constructor(idleTracker: IdleTracker, editTracker: EditTracker, errorTracker: ErrorTracker, progressTracker: ProgressTracker, wsClient: WsClient) {
        this.idleTracker = idleTracker;
        this.editTracker = editTracker;
        this.errorTracker = errorTracker;
        this.progressTracker = progressTracker;
        this.wsClient = wsClient;

        this.idleTracker.onDidBecomeIdle(uri => this.checkStall(uri, 'idle'));
        this.editTracker.onDidDetectRepeatedEdit(e => this.checkStall(e.uri, 'repeated edit'));
        this.errorTracker.onDidDetectRepeatedError(e => this.checkStall(e.uri, 'repeated error'));
        this.progressTracker.onDidDetectLackOfProgress(e => this.checkStall(e.uri, 'lack of progress'));
        this.progressTracker.onDidDetectRepeatedFailures(e => this.checkStall(e.uri, 'repeated failed run'));
    }

    private async checkStall(uri: vscode.Uri, source: string) {
        const key = uri.toString();
        const now = Date.now();
        const lastStall = this.lastReportedStalls.get(key) || 0;

        if (now - lastStall < this.STALL_COOLDOWN) {
            logDevSense('Skipping stall check due to cooldown', { uri: key, source });
            return;
        }

        const isIdle = this.idleTracker.isIdle(uri);
        const isEdit = this.editTracker.isRepeatedEditStatus(uri);
        const isError = this.errorTracker.isRepeatedErrorStatus(uri);
        const isNoProgress = this.progressTracker.isLackOfProgressStatus(uri);
        const isRepeatedFailure = this.progressTracker.isRepeatedFailureStatus(uri);

        const activeSignals: string[] = [];
        if (isIdle) { activeSignals.push('idle'); }
        if (isEdit) { activeSignals.push('repeated edit'); }
        if (isError) { activeSignals.push('repeated error'); }
        if (isRepeatedFailure) { activeSignals.push('repeated failed run'); }
        if (isNoProgress) { activeSignals.push('lack of progress'); }

        logDevSense('Stall check evaluated', {
            uri: key,
            source,
            activeSignals
        });

        if (activeSignals.length < 2 && !isNoProgress) {
            logDevSense('Stall check did not meet threshold', { uri: key, source });
            return;
        }

        this.lastReportedStalls.set(key, now);
        logDevSense('Stall detected', { uri: key, stallType: activeSignals.join(' + ') });
        await this.packageAndSendPayload(uri, activeSignals.join(' + '));

        // Optionally reset edit count so it needs 3 more edits to trigger again
        this.editTracker.reset();
    }

    private async packageAndSendPayload(uri: vscode.Uri, stallType: string) {
        let blockContent = '';
        let languageId = 'plaintext';

        // Find active editor for this URI
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
        if (editor) {
            languageId = editor.document.languageId;
            // Get current block content using DocumentSymbolProvider
            try {
                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );

                if (symbols && symbols.length > 0) {
                    const symbol = this.findEnclosingSymbol(symbols, editor.selection.active);
                    if (symbol) {
                        blockContent = editor.document.getText(symbol.range);
                    } else {
                        // Fallback: active line context
                        const line = editor.document.lineAt(editor.selection.active.line);
                        blockContent = line.text;
                    }
                } else {
                    const line = editor.document.lineAt(editor.selection.active.line);
                    blockContent = line.text;
                }
            } catch {
                const line = editor.document.lineAt(editor.selection.active.line);
                blockContent = line.text;
            }
        }

        const errorMessage = this.errorTracker.getLastErrorMsg(uri) || '';

        const payload = {
            blockContent,
            errorMessage,
            language: languageId,
            stallType,
            uri: uri.toString()
        };

        logDevSense('Sending stall payload', {
            uri: payload.uri,
            language: payload.language,
            stallType: payload.stallType,
            hasErrorMessage: Boolean(payload.errorMessage),
            blockPreview: blockContent.slice(0, 120)
        });
        this.wsClient.sendPayload(payload);
    }

    private findEnclosingSymbol(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | undefined {
        let matched: vscode.DocumentSymbol | undefined = undefined;
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                matched = symbol;
                if (symbol.children && symbol.children.length > 0) {
                    const childMatch = this.findEnclosingSymbol(symbol.children, position);
                    if (childMatch) {
                        matched = childMatch;
                    }
                }
            }
        }
        return matched;
    }

    public dispose() {
        // Tracker disposal is handled at extension level
        this.lastReportedStalls.clear();
    }
}
