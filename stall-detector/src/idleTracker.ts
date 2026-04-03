import * as vscode from 'vscode';

export class IdleTracker {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private idleStates: Map<string, boolean> = new Map();
    private readonly IDLE_THRESHOLD = 25000; // 25 seconds

    private onIdleEvent = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidBecomeIdle = this.onIdleEvent.event;

    private onActiveEvent = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidBecomeActive = this.onActiveEvent.event;

    constructor() {
        vscode.workspace.onDidChangeTextDocument(e => this.resetTimer(e.document.uri));
        vscode.window.onDidChangeTextEditorSelection(e => this.resetTimer(e.textEditor.document.uri));
        vscode.window.onDidChangeActiveTextEditor(e => {
            if (e && e.document.uri.scheme === 'file') {
                this.resetTimer(e.document.uri);
            }
        });
        vscode.workspace.onDidCloseTextDocument(e => this.clearTimer(e.uri));
    }

    private resetTimer(uri: vscode.Uri) {
        if (uri.scheme !== 'file') {
            return;
        }
        
        const key = uri.toString();
        
        // If it was idle, now it's active
        if (this.idleStates.get(key)) {
            this.idleStates.set(key, false);
            this.onActiveEvent.fire(uri);
        }

        this.clearTimer(uri);

        const timer = setTimeout(() => {
            this.idleStates.set(key, true);
            this.onIdleEvent.fire(uri);
        }, this.IDLE_THRESHOLD);

        this.timers.set(key, timer);
    }

    private clearTimer(uri: vscode.Uri) {
        const key = uri.toString();
        const existingTimer = this.timers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.timers.delete(key);
        }
        this.idleStates.delete(key);
    }

    public isIdle(uri: vscode.Uri): boolean {
        return this.idleStates.get(uri.toString()) === true;
    }

    public dispose() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.idleStates.clear();
        this.onIdleEvent.dispose();
        this.onActiveEvent.dispose();
    }
}
