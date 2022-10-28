import OmeggaPlugin, { OL, PS, PC, WriteSaveObject, Brick, OmeggaPlayer, IPlayerPositions, Vector } from 'omegga';
import * as permissions from 'src/permissions';
import * as initalization from 'src/gameInitalization';
import * as playerSystem from 'src/playerSystem';
import * as utility from 'src/utility';
import * as commands from 'src/commands';
import * as NpcSystem from 'src/npcSystem';

import { createNoise3D, NoiseFunction3D } from 'simplex-noise';
import { Players, Server, Surfaces } from 'src/pluginTypes';
import { addMineMatcher, addNPCMatcher } from 'src/matchers/debounceInteract';


type Config = any;
type Storage = any;

const VERSION = "0.0.1"
const CELL_SIZE = 2;
const GROUND_SIZE = 32;
const CHUNK_SIZE = 1024;

let bInitalizedMatchers = false;

let ServerData:Server;
let SurfacesData:Surfaces = {};
let PlayersData:Players = {};
let gameLoop = {state:false};
let loadedNoiseFunctions:{[index:string]: NoiseFunction3D} = {}
let autoStoreInterval:number;



export default class Plugin implements OmeggaPlugin<Config, Storage> {
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;

  constructor(omegga: OL, config:PC<Config>, store: PS<Storage>) {
    Omegga = omegga;
    this.config = config;
    this.store = store;
  }
  /* 
  We need a way to load bricks into the world based off inputs from players

  ALL data is stored internally within the plugin without need for brickadia or omegga

  To prevent data from being excessively large, objects contain a reference to what they are, instead of all being instances of a class.


  */
  async init() {
    Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining Initalizating...`);
    //Setting up Matchers
    
    Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining`);
    Omegga.broadcast(`<color="33bbff"><size="16">></></> version ${VERSION}`);

    Omegga.on('join', (player:OmeggaPlayer) => {
      if(!gameLoop.state) return;
      if(PlayersData[player.name] === undefined){
        console.info('New player detected. Generating player template...')
        PlayersData[player.name] = initalization.initalizePlayer(player.name)
        console.info(`Player ${player.name}'s data has been stored at ' PlayersData[${player.name}] '`)
      }
    })

