import * as vscode from 'vscode';


export class Properties {

    private getExtensionConfiguration() {
        const workspaceConfig = vscode.workspace.getConfiguration('ssh');
        return workspaceConfig;
    }

    public getUsername() {
        const workspaceConfig = this.getExtensionConfiguration();
        return workspaceConfig.username;
    }

    public getRemoteSSHConfigFile() {
        const workspaceConfig = vscode.workspace.getConfiguration('remote.SSH');
        return workspaceConfig.configFile;
    }
}
