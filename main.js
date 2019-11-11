#!/usr/bin/env node

const {rgb, mix, reset} = require('nano-rgb')

let Client = require('ssh2-sftp-client');
let sftp = new Client();
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const readlineSync = require('readline-sync');
const homedir = require('os').homedir();
let passphrase = '';

const configDir = path.join(process.cwd(),'sync-config.json');
const configExampleDir = path.join(__dirname,'sync-config-example.json');

const theme = {
  info: rgb(0,80,255),
  warning: rgb(205, 205, 0),
  error: rgb(255,0,0),
  success: rgb(0,255,80)
}

let remoteConfig;
try {
  remoteConfig = require(configDir);
} catch (error) {
  console.log(mix(theme.error, 'Error: invalid/missing config'));
  if(readlineSync.keyInYN(mix(theme.success, 'Create empty config file?'))) {
    fs.copyFileSync(configExampleDir, configDir);
  }
  process.exit(0)
}

function spacer(message, length) {
  let _r = message;
  while (_r.length < length) _r += ' ';
  return _r;
}

async function establishSFTPConnection() {
  const {ssh_host, ssh_key, ssh_user,ssh_project_root} = remoteConfig;
  try {
    await sftp.connect({
      host: ssh_host,
      port: 22,
      username: ssh_user,
      privateKey: fs.readFileSync(ssh_key || `${homedir}/.ssh/id_rsa`),
      passphrase
    })
  } catch (error) {
    console.log(mix(theme.error, error.message));
    process.exit(0);
  }
  passphrase = '';
}
passphrase = readlineSync.question(theme.info + 'Enter Private Key Password: ' + reset(), { 
  hideEchoBack: true,
});
establishSFTPConnection();

const ignoreList = ['node_modules', '.git']

const watcher = chokidar.watch('.', {
  interval: 500,
  ignored: (path => ignoreList.some(s => path.includes(s)))
})

let watchReady = false;

watcher.on('all', (type, path) => {
  console.log(path);
  
})

watcher.on('change', (p) => {
  if(!watchReady) return;
  // TODO: Prettify output here
  console.log(p);
  // TODO: Create remote dir if it doesn't exist
  sftp.fastPut(p.replace(/\\/g, '/'), (remoteConfig.ssh_project_root + p).replace(/\\/g, '/'))
});

watcher.on('ready', () => {
  watchReady = true;
  console.log(mix(theme.info, 'Watching API for changes'));
})