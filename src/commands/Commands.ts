import * as vscode from 'vscode';

import { displayLog, log } from '../services/logs';
import { updateStatusBar } from '../services/statusBar';
import { SSHProcess } from '../sshProcess';


abstract class Command implements vscode.Command {
    title = "";
    command = "";

    async execute(_options?: any): Promise<void|string> {
		log(`\n\n-----------------------`);
		log(`Execute the command: ${this.title}`);
		try {
			return await this.executeCommand();
		} catch(error: any) {
			updateStatusBar(undefined);
			log(`Setup stopped: ${error.message}`);

			if (error.name === 'Error') {
				displayLog();
				vscode.window.showErrorMessage(`Setup stopped:\n${error.message} \n\n`, { modal: true});
			}
			if (error.name === 'CancelProcess') {
				vscode.window.showErrorMessage(`Setup interrupted by the user:\n${error.message} \n\n`);
			}
			
		} finally {
			log("Command execution: finally");
			updateStatusBar(undefined);
		}
	}

	public getCommand() {
		return this.command;
	}

	abstract executeCommand(): Promise<void|string>;
}

interface CommandOptions {
    hostName?: string;
}

/*
* Command to generate a SSH key pair if needed and returns the host selected to be configured
*/
export class generateSSHkey extends Command {
	title = "Generate SSH Keys";
    command = "ssh.generateSSHkey";
   
    async executeCommand(options?: CommandOptions): Promise<string> {
		const SSHProcessInstance = new SSHProcess();
		if (options && options.hostName) {
			SSHProcessInstance.setHostName(options.hostName);
		};
		return await SSHProcessInstance.run();
    }

}

/*
* Command to generate a SSH key pair and returns the host selected to be configured
*/
export class generateSSHkeyForce extends Command {
	title = "Generate SSH Keys (Force: recreate if exists)";
    command = "ssh.generateSSHkeyForce";
   
    async executeCommand(options?: CommandOptions): Promise<void|string> {
		const SSHProcessInstance = new SSHProcess();
		if (options && options.hostName) {
			SSHProcessInstance.setHostName(options.hostName);
		};
		return await SSHProcessInstance.run(true);
    }

}

export class copyHostConfigtoUserConfigFile extends Command {
	title = "Copy a host config from $HOME/.ssh/config to the custom file";
    command = "ssh.copySSHConfig";
   
    async executeCommand(options?: CommandOptions): Promise<void> {
		if (options && options.hostName) {
			new SSHProcess().copySSHConfig(options.hostName);
		}
    }

}
