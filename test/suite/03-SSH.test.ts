import * as vscode from 'vscode';
import * as assert from 'assert';
import { after, before } from 'mocha';
import * as fs from 'fs';
import * as os from 'os';

import * as path from 'path';
import { SSHProcess } from '../../src/sshProcess';

var mockOS = require('mock-os');

let homedirRepo =  path.join(__dirname, '..', '..', '..', 'test','data', '03-SSH.test');

let fsify: any;

mockOS({
	'homedir': homedirRepo
  });

fsify = require('fsify')({
	cwd: os.homedir(),
	persistent: false,
	force: true
});

suite('SSHProcess - Basic tests: Test Suite', () => {


	before(() => {
		vscode.window.showInformationMessage('Starting the tests ..');
	});

	after(() => {
		vscode.window.showInformationMessage('All tests done!');
	});


	test('SSHProcess constructor', async () => {
		const SSHProcessInstance = new SSHProcess();
		assert.strictEqual(SSHProcessInstance.homedir, path.join(homedirRepo));
		assert.strictEqual(SSHProcessInstance.SSHFolder, path.join(homedirRepo, '.ssh'));
		assert.strictEqual(SSHProcessInstance.UserSSHConfigFilePath, path.join(homedirRepo, '.ssh', 'config'));

		assert.strictEqual(fs.existsSync(path.join(homedirRepo, '.ssh')), true);
		assert.strictEqual(fs.existsSync( path.join(homedirRepo, '.ssh', 'config')), true);

		
	});

	test('setHostName', async () => {
		const SSHProcessInstance = new SSHProcess();
		SSHProcessInstance.setHostName('MyhostName.amadeus.com');

		// @ts-expect-error
		assert.strictEqual(SSHProcessInstance.hostname, 'MyhostName.amadeus.com');
	});


	test('SSHKey Path', async () => {
		const SSHProcessInstance = new SSHProcess();
		SSHProcessInstance.setHostName('MyhostName.amadeus.com');
		// @ts-expect-error
		SSHProcessInstance.setSSHKeyName();

		assert.strictEqual(SSHProcessInstance.SSHKeyName, `id_rsa-vscode-MyhostName`);
		assert.strictEqual(SSHProcessInstance.SSHPrivateKeyPath, path.join(homedirRepo, '.ssh', `id_rsa-vscode-MyhostName`));
		assert.strictEqual(SSHProcessInstance.SSHPublicKeyPath, path.join(homedirRepo, '.ssh', `id_rsa-vscode-MyhostName.pub`));

	});

	test('Remove SSHKey', () => {

		const tempInstallDirStructure = [
			{
				type: fsify.DIRECTORY,
				name: '.ssh',
				contents: [
					{
						type: fsify.FILE,
						name: `id_rsa-vscode-MyhostName`,
						content: '' 
					
					},
					{
						type: fsify.FILE,
						name: `id_rsa-vscode-MyhostName.pub`,
						content: '' 
					}
				]
			}
		];
		const SSHProcessInstance = new SSHProcess();
		fsify(tempInstallDirStructure).then(() => {
			// @ts-expect-error
			SSHProcessInstance.removeSSHKey();
			assert.strictEqual(fs.existsSync(SSHProcessInstance.SSHPrivateKeyPath), false);
			assert.strictEqual(fs.existsSync(SSHProcessInstance.SSHPublicKeyPath), false);

		}).catch((err: any) => console.error(`Error in fsify: ${err}`));

	});

	suite('SSHProcess - SSH Config: Test Suite - ', () => {


		before(async () => {
			vscode.window.showInformationMessage('Starting the tests ..');
			const contentConfig = `
	Include VSCodeConfig
	
	Host myhost1.fr
	  HostName myhost1.fr
	  User username
	  StrictHostKeyChecking accept-new
	  IdentityFile id_rsa-myhost1
	#this is a comment
	HOST myhost2
	  HOSTNAME myhost2.fr
	  User username-myhost2
	  StrictHostKeyChecking accept-new`;
	
			const tempInstallDirStructure = [
				{
					type: fsify.DIRECTORY,
					name: '.ssh',
					contents: [
						{
							type: fsify.FILE,
							name: `config`,
							contents: contentConfig 
						
						}
					]
				}
			];
			await fsify(tempInstallDirStructure).then(() => {
				console.log('Initialize config file content');
			}).catch((err: any) => console.error(`Error in fsify: ${err}`));
	
		});
	
		after(() => {
			vscode.window.showInformationMessage('All tests done!');
			mockOS.restore();
		});
	
		test('findSectionInSSHConfigFromHost', () => {
	
			
			const SSHProcessInstance = new SSHProcess();
			// @ts-expect-error
			var section = SSHProcessInstance.findSectionInSSHConfigFromHost('myhost1.fr');
			assert.ok(section);
	
			// @ts-expect-error
			section = SSHProcessInstance.findSectionInSSHConfigFromHost('myhost2');
			assert.ok(section);
			
			// @ts-expect-error
			section = SSHProcessInstance.findSectionInSSHConfigFromHost('myhost3');
			assert.ok(!section);
	
		});
	
		test('findSectionInSSHConfigFromInclude', () => {
			const SSHProcessInstance = new SSHProcess();
			// @ts-expect-error
			var section = SSHProcessInstance.findSectionInSSHConfigFromInclude('VSCodeConfig');
			assert.ok(section);
	
			// @ts-expect-error
			section = SSHProcessInstance.findSectionInSSHConfigFromHost('MyConfig');
			assert.ok(!section);
			assert.deepStrictEqual(section, undefined);
	
		});
	
		test('getNodeSSHConfig', () => {
	
			const SSHProcessInstance = new SSHProcess();
	
			var sshConnectionData = SSHProcessInstance.getNodeSSHConfig('myhost1.fr');
			assert.deepStrictEqual(sshConnectionData, {
				host: "myhost1.fr",
				username: "username",
				privateKey: "id_rsa-myhost1",
			});
	
			sshConnectionData = SSHProcessInstance.getNodeSSHConfig('myhost2');
			assert.deepStrictEqual(sshConnectionData, {
				host: "myhost2.fr",
				username: "username-myhost2",
			});
	
			sshConnectionData = SSHProcessInstance.getNodeSSHConfig('myhost3');
			assert.deepStrictEqual(sshConnectionData, {});
				
		});
	
		test('getUserName', async () => {
	
			const SSHProcessInstance = new SSHProcess();
	
			SSHProcessInstance.setHostName('myhost2');
			// @ts-expect-error
			var username = await SSHProcessInstance.getUserName();
			assert.deepStrictEqual(username, 'username-myhost2');
			
		});
	
		test('addIdentityFileToSSHConfig', () => {
	
			const SSHProcessInstance = new SSHProcess();
	
			SSHProcessInstance.setHostName('myhost2');
			SSHProcessInstance.addIdentityFileToSSHConfig();
			// @ts-expect-error
			var section = SSHProcessInstance.findSectionInSSHConfigFromHost('myhost2');
			var IdentityFile = section.config.filter((e: any) => e.param === 'IdentityFile');
			assert.ok(IdentityFile.length === 1);
			
			SSHProcessInstance.setHostName('myhost2');
			SSHProcessInstance.addIdentityFileToSSHConfig('mynewkey');
			// @ts-expect-error
			var section = SSHProcessInstance.findSectionInSSHConfigFromHost('myhost2');
			// Check number of IdentityFile
			var IdentityFile = section.config.filter((e: any) => e.param === 'IdentityFile');
			assert.ok(IdentityFile.length === 2);
			// Check if one of IdentityFile has for value the new key added
			const newKey = IdentityFile.find((e: any) => e.value === 'mynewkey');
			assert.ok(newKey);
		});
		
		test('addNewHostInSSHConfig', async () => {
	
			const SSHProcessInstance = new SSHProcess();
	
			SSHProcessInstance.setHostName('myhost3');
	
			SSHProcessInstance.userName = 'myusername';
			await SSHProcessInstance.addNewHostInSSHConfig('myhost3');
			// @ts-expect-error
			const section = SSHProcessInstance.findSectionInSSHConfigFromHost('myhost3');
			assert.ok(section);
			var sshConnectionData = SSHProcessInstance.getNodeSSHConfig('myhost3');
			assert.deepStrictEqual(sshConnectionData, {
				host: "myhost3",
				username: "myusername",
			  });
		});
	
	});
});

