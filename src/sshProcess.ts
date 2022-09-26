import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as childProcess from "child_process";
import * as crypto from 'crypto';

import { log } from './services/logs';
import { Properties } from './Properties';
import { updateStatusBar } from './services/statusBar';
import { getRemoteServerFromUserInput, hostPickItem } from './RemoteServer';
import { CancelError } from './services/error';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NodeSSH } = require('node-ssh');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SSH_Config = require('ssh-config');



export class SSHProcess {
    userName: string|undefined = undefined;
    SSHPrivateKeyPath = '';
    SSHPublicKeyPath = '';
    SSHConfigFilePath: string;
    UserSSHConfigFilePath: string;
    VSCodeSSHConfigFilePath: string;
    SSHFolder: string;
    private hostname = '';
    remoteServer: any;
    homedir: string;
    SSHKeyName = '';
    custonConfig: boolean;
    retry = 0;
    createkey = false;


    constructor() {
        // this.userName = os.userInfo().username;

        this.homedir = os.homedir();
        this.SSHFolder = path.join(this.homedir, '.ssh');

        if (!fs.existsSync(this.SSHFolder)) {
            log(`Folder ${this.SSHFolder} doesn't exist. Create it`);
            fs.mkdirSync(this.SSHFolder, {recursive: true});
        }

        this.UserSSHConfigFilePath = path.join(this.SSHFolder, 'config');
        if (!fs.existsSync(this.UserSSHConfigFilePath)) {
            log(`File ${this.UserSSHConfigFilePath} doesn't exist. Create it`);
            fs.writeFileSync(this.UserSSHConfigFilePath, '', 'utf8');
        }


        this.VSCodeSSHConfigFilePath = new Properties().getRemoteSSHConfigFile();

        if (this.VSCodeSSHConfigFilePath) {
            this.custonConfig = true;
            this.SSHConfigFilePath = this.VSCodeSSHConfigFilePath;
        } else {
            this.custonConfig = false;
            this.SSHConfigFilePath = this.UserSSHConfigFilePath;
        }
        if (!fs.existsSync(this.SSHConfigFilePath)) {
            log(`File ${this.SSHConfigFilePath} doesn't exist. Create it`);
            fs.writeFileSync(this.SSHConfigFilePath, '', 'utf8');
        }

    }

    /*
    * Useful when the command are called from an other extension and it provides already a hostname
    */
    public setHostName(hostName: string) {
        this.hostname = hostName;
        this.setSSHKeyName();
    }

    /*
    * Entry point to start the process of SSH key creation
    */
    public async run(recreateKey = false) {

        // No hostname provided during the call of the command,
        // Ask the user to select one
        if (!this.hostname) {
            const hostsList = await this.getHostsFromSSHConfig();

            const hostname = await getRemoteServerFromUserInput(hostsList);
    
            this.setHostName(hostname);

        }

        // These 2 calls will update/create the config in ~/.ssh/config with username and hostname
        this.userName = await this.getUserName();
        await this.addNewHostInSSHConfig(this.hostname);


        this.setSSHKeyName();

        // recreate the key is explicity asked or if the current key are not working anymore
        const createkey = recreateKey ? true : !await this.checkSSHconnection();
        if (recreateKey) {
            this.removeSSHKey(); 
        }

        if (createkey) {
    
            await this.addIncludeInMainSSHConfig();
    
            await this.isHostReachable(this.hostname);
    
            await this.generateSSHKey();
    
            await this.copyPublicKey();
    
            this.addIdentityFileToSSHConfig();
    
            // Validate the new SSH configuration
            const result = await this.checkSSHconnection();
            if (!result) {
                throw new Error('Failed to connect to the remote server with the new key pair');
            }
        }

        updateStatusBar(undefined);
        return this.hostname;
    }

    /*
    * remove SSH key, used when we want to recreate the key
    */ 
    private removeSSHKey() {
        const options = { force : true};
        fs.rmSync(this.SSHPrivateKeyPath, options);
        fs.rmSync(this.SSHPublicKeyPath, options);
    }

    /*
    * Define the name and path of the keys based on the hostname value
    */
    private setSSHKeyName() {
        const words = this.hostname.split('.');

        this.SSHKeyName = `id_rsa-vscode-${words[0]}`;

        this.SSHPrivateKeyPath = path.join(this.SSHFolder, this.SSHKeyName);
        this.SSHPublicKeyPath = this.SSHPrivateKeyPath + ".pub";
    }

