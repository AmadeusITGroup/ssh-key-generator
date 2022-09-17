import * as vscode from 'vscode';
import * as assert from 'assert';
import { after, before } from 'mocha';
import { Properties } from '../../src/Properties';

suite('Properties Test Suite', () => {

	before(() => {
		vscode.window.showInformationMessage('Starting the tests ..');
	});

	after(() => {
		vscode.window.showInformationMessage('All tests done!');
	});


	test('getUsername', async () => {
		const configuration = vscode.workspace.getConfiguration('ssh');
		await configuration.update('username', 'myvalue', vscode.ConfigurationTarget.Global);
		assert.strictEqual(new Properties().getUsername(), 'myvalue');
		await configuration.update('username', undefined, vscode.ConfigurationTarget.Global);
		assert.strictEqual(new Properties().getUsername(), '');
	});

	// All extensions are disabled during the test, so the value is undefined since Remote-SSH extension is not enabled
	test('getRemoteSSHConfigFile', async () => {
		assert.strictEqual(new Properties().getRemoteSSHConfigFile(), undefined);
	});

});
