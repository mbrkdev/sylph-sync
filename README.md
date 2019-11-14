# Sylph Sync

A developer tool for syncing a local Sylph development environment to a remote compute instance over SFTP.

## Motivation

The main reason I had to build this was when I started experimenting with webhooks; I wanted to develop the API and see changes in real time but the best way to do that was to drag my ```server``` folder over to the server project directory and then run ```pm2 reload all``` to restart the Sylph instance. 

## Usage

```bash
npm i -g sylph-sync
```

Make sure you have a ```sync-config.json``` file in your project directory. If not then running the ```sylph-sync``` command will generate a blank one for you.

Set everything in that config file and then run:

```bash
npx sylph-sync # or sylph-sync
```

If properly configured; every change in your local ```server``` folder or ```package.json``` should reflect instantly to the remote target.

## Deploy

In order to start the sylph-sync from a blank slate you can pass the ```--deploy``` flag, this will delete and re-create the project directory on the server. It's importand that you handle the pre- and post- deploy commands in the config file or things may not reload as expected. 

Example:

```js
{
  "pre_deploy": "pm2 delete all",
  "post_deploy": "yarn && pm2 start main.js --watch && pm2 save"
}
```

Between pre- and post- deploy, the entire project root is destroyed and replaced with your working directory.

## Gotchas

- Renames are not handled;
