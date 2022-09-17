import * as vscode from 'vscode';

let statusBarDisposable: vscode.Disposable;
export function updateStatusBar(message: string|undefined) {

	if (statusBarDisposable) {
		statusBarDisposable.dispose();
	}

	if (message) {
		statusBarDisposable = vscode.window.setStatusBarMessage(`$(sync~spin) ${message}`, );
		vscode.window.showInformationMessage(message);
	}
}