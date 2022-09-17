import { copyHostConfigtoUserConfigFile, generateSSHkey, generateSSHkeyForce } from "./Commands";

export default [
    new generateSSHkey,
    new generateSSHkeyForce,
    new copyHostConfigtoUserConfigFile
];