    private async addIncludeInMainSSHConfig() {
        if (this.custonConfig) {
            const filename = path.basename(this.SSHConfigFilePath);
            const section = this.findSectionInSSHConfigFromInclude(filename);

            if (!section) {
                const SSHConfigContent = fs.readFileSync(this.UserSSHConfigFilePath, 'utf8');
                const config = SSH_Config.parse(SSHConfigContent);

                // Put Include just after all include already in the SSH conf thanks to the paramter true
                config.prepend({
                    Include: filename
                }, true);

                fs.writeFileSync(this.UserSSHConfigFilePath, SSH_Config.stringify(config), 'utf8');

            }
        }
    }


    /*
    * Check if the host is reachable. 
    * It valides the internet connection, the VPN activation, and if the host exists
    */
    private async isHostReachable(hostname: string): Promise<boolean> {
        updateStatusBar(`Checking if ${hostname} is reachable...`);

        log(`Checking if ${hostname} is reachable...`);
        const sshConnectionData = this.getNodeSSHConfig(hostname);
        if (!Object.keys(sshConnectionData).length) {
            throw new Error(`${hostname} is not defined in the SSH config file.`);
        }
        delete sshConnectionData.privateKey;
        const result = await this.runSSHConnection(sshConnectionData);
        if (result.error) {
            if (result.error.code === 'ENOTFOUND') {
                throw new Error(`${hostname} unreachable. Please check:\n * your internet connection, \n * your VPN, \n * the name of the host\n\nError: ${result.error.message}`);
            }
            if (result.error.message !== 'All configured authentication methods failed') {
                // Don't throw an error when the ssh connection could not be etablished, We simply check if the host is reachable
                throw new Error(`Error: ${result.error.code}`);
            }
        }
        return result.result;
    }

    /*
    * Test the SSH connection to the host
    */
    private async runSSHConnection(sshConnectionData: any): Promise<{result: boolean, error: any}> {
        log('-- Execute runSSHConnection with the config:', sshConnectionData);

        const ssh = new NodeSSH();

        return await ssh.connect(sshConnectionData).then(async () => {
            log("Connection ok");
            return {
                result: true,
                error: null
            };
        }, async (error: any) => {
            log('Error when testing the connection', error);
            return {
                result: false,
                error: error
            };
        });
    }