    Omegga.on('leave', async (player:OmeggaPlayer) => {
      if(!gameLoop.state) return;
      NpcSystem.clearUI(PlayersData[player.name])
      console.info("Forcing playerData Store.")
      await this.store.set('Players',PlayersData);
    })
    //A fair amount of this could be wrapped and offloaded to another module, remember to do so.
    Omegga.on('cmd:start-mining', async (speaker:string) => {
      if(!permissions.getPermission(speaker,this.config['authorized-role'])) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> The game is already running!`);return;};

      Omegga.broadcast(`<color="33bbff"><size="16">></></> Starting Brickadia Mining...`);
      console.info("Starting Brickadia Mining...")

      //First start checking
      if(await this.store.get('Server') === undefined || this.config['clear-gamedata'] === true){
        console.info("First time start. Creating new server template...")
        let BlankData = initalization.initalizeGame();
        await this.store.set('Players',BlankData.Players);
        await this.store.set('Server',BlankData.Server);
        await this.store.set('Surfaces',BlankData.Surfaces);
        
      } else {
        console.info("Game saveData Found.")
      }

      //Data version checking and Update migrations
      if(!initalization.checkGameVersion(VERSION, await this.store.get('Server'))) {
        console.info("Game Version is incompatible with savedata. Checking for Migration paths...")
        //Function for migration checking and correction goes here. Until then version updates will potentially clear data (still better than crashing)
        console.info("No Migration Paths found. Creating new server template...")
        let BlankData = initalization.initalizeGame();
        await this.store.set('Players',BlankData.Players);
        await this.store.set('Server',BlankData.Server);
        await this.store.set('Surfaces',BlankData.Surfaces);
      } else {
        console.info("Game saveData verified.")
      }
      //Initalization of live server variables.
      PlayersData = await this.store.get('Players');
      ServerData = await this.store.get('Server');
      SurfacesData = await this.store.get('Surfaces');
      console.info("Game saveData initalized.")

      //gamestate for matchers to reference
      let gameState = {
        gameLoop: gameLoop,
        serverData: ServerData,
        surfacesData: SurfacesData,
        playersData: PlayersData
      }

      //matchers initalization
      if(!bInitalizedMatchers) {
        addMineMatcher(gameState);
        addNPCMatcher(gameState);
        bInitalizedMatchers = true;
      }

      //Store Autosave Setup
      autoStoreInterval = setInterval(async ()=>{
        console.info("Saving Store Data...")
        await this.store.set('Players',PlayersData);
        await this.store.set('Server',ServerData);
        await this.store.set('Surfaces',SurfacesData);
        console.info("Store Data has been Autosaved!")
      },60000*this.config['autosave-interval'])

      //Noise function generation
      console.info("Creating Noise Functions...")
      const SurfacesKeys = Object.keys(SurfacesData)
      for (let i = 0; i < SurfacesKeys.length; i++) {
        const seed = SurfacesData[SurfacesKeys[i]].surfaceSeed
        const surfaceNoise = createNoise3D(()=>{return seed});
        loadedNoiseFunctions[SurfacesKeys[i]] = surfaceNoise
      }
      
      //Loading Map Procedure
      Omegga.clearAllBricks()
      Omegga.loadBricks('BrickadiaMining-Structures/SpawnZoneNauvis', {quiet:false})

      //Offset ground Positions
      SurfacesData['Nauvis'].coordinateData = playerSystem.mineGround(ServerData, SurfacesData['Nauvis'],[0,0,0],[16,16,16],loadedNoiseFunctions,"rectangular",0,8,8,0)


      //Teleporting relevant players
      //Ideally the code would teleport people to a spawn brick without killing them, but since we dont know that information currently, we expicitly teleport them to the rough location of spawn.
      const players = await Omegga.getPlayers();
      players.forEach(player => {
        Omegga.writeln(`Chat.Command /TP "${player.name}" ${-800+120*Math.random()} ${580+120*Math.random()} ${1_040_502} 0`);
      });
      

      //Gameloop set
      gameLoop.state = true;

      Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining started!`);
      
    }),
    
    Omegga.on('cmd:stop-mining', (speaker:string) => {
      if(!permissions.getPermission(speaker,"Admin")) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(!gameLoop.state) {Omegga.whisper(speaker, "The game isn't running!");return;};

      Omegga.broadcast(`Stopping Brickadia Mining...`);
      //gameloop clean up.
      //Stopping autoStoreInterval
      clearInterval(autoStoreInterval);
      //Gameloop set
      gameLoop.state = false;

      Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining stopped.`);
      
    });


    //USER COMMANDS SECTION
    //All commands are used to interact with the game, Some affect user preference settings, some are context based, most commands will have a shorthand version for ease of access.

    //Viewing Inventory
    Omegga.on('cmd:inventory', (speaker:string, page:string = "1", filter:string = "all") => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      commands.viewInventory(speaker,PlayersData,parseInt(page),filter)
    });
    Omegga.on('cmd:i', (speaker:string, page:string = "1", filter:string = "all") => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      commands.viewInventory(speaker,PlayersData,parseInt(page),filter)
    });
    //Viewing Balance
    Omegga.on('cmd:balance', (speaker:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      commands.viewBalance(speaker,PlayersData[speaker])
    });
    Omegga.on('cmd:bal', (speaker:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      commands.viewBalance(speaker,PlayersData[speaker])
    });
    Omegga.on('cmd:viewquest', (speaker:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      commands.viewQuests(PlayersData[speaker])
    });
    Omegga.on('cmd:cancelquest', (speaker:string, option:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = commands.cancelQuest(PlayersData[speaker],parseInt(option))
    });

    //CONTEXT COMMANDS SECTION
    Omegga.on('cmd:option', async (speaker:string, option:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = await commands.option(speaker,PlayersData[speaker], parseInt(option))
    });
    Omegga.on('cmd:exit', (speaker:string, option:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = commands.exit(speaker,PlayersData[speaker])
    });
    Omegga.on('cmd:buy', (speaker:string, amount:string, ...itemName:string[]) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = commands.buy(speaker,PlayersData[speaker],itemName,amount)
    });
    Omegga.on('cmd:sell', (speaker:string, amount:string, ...itemName:string[]) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = commands.sell(speaker,PlayersData[speaker],itemName,amount)
    });

    //DEV COMMANDS SECTION

    Omegga.on('cmd:enable-dev-mode', async (speaker:string) => {
      if(!permissions.getPermission(speaker,this.config['authorized-role'])) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker].bDevMode = !(PlayersData[speaker].bDevMode)
      Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> DevMode set to ${PlayersData[speaker].bDevMode}!`)
    });
    Omegga.on('cmd:remote-sell', async (speaker:string, ...item:string[]) => {
      if(!permissions.getPermission(speaker,this.config['authorized-role'])) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      let playerData = PlayersData[speaker]
      let newItem = item.join(" ")
      newItem = newItem.toLowerCase()
      //Selling all materials
      if(newItem === "all"){
        let sellTotal = 0;
        const inventoryKeys = Object.keys(playerData.inventory)
        for (let i = 0; i < inventoryKeys.length; i++) {
          if(playerData.inventory[inventoryKeys[i]].type !== "ground" || playerData.inventory[inventoryKeys[i]].name === "Dirt") continue;
          sellTotal += playerData.inventory[inventoryKeys[i]].amount * (ServerData.discoveredMineables.valuableMineables[playerData.inventory[inventoryKeys[i]].name].baseHealth/5 * ServerData.serverSellMultiplier);
          playerData.inventory[inventoryKeys[i]] = undefined
        }
        playerData.credits += sellTotal
        Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> Sold all Materials for ${sellTotal}!`)
      } else {
        
        //Selling one material
        if(playerData.inventory[newItem].type !== "ground" || playerData.inventory[newItem].name === "Dirt") {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This item cannot be sold.`);return;};
        let sellTotal = 0;
        sellTotal = playerData.inventory[newItem].amount * (ServerData.discoveredMineables.valuableMineables[playerData.inventory[newItem].name].baseHealth/5 * ServerData.serverSellMultiplier)
        playerData.credits += sellTotal
        playerData.inventory[newItem] = undefined
        Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> Sold ${newItem} for ${sellTotal}!`)
      }

    });
    Omegga.on('cmd:getgameposition', async (speaker:string) => {
      const playerPositions:IPlayerPositions = await Omegga.getAllPlayerPositions();
      playerPositions.forEach(IPP => {
        if(IPP.player.name === speaker){
          const gamePosition = utility.absolutePositionToGamePosition(IPP.pos as Vector)
          Omegga.whisper(speaker, `Your game position is (${gamePosition.relativePosition[0]},${gamePosition.relativePosition[1]},${gamePosition.relativePosition[2]}) in chunk (${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]})`)
        }
      });
    });

    Omegga.on('minebrick', ({ player, position }) => {
      let t0 = Date.now();
      console.log("-----\nStarting Interact Time Evaluation...")

      const gamePosition = utility.absolutePositionToGamePosition(position);
      let playerData = PlayersData[player.name];
      //Clear the UI to prevent players from mining while still talking to an NPC.
      NpcSystem.clearUI(playerData)

      try {
        //If cell's health is over 0, decrease it by pickaxe damage
      
        let selectedCell = SurfacesData['Nauvis'].coordinateData[`${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]}`][`${gamePosition.relativePosition[0]},${gamePosition.relativePosition[1]},${gamePosition.relativePosition[2]}`]
        selectedCell.health -= Math.round(playerData.inventory[playerData.hand].damage*playerData.inventory[playerData.hand].level)
        if(selectedCell.health > 0 && !(PlayersData[player.name].bDevMode)){
          if(ServerData.discoveredMineables.allMineables[selectedCell.name].class['valuable']){
            Omegga.middlePrint(player.name,
              `${selectedCell.name}: ${selectedCell.health}<br>Worth <color="33dd33">¢${(ServerData.discoveredMineables.valuableMineables[selectedCell.name].baseHealth/5 * ServerData.serverSellMultiplier)}</>`
              )
          } else {
            Omegga.middlePrint(player.name,
              `${selectedCell.name}: ${selectedCell.health}`
              )
          }
        } else {

          if (Date.now() - PlayersData[player.name].lastMineCall < 334) return;
          PlayersData[player.name].lastMineCall = Date.now()

          if(ServerData.discoveredMineables.allMineables[selectedCell.name].class['valuable']){
            Omegga.middlePrint(player.name,
              `Mined ${selectedCell.name}!<br>Worth <color="44ff44">¢${(ServerData.discoveredMineables.valuableMineables[selectedCell.name].baseHealth/5 * ServerData.serverSellMultiplier)}</>`
              )
          } else {
            Omegga.middlePrint(player.name,
              `Mined ${selectedCell.name}!`
              )
          }

          const mineMethod = PlayersData[player.name].inventory[PlayersData[player.name].hand].mineMethod
          const effectSize = PlayersData[player.name].inventory[PlayersData[player.name].hand].effectSize

          SurfacesData['Nauvis'].coordinateData = playerSystem.mineGround(ServerData, SurfacesData['Nauvis'], gamePosition.chunkPosition, gamePosition.relativePosition, loadedNoiseFunctions,mineMethod,effectSize,effectSize,effectSize,effectSize)
          if(ServerData.discoveredMineables.crustMineables[selectedCell.name] !== undefined){
            if(playerData.inventory['Dirt'] === undefined) {
              playerData.inventory['Dirt'] = {
                name:'Dirt',
                type:selectedCell.type,
                amount:0
              }
            }
            playerData.inventory["Dirt"].amount += 1
          } else {
            if(playerData.inventory[selectedCell.name] === undefined) {
              playerData.inventory[selectedCell.name] = {
                name:selectedCell.name,
                type:selectedCell.type,
                amount:0
              }
            }
            playerData.inventory[selectedCell.name].amount += 1
          }
          
        }
      } catch (error) {
        console.error("Tried to access a cell that doesn't exist, forcing mineGround().")
        const mineMethod = PlayersData[player.name].inventory[PlayersData[player.name].hand].mineMethod
        const effectSize = PlayersData[player.name].inventory[PlayersData[player.name].hand].effectSize
        SurfacesData['Nauvis'].coordinateData = playerSystem.mineGround(ServerData, SurfacesData['Nauvis'], gamePosition.chunkPosition, gamePosition.relativePosition, loadedNoiseFunctions, mineMethod, effectSize,effectSize,effectSize,effectSize)
      }

      let t1 = Date.now();
      console.log(`Interaction function took ${t1-t0}ms to complete! \n -----`)
    })

    Omegga.on('triggerNpc', async ({ player, NPC }) => {
      PlayersData[player.name] = await NpcSystem.focusOnNPC(PlayersData[player.name], NPC)
    });


    return { registeredCommands: [
      'start-mining','stop-mining',
      'inventory','i','balance','bal',
      'enable-dev-mode','remote-sell',
      'option', 'exit', 'buy', 'sell',
      'viewquest','cancelquest'
    ] };
  }
  async stop() {
    // Anything that needs to be cleaned up...
  }
}
