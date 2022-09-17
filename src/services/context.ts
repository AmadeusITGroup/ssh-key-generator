import * as vscode from 'vscode';


export let context: vscode.ExtensionContext;

export function setContext(ctx: vscode.ExtensionContext): void {
    context = ctx;
}

