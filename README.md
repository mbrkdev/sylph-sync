# Sylph Sync

A developer tool for syncing a local Sylph development environment to a remote compute instance over SFTP.

## Motivation

The main reason I had to build this was when I started experimenting with webhooks; I wanted to develop the API and see changes in real time but the best way to do that was to drag my ```server``` folder over to the server project directory and then run ```pm2 reload all``` to restart the Sylph instance. 