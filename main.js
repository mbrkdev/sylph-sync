#!/usr/bin/env node

const {rgb, mix, reset} = require('nano-rgb')
const Client = require('ssh2-sftp-client');
const node_ssh = require('node-ssh');
const ssh = new node_ssh()
const sftp = new Client();
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
const {ssh_host, ssh_key, ssh_user,ssh_project_root, ssh_tail_cmd} = remoteConfig;

async function establishSFTPConnection() {
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

async function establishSSHConnection() {
  await ssh.connect({
    host: ssh_host,
    username: ssh_user,
    privateKey: ssh_key,
    passphrase
  })
  ssh.exec(ssh_tail_cmd, [], {
    cwd: ssh_project_root,
    onStdout(chunk) {
      process.stdout.write(chunk.toString('utf8'))
    }
  })
}

passphrase = readlineSync.question(theme.info + 'Enter Private Key Password: ' + reset(), { 
  hideEchoBack: true,
});
establishSFTPConnection();
if(ssh_tail_cmd) {
  establishSSHConnection();
}

const ignoreList = ['node_modules', '.git']

const watcher = chokidar.watch('.', {
  interval: 500,
  ignored: (path => ignoreList.some(s => path.includes(s)))
})

let watchReady = false;

let rootDir;
const {ssh_project_root: root} = remoteConfig;
if(root.charAt(root.length - 1) !== '/') {
  rootDir = root + '/'
} else {
  rootDir = root;
}

watcher.on('all', (type, changePath) => {
  // console.log(type, changePath);

  if(!watchReady) return;
  let sanitizedPath = changePath.replace(/\\/g, '/');
  console.log(`${mix(theme.success, '  |  ' + spacer(type.toUpperCase(), 10) + '  >')}`, mix(theme.info, sanitizedPath));
  // console.log(rootDir, sanitizedPath);
  
  // TODO: Create remote dir if it doesn't exist
  switch (type) {
    case 'addDir':
      sftp.mkdir(rootDir + sanitizedPath, true);
      break;
    case 'change':
      sftp.fastPut(sanitizedPath, rootDir + sanitizedPath)
      break;
    case 'add':
      sftp.fastPut(sanitizedPath, rootDir + sanitizedPath)
      break;
    case 'unlinkDir':
      sftp.rmdir(rootDir + sanitizedPath, true)
      break;
    case 'unlink':
      sftp.delete(rootDir + sanitizedPath);
      break;
      
    default:
      console.log(type, changePath);
      
    break;
  }
})

watcher.on('ready', () => {
  watchReady = true;
  console.log(mix(theme.info, 'Watching API for changes'));
})