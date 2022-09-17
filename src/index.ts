/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';
import { setContext } from './services/context';
import commands from './commands';
import { log } from './services/logs';


function registerCommands(context: vscode.ExtensionContext) {

    // Automatically register all the commands
  commands.forEach(command => {
      log(`Register command: ${command.getCommand()}`);
      context.subscriptions.push(
          vscode.commands.registerCommand(command.getCommand(), (args) => command.execute(args))
      );
  });

}

export async function activate(context: vscode.ExtensionContext) {
  setContext(context);
  registerCommands(context);

}

// this method is called when your extension is deactivated
export function deactivate() {

}