    /*
    *   Generate the ssh key pair
    */
    private async generateSSHKey() {
        updateStatusBar(`Generating SSH key...`);
        log(`Generate SSHConfig`);
        const exec = util.promisify(childProcess.exec);

        if (!fs.existsSync(this.SSHPrivateKeyPath)) {
            log(`File ${this.SSHPrivateKeyPath} doesn't exist create it`);
            // "A man-in-the-middle attacker can exploit this vulnerability to record the communication to decrypt the session key and even the messages. 
            // DSA keys and RSA keys shorter than 2048 bits are considered vulnerable.
            // It is recommended to install a RSA public key length of at least 2048 bits or greater, or to switch to ECDSA or EdDSA."
            const cli = 'ssh-keygen -t rsa -b 4096 -N "" -f ' + this.SSHPrivateKeyPath;

            try {
                await exec(cli);

            } catch (error: any) {
                if (error && (error.toString().includes('command not found') || error.toString().includes('is not recognized'))) {
                    log('ssh-keygen is not recognized, try with crypto');
                    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                        modulusLength: 4096,
                        publicKeyEncoding: {
                          type: 'spki',
                          format: 'pem'
                        },
                        privateKeyEncoding: {
                          type: 'pkcs8',
                          format: 'pem'
                        }
                      });
                  
                      fs.writeFileSync(this.SSHPublicKeyPath, publicKey, { encoding: 'utf-8' });
                      fs.writeFileSync(this.SSHPrivateKeyPath, privateKey, { encoding: 'utf-8' });

                      if (fs.existsSync(this.SSHPublicKeyPath) || fs.existsSync(this.SSHPrivateKeyPath)) {
                          throw new Error('Failed to create SSH Key pair');
                      }
                }
            }

        } else {
            log(`File: ${this.SSHPrivateKeyPath} already exists`);
        }
    }

    /*
    * Copy the public key on the remote server and configure the permission
    * It will ask the username password
    * After 3 retries of wrong password we stop the process
    */
    private async copyPublicKey() {
        // Let 
        ++this.retry;
        log(`Copy SSH key`);

        const options: vscode.InputBoxOptions = {
            prompt: `Enter the password of ${this.userName} to copy your SSH keys on ${this.hostname}`,
            ignoreFocusOut: true,
            password: true
        };

        return await vscode.window.showInputBox(options)
            .then(async password => {

                if (password === '') {
                    log("Password empty");
                    throw new Error('Password empty');

                } else if (password === undefined) {
                    log("Host: User cancel the box");
                    throw new CancelError('User canceled the box Password');
                }

                const ssh = new NodeSSH();
                const sshConnectionData = this.getNodeSSHConfig(this.hostname);
                sshConnectionData.tryKeyboard = true;
                sshConnectionData.password = password;

                const publicKeyContent = fs.readFileSync(this.SSHPublicKeyPath);

                const result = await ssh.connect(sshConnectionData).then(async () => {
                    log(`Connection etablished to: ${this.hostname}`);

                    // If too many error with the echo '${publicKeyContent}'
                    // used this other method
                    // return await ssh.putFiles([{ local: this.SSHPublicKeyPath, remote: 'id_rsa-vscode.pub' }]).then(async () => {
                    //    const command = 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat ~/id_rsa-vscode.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm -rf ~/id_rsa-vscode.pub';


                    // https://code.visualstudio.com/docs/remote/troubleshooting#_enabling-alternate-ssh-authentication-methods
                    const command = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${publicKeyContent}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;

                    log(command);
                    return await ssh.execCommand(command, {}).then(function (_result: any) {
                        if (_result.code === 1) {
                            log("Error to execute the command:" + _result.stderr);
                            throw new Error(`Failed to execute the following command\n ${command}\n\nError: ${_result.stderr}`);
                        }

                        return true;

                    },
                        function (error: any) {
                            log("Failed to execute the command: " + command);
                            log(error);
                            throw new Error(`Failed to execute the following command\n ${command}\n\nError: ${error.message}`);

                        });

                }, async () => {
                    log(`Permission denied: wrong password, failed to connect to ${this.hostname}`);
                    if (this.retry >= 3) {
                        throw new Error(`Permission denied: wrong password, failed to connect to ${this.hostname}`);
                    }
                    return await this.copyPublicKey();
                });

                return result;
            },
                () => {
                    throw 'rejected'
                });
    }

    /*
    * Check if we can connect to the host with the current configuration (key)
    *
    */
    public async checkSSHconnection(): Promise<boolean> {

        const sshConnectionData = this.getNodeSSHConfig(this.hostname);
        let result: any;
        if (sshConnectionData.privateKey) {
            log("privateKey already defined in the SSH config");
            result = await this.runSSHConnection(sshConnectionData);
        } else {
            log("Check all default private keys");
            const files: any = [];
            files.push(null);
            // SSH protocole only check by default all these keys even if not in the SSH config file
            // https://man7.org/linux/man-pages/man5/ssh_config.5.html
            const defaultSSHConfig = ['id_rsa',
                'id_dsa',
                'identity',
                'id_ecdsa',
                'id_ecdsa_sk',
                'id_ed25519',
                'id_ed25519_sk'
            ];

            fs.readdirSync(this.SSHFolder).forEach(filename => {
                if (path.extname(filename) === ".pub" && defaultSSHConfig.includes(path.parse(filename).name)) {
                    files.push(path.parse(filename).name);
                }
            });

            let sshConnectionDataTmp: any = {};
            for (const sshKeyName of files) {
                sshConnectionDataTmp = sshConnectionData;

                if (sshKeyName) {
                    sshConnectionDataTmp.privateKey = path.join(this.SSHFolder, sshKeyName);
                }

                result = await this.runSSHConnection(sshConnectionDataTmp);

                if (result.result) {
                    this.addIdentityFileToSSHConfig(path.join(this.SSHFolder, sshKeyName));
                    break;
                }
            }
        }

        return result.result;
    }


    public async getHostsFromSSHConfig() {
        let config: any;

        const existingSSHHost: hostPickItem[] = [];
        if (fs.existsSync(this.SSHConfigFilePath)) {
            log(`SSH config file exists in ${this.SSHConfigFilePath}`);
            const SSHConfigContent = fs.readFileSync(this.SSHConfigFilePath, 'utf8');
            config = SSH_Config.parse(SSHConfigContent);

            for (const SSHhost of config) {
                if (SSHhost.param.toUpperCase() === 'Host'.toUpperCase()) {
                    existingSSHHost.push(
                        {
                            label: SSHhost.value,
                            hostname: SSHhost.config[0].value
                        }
                    );
                }
            }
        }
        return existingSSHHost;
    }

    public async addNewHostInSSHConfig(newHostname: string) {

        const section = this.findSectionInSSHConfigFromHost(this.hostname);

        if (!section) {
            log(`Add the new host ${newHostname} in the SSH config`);
            const SSHConfigContent = fs.readFileSync(this.SSHConfigFilePath, 'utf8');
            const config = SSH_Config.parse(SSHConfigContent);

            config.append({
                Host: newHostname,
                HostName: newHostname,
                User: this.userName,
                StrictHostKeyChecking: 'accept-new',
                // Don't add the IdentityFile until we push it on the server
                // IdentityFile: [this.SSHPrivateKeyPath]
            })

            fs.writeFileSync(this.SSHConfigFilePath, SSH_Config.stringify(config), 'utf8');
        } else {
            log(`Host ${newHostname} already in the SSH config`);
            const userdefined = section.config.find((element:any) => element.param.toLowerCase() === 'username');
            if (!userdefined) {
                this.addUserNameToSSHConfig();
            }
        }
    }

    /*
    *   Update the current SSH config file to add the UserName to the host selected previously by the user
    */
    public addUserNameToSSHConfig() {
        log("function addIdentityFile")
        const section = this.findSectionInSSHConfigFromHost(this.hostname);
        const IdentityFile: Array<string> = [];

        // Create a new SSHConfig from the one found. Not possible to edit an existing one
        const newSSHConfig: any = {
            Host: this.hostname,
            User : this.userName
        };
        for (const line of section.config) {
            newSSHConfig[line.param] = line.value;

            if (line.param === 'IdentityFile') {
                IdentityFile.push(line.value);
            }
        }
        newSSHConfig.IdentityFile = IdentityFile;


        log('Update the SSH config to add the userName with the following config', newSSHConfig);


        const SSHConfigContent = fs.readFileSync(this.SSHConfigFilePath, 'utf8');
        const config = SSH_Config.parse(SSHConfigContent);
            
        config.remove((line: { param: string; value: string; }) => line.param && line.param.toLowerCase() === 'Host'.toLowerCase() && line.value === this.hostname);

        if (config && config[0] !== undefined) {
            config[0]['before'] = "\n";
        }
        config.append(newSSHConfig);

        // config = configtmp.concat(config);
        fs.writeFileSync(this.SSHConfigFilePath, SSH_Config.stringify(config), 'utf8');

    }

    /*
        Update the current SSH config file to add the IdentityFile to the host selected previously by the user
    */
    public addIdentityFileToSSHConfig(identityFilePath?: string) {
        log("function addIdentityFile")
        const section = this.findSectionInSSHConfigFromHost(this.hostname);
        const IdentityFile: Array<string> = [];


        // Create a new SSHConfig from the one found. Not possible to edit an existing one
        const newSSHConfig: any = {
            Host: this.hostname
        };
        for (const line of section.config) {
            newSSHConfig[line.param] = line.value;

            if (line.param === 'IdentityFile') {
                IdentityFile.push(line.value);
            }
        }
        newSSHConfig.IdentityFile = IdentityFile;


        if (IdentityFile.length && (
            (identityFilePath && IdentityFile.includes(identityFilePath)) || 
                (!identityFilePath && IdentityFile.includes(this.SSHPrivateKeyPath))
            )) {
            log(`Identify file with ${this.SSHPrivateKeyPath} already exists in SSH config. Nothing to update`);

        } else {
            if (identityFilePath) {
                IdentityFile.push(identityFilePath);
            } else {
                IdentityFile.push(this.SSHPrivateKeyPath);
            }

            log('Update the SSH config to add the identifyFile with the following config', newSSHConfig);

            // Create a new config, to be able to put the new host on the top
            // var configtmp = SSH_Config.parse('');        
            // configtmp.append(newSSHConfig);

            // remove the old host config
            const SSHConfigContent = fs.readFileSync(this.SSHConfigFilePath, 'utf8');
            const config = SSH_Config.parse(SSHConfigContent);
            
            config.remove((line: { param: string; value: string; }) => line.param && line.param.toLowerCase() === 'Host'.toLowerCase() && line.value === this.hostname);

            if (config && config[0] !== undefined) {
                config[0]['before'] = "\n";
            }
            config.append(newSSHConfig);

            // config = configtmp.concat(config);
            fs.writeFileSync(this.SSHConfigFilePath, SSH_Config.stringify(config), 'utf8');
        }
    }

    /*
    * Get the username to connect to the remote server.
    * if defined in the conf return it
    * if already in the SSH conf use it for the specific hostname
    * Otherwise get it from the user input
    */
    private async getUserName() {

        const defaultUsername = new Properties().getUsername();

        if (defaultUsername) {
            return defaultUsername;
        }

        if (fs.existsSync(this.SSHConfigFilePath)) {
            log(`SSH config file exists in ${this.SSHConfigFilePath}`);
           const section = this.findSectionInSSHConfigFromHost(this.hostname)
            if (section) {
                for (const line of section.config) {
                    if (line.param) {
                        if (line.param.toLowerCase() === 'User'.toLowerCase()) {
                            return line.value;
                        }
                    }
                }
            }
        }

        return await this.getUserNameFromInputBox();

    }

    /*
    * Display an inputBox to let the user provide the username used to perform the ssh
    */
    private async getUserNameFromInputBox() {

        log("Provide the username to connect to the remote server");
        const options: vscode.InputBoxOptions = {
            prompt: `Write your username to connect to the remote server ${this.hostname}`,
            ignoreFocusOut: true
        };

        const ouput = await vscode.window.showInputBox(options);
        let userName = '';

        if (ouput) {
            userName = ouput;
        } else if (ouput === '') {
            log("No username: user did not type anything");
            throw new CancelError('User did not provide any username');

        } else if (ouput === undefined) {
            log("username: User cancel the box");
            throw new CancelError('User canceled the box username');
        }

        return userName;
    }

    public getNodeSSHConfig(hostname: string) {
        const section = this.findSectionInSSHConfigFromHost(hostname);
        const sshConnectionData: any = {};
        if (section) {
            for (const line of section.config) {
                if (line.param) {
                    if (line.param.toUpperCase() === 'User'.toUpperCase()) {
                        sshConnectionData.username = line.value;
                    }
                    if (line.param.toUpperCase() === 'Port'.toUpperCase()) {
                        sshConnectionData.port = line.value;
                    }
                    if (line.param.toUpperCase() === 'Hostname'.toUpperCase()) {
                        sshConnectionData.host = line.value;
                    }
                    if (line.param.toUpperCase() === 'IdentityFile'.toUpperCase()) {
                        sshConnectionData.privateKey = line.value.replace('~', this.homedir);
                    }
                }
            }
        }
        // If username is not defined in the SSH config use the one get from the quickpick
        if (!sshConnectionData.username && this.userName) {
            sshConnectionData.username = this.userName;
        }
        return sshConnectionData;
    }

    // Get the conf from the SSH config
    private findSectionInSSHConfigFromInclude(includeValue: string) {
        return this.findSectionInSSHConfig('Include', includeValue);
    }

    // Get the conf from the SSH config
    private findSectionInSSHConfigFromHost(hostname: string) {
        return this.findSectionInSSHConfig('Host', hostname);
    }

    // Get the conf from the SSH config
    private findSectionInSSHConfig(param: string, value: string) {
        const SSHConfigContent = fs.readFileSync(this.SSHConfigFilePath, 'utf8');
        const config = SSH_Config.parse(SSHConfigContent);

        // Can't used the easy way proposed in the documentation. 
        // The find is done using the case if the configuration use lowerCase, upperCase it won't work
        // const section = config.find({ Host: hostname });
        return config.find((line: { param: string; value: string; }) => line.param && line.param.toLowerCase() === param.toLowerCase() && line.value === value);
    }

    public async copySSHConfig(hostname: string) {
        log('function copySSHConfig');

        if (!this.VSCodeSSHConfigFilePath) {
            return;
        }
        const section = this.findSectionInSSHConfigFromHost(hostname);
        let  newSSHConfig: any = {};
        if (section) {
            newSSHConfig = {
                Host: hostname
            };

            for (const line of section.config) {
                newSSHConfig[line.param] = line.value;
                console.log(line);
            }
        }

        if (newSSHConfig) {
            const VSCodeSSHConfigContent = fs.readFileSync(this.VSCodeSSHConfigFilePath, 'utf8');
            const VScodeconfig = SSH_Config.parse(VSCodeSSHConfigContent);

            VScodeconfig.append(newSSHConfig);
            fs.writeFileSync(this.VSCodeSSHConfigFilePath, SSH_Config.stringify(VScodeconfig), 'utf8');
        }
    }
    
}
