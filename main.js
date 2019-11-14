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
const homedir = require('os').homedir().replace(/\\/g, '/');
let passphrase = '';

const commandLineArgs = require('command-line-args')

const optionDefinitions = [
  { name: 'deploy', alias: 'd', type: Boolean },
]

const options = commandLineArgs(optionDefinitions)
let config = {};
const configDir = path.join(process.cwd(),'sync-config.json');
const configExampleDir = path.join(__dirname,'sync-config-example.json');

const theme = {
  info: rgb(0,80,255),
  warning: rgb(205, 205, 0),
  error: rgb(255,0,0),
  success: rgb(0,255,80)
}

try {
  config = {...require(configDir)}
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
let rootDir;
async function establishSFTPConnection() {
  
  try {
    await sftp.connect({
      host: config.ssh_host,
      port: 22,
      username: config.ssh_user,
      privateKey: fs.readFileSync(config.ssh_key || `${homedir}/.ssh/id_rsa`),
      passphrase
    })
  } catch (error) {
    console.log(mix(theme.error, error.message));
    process.exit(0);
  }
}

function establishSSHConnection() {
  return ssh.connect({
    host: config.ssh_host,
    username: config.ssh_user,
    privateKey: config.ssh_key || `${homedir}/.ssh/id_rsa`,
    passphrase
  })
}

function execute(command) {
  return ssh.exec(command, [], {
    cwd: config.ssh_project_root,
    onStdout(chunk) {
      process.stdout.write(chunk.toString('utf8'))
    }
  })
}

function executeSync(command) {
  return ssh.execCommand(command, {
    cwd: config.ssh_project_root,
  }).then(function(result) {
    console.error(result.stderr)
  })
}

const dirStructure = {
  folders: [],
  files: []
}

function initializeWatcher() {
  const ignoreList = ['node_modules', '.git']
  const watcher = chokidar.watch('.', {
    interval: 500,
    ignored: (path => ignoreList.some(s => path.includes(s)))
  })

  let watchReady = false;
  const root = config.ssh_project_root;
  if(root.charAt(root.length - 1) !== '/') {
    rootDir = root + '/'
  } else {
    rootDir = root;
  }

  watcher.on('all', (type, changePath) => {
    let sanitizedPath = changePath.replace(/\\/g, '/');
    if(!watchReady) {
      if(options.deploy) {
        if(sanitizedPath !== '.') {
          if(type === 'addDir' ) {
            dirStructure.folders.push(sanitizedPath)
          } else {
            dirStructure.files.push(sanitizedPath)
          }
        }
      }
      return
    }
  
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
}

async function start() {  
  passphrase = readlineSync.question(theme.info + 'Enter Private Key Password: ' + reset(), { 
    hideEchoBack: true,
  });  
  initializeWatcher();
  await establishSFTPConnection()
  await establishSSHConnection()
  if(options.deploy) {
    if(config.pre_deploy) {
      console.log('running config.pre_deploy');
      console.log(mix(theme.info, config.pre_deploy));
      await executeSync(config.pre_deploy)
    }
    console.log('beginning project transfer');
    let rootExists = await sftp.exists(config.ssh_project_root)
    if(rootExists === 'd') {
      console.log('purging project root');
      await ssh.execCommand(`rm -rf ${config.ssh_project_root}`)
      // await sftp.rmdir(config.ssh_project_root, true);
    }
    await sftp.mkdir(config.ssh_project_root, true);
    for (let i = 0; i < dirStructure.folders.length; i++) {
      const folder = dirStructure.folders[i];
      await sftp.mkdir(rootDir + folder, true)
    }
    for (let i = 0; i < dirStructure.files.length; i++) {
      const file = dirStructure.files[i];
      await sftp.fastPut(path.join(process.cwd(), file), rootDir + file)
    }
    if(config.post_deploy) {
      console.log('running post deploy');
      console.log(mix(theme.info, config.post_deploy));
      await executeSync(config.post_deploy)
    }
  } 
  
  if(config.ssh_tail_cmd) {
    execute(config.ssh_tail_cmd)
  }
}

start();

