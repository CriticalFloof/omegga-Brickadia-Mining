<!--

When uploading your plugin to github/gitlab
start your repo name with "omegga-"

example: https://github.com/Critical-Floof/omegga-Brickadia-Mining

Your plugin will be installed via omegga install gh:Critical Floof/Brickadia-Mining

-->

# Brickadia-Mining

A fully custom game mode for Brickadia built with typescript using [omegga](https://github.com/brickadia-community/omegga).

## Install

`omegga install gh:Critical Floof/Brickadia-Mining`

## Usage

Be sure to disable the following settings for your server via the Omegga Web UI:

Reload Players
Reload Bricks
Reload Minigames
Reload Environment

All this this behavior is handled by the game mode on restart, so having any of these options on may cause conflict.

When running this game mode, It's advised to disable autosaving as it's not going to be useful.

It's very reccomended to disable multi-client to avoid possible conflict. The plugin currently identifies players by name and can't differentiate 2 pawns with the same name.
