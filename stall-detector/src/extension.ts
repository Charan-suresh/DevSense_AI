import * as vscode from 'vscode';
import { IdleTracker } from './idleTracker';
import { EditTracker } from './editTracker';
import { ErrorTracker } from './errorTracker';
import { ProgressTracker } from './progressTracker';
import { WsClient } from './wsClient';
import { StallDetector } from './stallDetector';
import { NotificationRenderer } from './notificationRenderer';
import { getDevSenseOutputChannel, logDevSense } from './logger';

export function activate(context: vscode.ExtensionContext) {
	const idleTracker = new IdleTracker();
	const editTracker = new EditTracker();
	const errorTracker = new ErrorTracker();
	const progressTracker = new ProgressTracker();
	const wsClient = new WsClient();
	const stallDetector = new StallDetector(idleTracker, editTracker, errorTracker, progressTracker, wsClient);
	const notificationRenderer = new NotificationRenderer(wsClient);

	const applyFixCommand = vscode.commands.registerCommand('stall-detector.applyFix', async (uriString: string, line: number, codeToReplace: string) => {
		const uri = vscode.Uri.parse(uriString);
		const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uriString);
		if (editor) {
			const edit = new vscode.WorkspaceEdit();
			const range = editor.document.lineAt(line).range;
			edit.replace(uri, range, codeToReplace);
			await vscode.workspace.applyEdit(edit);
		}
	});

	context.subscriptions.push(
		idleTracker,
		editTracker,
		errorTracker,
		progressTracker,
		wsClient,
		stallDetector,
		applyFixCommand,
		getDevSenseOutputChannel(),
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, notificationRenderer)
	);

	logDevSense('Stall Detector activated');
}

export function deactivate() { }
