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

## Gotchas

Currently there are a few teething problems:

- Directories are not created for you;
- Additions/deletions are not handled, only changes;
- Updates to the package.json don't force a re-install;

Naturally these things are in the immediate road-map.
