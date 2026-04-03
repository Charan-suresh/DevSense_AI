import * as vscode from 'vscode';

export class EditTracker {
    // blockName -> count
    private editCounts: Map<string, number> = new Map();
    // last edit timer
    private debounceTimer: NodeJS.Timeout | null = null;

    private onRepeatedEditEvent = new vscode.EventEmitter<{ uri: vscode.Uri, blockName: string, blockContent: string }>();
    public readonly onDidDetectRepeatedEdit = this.onRepeatedEditEvent.event;

    constructor() {
        vscode.workspace.onDidChangeTextDocument(e => this.handleDocumentChange(e));

        // Reset on terminal success if available
        if (vscode.window.onDidEndTerminalShellExecution) {
            vscode.window.onDidEndTerminalShellExecution(e => {
                if (e.exitCode === 0) {
                    this.editCounts.clear();
                }
            });
        }
        vscode.tasks.onDidEndTaskProcess(e => {
            if (e.exitCode === 0) {
                this.editCounts.clear();
            }
        });
    }

    private async handleDocumentChange(e: vscode.TextDocumentChangeEvent) {
        if (e.document.uri.scheme !== 'file') return;

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.toString() !== e.document.uri.toString()) return;

        const position = editor.selection.active;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processEdit(e.document, position);
        }, 2000);
    }

    private async processEdit(document: vscode.TextDocument, position: vscode.Position) {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (!symbols || symbols.length === 0) return;

            const targetSymbol = this.findEnclosingSymbol(symbols, position);
            if (targetSymbol) {
                const key = `${document.uri.toString()}:${targetSymbol.name}`;
                const currentCount = (this.editCounts.get(key) || 0) + 1;
                this.editCounts.set(key, currentCount);

                if (currentCount >= 3) {
                    const blockContent = document.getText(targetSymbol.range);
                    this.onRepeatedEditEvent.fire({
                        uri: document.uri,
                        blockName: targetSymbol.name,
                        blockContent
                    });
                }
            }
        } catch (err) {
            // Document symbol provider might not be available
        }
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

    public isRepeatedEditStatus(uri: vscode.Uri): boolean {
        for (const [key, count] of this.editCounts.entries()) {
            if (key.startsWith(uri.toString() + ':') && count >= 3) {
                return true;
            }
        }
        return false;
    }

    public getRepeatedEditContent(uri: vscode.Uri): string | null {
        // Return block content for highest count > 3, not perfect but gets the latest
        return null; // The event will pass the content
    }

    public reset() {
        this.editCounts.clear();
    }

    public dispose() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.onRepeatedEditEvent.dispose();
    }
}
