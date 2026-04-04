import * as vscode from 'vscode';

const output = vscode.window.createOutputChannel('DevSense');

export function logDevSense(message: string, details?: unknown) {
    const timestamp = new Date().toISOString();
    if (details === undefined) {
        output.appendLine(`[${timestamp}] ${message}`);
        return;
    }

    let serialized = '';
    try {
        serialized = typeof details === 'string' ? details : JSON.stringify(details);
    } catch {
        serialized = String(details);
    }

    output.appendLine(`[${timestamp}] ${message}: ${serialized}`);
}

export function getDevSenseOutputChannel() {
    return output;
}
