import * as vscode from 'vscode';
import { CancelError } from './services/error';
import { log } from './services/logs';


export interface hostPickItem extends vscode.QuickPickItem {
    hostname?: string;
    host?: string;
}

export async function getRemoteServerFromUserInput(hostsList: hostPickItem[]): Promise<string> {

    const hostname = await selectRemoteServerFromHostsList(hostsList);
    if (!hostname) {
        throw new CancelError('User canceled the selectserver box');
    }
    log(`Remote server selected: ${hostname}`);
    return hostname;
}

async function selectRemoteServerFromHostsList(hostsList: hostPickItem[]) {
    log('function selectRemoteServer');

    return new Promise<string | undefined>((resolve) => {
        const quickPick = vscode.window.createQuickPick<hostPickItem>();
        quickPick.canSelectMany = false;
        quickPick.ignoreFocusOut = true;
        quickPick.placeholder = "Select a remote server or type a new one";
        quickPick.items = hostsList;
        quickPick.onDidHide(() => {
            quickPick.dispose();
            // Useful to catch when the user type esc to close the quickpick.
            // Without it, the process silently terminates 
            resolve(undefined);
        });
        quickPick.onDidAccept(() => {
            const selection = quickPick.activeItems[0];
            resolve(selection.label);
            quickPick.hide();
        });

        quickPick.onDidChangeValue(value => {
            if (!value) {
                quickPick.items = hostsList;
                return;
            }
            // add a new host to the pick list as the first item
            if (! hostsList.includes({label : value, hostname : value})) {
                const newHost = {label : value, hostname : value};
                quickPick.items = [newHost, ...hostsList];
            }
            return;
        });
        quickPick.show();
    })

}
