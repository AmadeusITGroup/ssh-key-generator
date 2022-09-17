/*
* This suite should be run first.
*/

import * as vscode from 'vscode';
import * as assert from 'assert';
import { after, before } from 'mocha';

import { context } from '../../src/services/context';

export const extension = vscode.extensions.getExtension('amadeus.ssh-key-generator');

suite('Extension Test Suite', () => {

	before(() => {
		vscode.window.showInformationMessage('Starting the tests ..');
	});

	after(() => {
		vscode.window.showInformationMessage('All tests done!');
	});


	test('Extension should be present', () => {
		assert.ok(extension);
	});

	// Activate manually the extension 
	test('should activate', async function() {
		this.timeout(6000);
		await extension!.activate();
	});

	test('Context should be set', () => {
		assert.ok(context);
	});

	test('commands registered', async () => {

		const declaredCommands = context.extension.packageJSON.contributes.commands;
		if (declaredCommands) {
			const registeredCommands = await vscode.commands.getCommands();
			declaredCommands.forEach((element:{ [key: string]: string } ) => {
				assert.ok(registeredCommands.includes(element.command));
			});
		} else {
			console.log(`No commands found in package.json`);
			assert.equal(declaredCommands, undefined);
		}
	});

	test('test random command', async () => {

		const registeredCommands = await vscode.commands.getCommands();
		assert.ok(registeredCommands.includes('ssh.generateSSHkey'));
		assert.ok(registeredCommands.includes('ssh.generateSSHkeyForce'));
	});

});
