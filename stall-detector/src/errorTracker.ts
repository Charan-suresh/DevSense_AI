import * as vscode from 'vscode';

interface ErrorRecord {
    message: string;
    timestamp: number;
}

export class ErrorTracker {
    // Maps uri.toString() -> array of error records
    private diagnosticsHistory: Map<string, ErrorRecord[]> = new Map();
    private readonly TIME_WINDOW = 2 * 60 * 1000; // 2 minutes

    private onRepeatedErrorEvent = new vscode.EventEmitter<{ uri: vscode.Uri, errorMessage: string }>();
    public readonly onDidDetectRepeatedError = this.onRepeatedErrorEvent.event;

    // Track last seen diagnostic messages to avoid duplicates from a single change event
    private lastSeenDiagnostics: Map<string, string[]> = new Map();

    // Track which errors have already fired an event to avoid spamming
    private alreadyFiredErrors: Set<string> = new Set();

    constructor() {
        vscode.languages.onDidChangeDiagnostics(e => this.handleDiagnosticsChange(e));
    }

    private handleDiagnosticsChange(e: vscode.DiagnosticChangeEvent) {
        const now = Date.now();

        for (const uri of e.uris) {
            if (uri.scheme !== 'file') {continue;}

            const key = uri.toString();
            const diagnostics = vscode.languages.getDiagnostics(uri);
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

            const currentMessages = errors.map(e => e.message);
            const lastSeen = this.lastSeenDiagnostics.get(key) || [];

            // Find exactly new errors
            const newErrors = currentMessages.filter(msg => !lastSeen.includes(msg));
            this.lastSeenDiagnostics.set(key, currentMessages);

            if (newErrors.length === 0) {continue;}

            let history = this.diagnosticsHistory.get(key) || [];
            // filter out old
            history = history.filter(record => now - record.timestamp <= this.TIME_WINDOW);

            for (const msg of newErrors) {
                history.push({
                    message: msg,
                    timestamp: now
                });
            }

            this.diagnosticsHistory.set(key, history);

            // Check if any error appears 3+ times
            const counts: { [msg: string]: number } = {};
            for (const record of history) {
                counts[record.message] = (counts[record.message] || 0) + 1;
                if (counts[record.message] >= 3) {
                    const uniqueKey = `${key}:${record.message}`;
                    if (!this.alreadyFiredErrors.has(uniqueKey)) {
                        this.alreadyFiredErrors.add(uniqueKey);
                        this.onRepeatedErrorEvent.fire({
                            uri,
                            errorMessage: record.message
                        });

                        // clear flag after 2 minutes so it can fire again if needed later
                        setTimeout(() => this.alreadyFiredErrors.delete(uniqueKey), this.TIME_WINDOW);
                    }
                }
            }
        }
    }

    public isRepeatedErrorStatus(uri: vscode.Uri): boolean {
        const key = uri.toString();
        const history = this.diagnosticsHistory.get(key) || [];
        const now = Date.now();
        const recent = history.filter(r => now - r.timestamp <= this.TIME_WINDOW);

        const counts: { [msg: string]: number } = {};
        for (const record of recent) {
            counts[record.message] = (counts[record.message] || 0) + 1;
            if (counts[record.message] >= 3) {
                // Confirm it's still present in the current problems panel
                const currentDiags = vscode.languages.getDiagnostics(uri);
                if (currentDiags.some(d => d.message === record.message && d.severity === vscode.DiagnosticSeverity.Error)) {
                    return true;
                }
            }
        }
        return false;
    }

    public getLastErrorMsg(uri: vscode.Uri): string | null {
        // Find existing errors
        const currentDiags = vscode.languages.getDiagnostics(uri);
        const errors = currentDiags.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        if (errors.length > 0) {
            // Get the newest error if possible, or just the last in array
            return errors[errors.length - 1].message;
        }

        const key = uri.toString();
        const history = this.diagnosticsHistory.get(key) || [];
        const now = Date.now();
        const recent = history.filter(r => now - r.timestamp <= this.TIME_WINDOW);

        if (recent.length > 0) {
            return recent[recent.length - 1].message;
        }

        return null;
    }

    public dispose() {
        this.diagnosticsHistory.clear();
        this.lastSeenDiagnostics.clear();
        this.alreadyFiredErrors.clear();
        this.onRepeatedErrorEvent.dispose();
    }
}
