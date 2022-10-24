# SSH key generator VSCode Extension

This VSCode Extension allows users to generate SSH key pair and deploy it on remote server.
So users can use Remote-SSH to connect to any remote server whithout enter any password. It fasters the connection.

For more security, the key is suffixed with the name of the host.
One key is used by only one host.

It provides several commands:

# Commands
* Generate SSH key
    * It will create SSH key only if the SSH connection is not working with the actual configuration
* Generate SSH Keys (Force: recreate if exists)
    * It will recreate an SSH key event if there is already one associated to the host
* Copy a host config from $HOME/.ssh/config to the SSH config file defined in the VSCode SSH setting
    * This command is a bit specific, it will copy the configuration from your ~/.ssh/config to the file set in the setting remote.SSH.configFile



