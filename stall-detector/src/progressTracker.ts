import * as vscode from 'vscode';
import { logDevSense } from './logger';

interface ProgressState {
    currentErrorFingerprints: Set<string>;
    currentErrorCount: number;
    editCountSinceImprovement: number;
    failedRunsSinceImprovement: number;
    hasLackOfProgress: boolean;
    hasRepeatedFailures: boolean;
}

export class ProgressTracker {
    private readonly states: Map<string, ProgressState> = new Map();
    private readonly MIN_EDITS_WITHOUT_PROGRESS = 3;
    private readonly MIN_FAILED_RUNS_WITHOUT_PROGRESS = 1;
    private readonly MIN_FAILED_RUNS_FOR_SIGNAL = 3;

    private readonly onLackOfProgressEvent = new vscode.EventEmitter<{ uri: vscode.Uri }>();
    public readonly onDidDetectLackOfProgress = this.onLackOfProgressEvent.event;
    private readonly onRepeatedFailuresEvent = new vscode.EventEmitter<{ uri: vscode.Uri }>();
    public readonly onDidDetectRepeatedFailures = this.onRepeatedFailuresEvent.event;

    constructor() {
        vscode.workspace.onDidChangeTextDocument(e => this.handleDocumentChange(e));
        vscode.languages.onDidChangeDiagnostics(e => this.handleDiagnosticsChange(e));

        if (vscode.window.onDidEndTerminalShellExecution) {
            vscode.window.onDidEndTerminalShellExecution(e => {
                this.handleExecutionResult(e.exitCode);
            });
        }

        vscode.tasks.onDidEndTaskProcess(e => {
            this.handleExecutionResult(e.exitCode);
        });
    }

    private handleDocumentChange(e: vscode.TextDocumentChangeEvent) {
        if (e.document.uri.scheme !== 'file' || e.contentChanges.length === 0) {
            return;
        }

        const state = this.getOrCreateState(e.document.uri);
        state.editCountSinceImprovement += 1;
        logDevSense('Progress tracker counted edit', {
            uri: e.document.uri.toString(),
            editCountSinceImprovement: state.editCountSinceImprovement
        });
        this.evaluateState(e.document.uri, state);
    }

    private handleDiagnosticsChange(e: vscode.DiagnosticChangeEvent) {
        for (const uri of e.uris) {
            if (uri.scheme !== 'file') {
                continue;
            }

            const state = this.getOrCreateState(uri);
            const currentFingerprints = this.getCurrentErrorFingerprints(uri);
            const currentErrorCount = currentFingerprints.size;
            const previousFingerprints = state.currentErrorFingerprints;
            const previousErrorCount = state.currentErrorCount;

            const resolvedErrors = [...previousFingerprints].some(fingerprint => !currentFingerprints.has(fingerprint));
            const improved = previousErrorCount > 0 && (currentErrorCount < previousErrorCount || resolvedErrors);

            if (improved) {
                state.editCountSinceImprovement = 0;
                state.failedRunsSinceImprovement = 0;
                logDevSense('Progress tracker detected improvement', { uri: uri.toString() });
            }

            state.currentErrorFingerprints = currentFingerprints;
            state.currentErrorCount = currentErrorCount;
            this.evaluateState(uri, state);
        }
    }

    private handleExecutionResult(exitCode: number | undefined) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'file' || exitCode === undefined) {
            return;
        }

        const uri = editor.document.uri;
        const state = this.getOrCreateState(uri);

        if (exitCode === 0) {
            state.editCountSinceImprovement = 0;
            state.failedRunsSinceImprovement = 0;
            logDevSense('Progress tracker recorded successful run', { uri: uri.toString() });
        } else {
            state.failedRunsSinceImprovement += 1;
            logDevSense('Progress tracker recorded failed run', {
                uri: uri.toString(),
                failedRunsSinceImprovement: state.failedRunsSinceImprovement,
                exitCode
            });
        }

        this.evaluateState(uri, state);
    }

    private evaluateState(uri: vscode.Uri, state: ProgressState) {
        const hasErrors = state.currentErrorCount > 0;
        const enoughEditEffort = state.editCountSinceImprovement >= this.MIN_EDITS_WITHOUT_PROGRESS;
        const enoughFailedRuns = state.failedRunsSinceImprovement >= this.MIN_FAILED_RUNS_WITHOUT_PROGRESS;
        const enoughFailedRunsForSignal = state.failedRunsSinceImprovement >= this.MIN_FAILED_RUNS_FOR_SIGNAL;

        const nextLackOfProgress = hasErrors && enoughEditEffort && enoughFailedRuns;
        const nextRepeatedFailures = hasErrors && enoughFailedRunsForSignal;
        const becameStalled = nextLackOfProgress && !state.hasLackOfProgress;
        const becameRepeatedFailures = nextRepeatedFailures && !state.hasRepeatedFailures;

        logDevSense('Progress tracker evaluated state', {
            uri: uri.toString(),
            hasErrors,
            editCountSinceImprovement: state.editCountSinceImprovement,
            failedRunsSinceImprovement: state.failedRunsSinceImprovement,
            nextLackOfProgress,
            nextRepeatedFailures
        });

        state.hasLackOfProgress = nextLackOfProgress;
        state.hasRepeatedFailures = nextRepeatedFailures;

        if (becameStalled) {
            logDevSense('Progress tracker emitted lack-of-progress signal', { uri: uri.toString() });
            this.onLackOfProgressEvent.fire({ uri });
        }

        if (becameRepeatedFailures) {
            logDevSense('Progress tracker emitted repeated-failures signal', { uri: uri.toString() });
            this.onRepeatedFailuresEvent.fire({ uri });
        }
    }

    private getCurrentErrorFingerprints(uri: vscode.Uri): Set<string> {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);

        return new Set(errors.map(d => this.createFingerprint(d)));
    }

    private createFingerprint(diagnostic: vscode.Diagnostic): string {
        const code = typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code;
        const normalizedMessage = diagnostic.message.replace(/\s+/g, ' ').trim();

        return [
            diagnostic.source ?? 'unknown',
            code ?? 'unknown',
            normalizedMessage,
            diagnostic.range.start.line,
            diagnostic.range.start.character,
            diagnostic.range.end.line,
            diagnostic.range.end.character
        ].join('|');
    }

    private getOrCreateState(uri: vscode.Uri): ProgressState {
        const key = uri.toString();
        let state = this.states.get(key);

        if (!state) {
            state = {
                currentErrorFingerprints: this.getCurrentErrorFingerprints(uri),
                currentErrorCount: vscode.languages.getDiagnostics(uri).filter(d => d.severity === vscode.DiagnosticSeverity.Error).length,
                editCountSinceImprovement: 0,
                failedRunsSinceImprovement: 0,
                hasLackOfProgress: false,
                hasRepeatedFailures: false
            };
            this.states.set(key, state);
        }

        return state;
    }

    public isLackOfProgressStatus(uri: vscode.Uri): boolean {
        return this.getOrCreateState(uri).hasLackOfProgress;
    }

    public isRepeatedFailureStatus(uri: vscode.Uri): boolean {
        return this.getOrCreateState(uri).hasRepeatedFailures;
    }

    public dispose() {
        this.states.clear();
        this.onLackOfProgressEvent.dispose();
        this.onRepeatedFailuresEvent.dispose();
    }
}
