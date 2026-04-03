import * as vscode from 'vscode';
import { IdleTracker } from './idleTracker';
import { EditTracker } from './editTracker';
import { ErrorTracker } from './errorTracker';
import { WsClient } from './wsClient';
import { StallDetector } from './stallDetector';
import { NotificationRenderer } from './notificationRenderer';

export function activate(context: vscode.ExtensionContext) {
	const idleTracker = new IdleTracker();
	const editTracker = new EditTracker();
	const errorTracker = new ErrorTracker();
	const wsClient = new WsClient();
	const stallDetector = new StallDetector(idleTracker, editTracker, errorTracker, wsClient);
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
		wsClient,
		stallDetector,
		applyFixCommand,
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, notificationRenderer)
	);

	console.log('Stall Detector is now active!');
}

export function deactivate() { }
