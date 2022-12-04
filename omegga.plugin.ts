import OmeggaPlugin, { OL, PS, PC, WriteSaveObject, Brick, OmeggaPlayer, IPlayerPositions, Vector } from 'omegga';
import * as permissions from 'src/permissions';
import * as initalization from 'src/gameInitalization';
import * as generationSystem from 'src/generationSystem';
import * as utility from 'src/utility';
import * as commands from 'src/commands';
import * as NpcSystem from 'src/npcSystem';
import Tools from "src/Data/Tools.json"

import { createNoise3D, NoiseFunction3D } from 'simplex-noise';
import { PlayerData, Players, Server, Surfaces } from 'src/pluginTypes';
import { addMineMatcher, addNPCMatcher } from 'src/matchers/debounceInteract';
import * as playerSystem from 'src/playerSystem';
import { generateQuests } from 'src/questSystem';


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
let questInterval:number;

//gamestate for matchers to reference
let gameState = {
  gameLoop: gameLoop,
  serverData: {container: ServerData},
  surfacesData: {container: SurfacesData},
  playersData: {container: PlayersData}
}




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
  I recognize the fact that this entire project's code is far from the best it could be.
  I plan on redesigning most of the code if this project works out.
  */
  async init() {
    Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining Initalizating...`);

    if(!bInitalizedMatchers) {
      addMineMatcher(gameState);
      addNPCMatcher(gameState);
      bInitalizedMatchers = true;
    }
    Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining`);
    Omegga.broadcast(`<color="33bbff"><size="16">></></> version ${VERSION}`);

    //For server restarts
    console.log('Server start!')
    Omegga.on('start', async ()=>{
      if(this.config['auto-start']) {
        Omegga.broadcast(`<color="33bbff"><size="16">></></> Starting Brickadia Mining...`);
        console.info("Starting Brickadia Mining...")
  
        //First start checking
        if(await this.store.get('Server') === undefined || this.config['clear-gamedata']){
          console.info("First time start. Creating new server template...")
          let BlankData = initalization.initalizeGame();
          await this.store.set('Players',BlankData.Players);
          await this.store.set('Server',BlankData.Server);
          await this.store.set('Surfaces',BlankData.Surfaces);
          
        } else {
          console.info("Game saveData Found.")
          // The next 2 lines are temporary to force terrain regeneration onstart before I make a function that loads the saved surfaces.
          let BlankData = initalization.initalizeGame();
          await this.store.set('Surfaces',BlankData.Surfaces); 
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
  
        //update gamestate
        gameState.serverData.container = ServerData;
        gameState.surfacesData.container = SurfacesData;
        gameState.playersData.container = PlayersData;
  
        //Store Autosave Setup
        autoStoreInterval = setInterval(async ()=>{
          console.info("Saving Store Data...")
          await this.store.set('Players',PlayersData);
          await this.store.set('Server',ServerData);
          await this.store.set('Surfaces',SurfacesData);
          console.info("Store Data has been Autosaved!")
        },60000*this.config['autosave-interval'])

        questInterval = setInterval(async ()=>{
          for (let i = 0; i < Object.keys(PlayersData).length; i++) {
            if(PlayersData[Object.keys(PlayersData)[i]].focusedCommand === "quests"){
              NpcSystem.clearUI(PlayersData[Object.keys(PlayersData)[i]])
            }
            PlayersData[Object.keys(PlayersData)[i]].questInfo.availableQuests = generateQuests(PlayersData[Object.keys(PlayersData)[i]]).questInfo.availableQuests
          }
          Omegga.broadcast('<color="33bbff"><size="16">></></> Quests have been refreshed!')
          console.info("Quests refreshed.")
        },60000*this.config['quest-interval'])
  
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
  
        setTimeout(async ()=>{
          Omegga.loadEnvironment('Brickadia-Mining-Plate');
  
          Omegga.loadBricks('BrickadiaMining-Structures/SpawnZoneNauvis', {quiet:false})
          SurfacesData['Nauvis'].coordinateData = generationSystem.mineGround(ServerData, SurfacesData['Nauvis'],[0,0,0],[16,16,16],loadedNoiseFunctions,"rectangular",0,8,8,0)
          const players = await Omegga.getPlayers();
          players.forEach(player => {
            Omegga.writeln(`Chat.Command /TP "${player.name}" ${-800+120*Math.random()} ${580+120*Math.random()} ${1_040_502} 0`);
          });
          //matchers initalization

        },250)
  
  
        //Gameloop set
        gameLoop.state = true;
  
        Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining started!`);
        
      }
    })
    //For Plugin restarts
    if(this.config['auto-start']) {
      Omegga.broadcast(`<color="33bbff"><size="16">></></> Starting Brickadia Mining...`);
      console.info("Starting Brickadia Mining...")

      //First start checking
      if(await this.store.get('Server') === undefined || this.config['clear-gamedata']){
        console.info("First time start. Creating new server template...")
        let BlankData = initalization.initalizeGame();
        await this.store.set('Players',BlankData.Players);
        await this.store.set('Server',BlankData.Server);
        await this.store.set('Surfaces',BlankData.Surfaces);
        
      } else {
        console.info("Game saveData Found.")
        // The next 2 lines are temporary to force terrain regeneration onstart before I make a function that loads the saved surfaces.
        let BlankData = initalization.initalizeGame();
        await this.store.set('Surfaces',BlankData.Surfaces); 
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

      //update gamestate
      gameState.serverData.container = ServerData;
      gameState.surfacesData.container = SurfacesData;
      gameState.playersData.container = PlayersData;

      //Store Autosave Setup
      autoStoreInterval = setInterval(async ()=>{
        console.info("Saving Store Data...")
        await this.store.set('Players',PlayersData);
        await this.store.set('Server',ServerData);
        await this.store.set('Surfaces',SurfacesData);
        console.info("Store Data has been Autosaved!")
      },60000*this.config['autosave-interval'])

      questInterval = setInterval(async ()=>{
        for (let i = 0; i < Object.keys(PlayersData).length; i++) {
          if(PlayersData[Object.keys(PlayersData)[i]].focusedCommand === "quests"){
            NpcSystem.clearUI(PlayersData[Object.keys(PlayersData)[i]])
          }
          PlayersData[Object.keys(PlayersData)[i]].questInfo.availableQuests = generateQuests(PlayersData[Object.keys(PlayersData)[i]]).questInfo.availableQuests
        }
        Omegga.broadcast('<color="33bbff"><size="16">></></> Quests have been refreshed!')
        console.info("Quests refreshed.")
      },60000*this.config['quest-interval'])

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

      setTimeout(async ()=>{
        Omegga.loadEnvironment('Brickadia-Mining-Plate');

        Omegga.loadBricks('BrickadiaMining-Structures/SpawnZoneNauvis', {quiet:false})
        SurfacesData['Nauvis'].coordinateData = generationSystem.mineGround(ServerData, SurfacesData['Nauvis'],[0,0,0],[16,16,16],loadedNoiseFunctions,"rectangular",0,8,8,0)
        const players = await Omegga.getPlayers();
        players.forEach(player => {
          Omegga.writeln(`Chat.Command /TP "${player.name}" ${-800+120*Math.random()} ${580+120*Math.random()} ${1_040_502} 0`);
        });
      },250)


      //Gameloop set
      gameLoop.state = true;

      Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining started!`);
      
    }

    Omegga.on('join', (player:OmeggaPlayer) => {
      if(!gameLoop.state) return;
      if(PlayersData[player.name] === undefined){
        console.info('New player detected. Generating player template...')
        setTimeout(()=>{
          PlayersData[player.name] = initalization.initalizePlayer(player.name)
          console.info(`Player ${player.name}'s data has been stored at ' PlayersData[${player.name}] '`)
          console.log(PlayersData[player.name])
        }, 100)
      }
    })

    Omegga.on('leave', async (player:OmeggaPlayer) => {
      if(!gameLoop.state) return;
      NpcSystem.clearUI(PlayersData[player.name])
      console.info("Forcing playerData Store.")
      await this.store.set('Players',PlayersData);
    })

    //For manual start
    Omegga.on('cmd:start-mining', async (speaker: string) => {
      if(!permissions.getPermission(speaker,this.config['authorized-role'])) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> The game is already running!`);return;};

      Omegga.broadcast(`<color="33bbff"><size="16">></></> Starting Brickadia Mining...`);
      console.info("Starting Brickadia Mining...")

      //First start checking
      if(await this.store.get('Server') === undefined || this.config['clear-gamedata']){
        console.info("First time start. Creating new server template...")
        let BlankData = initalization.initalizeGame();
        await this.store.set('Players',BlankData.Players);
        await this.store.set('Server',BlankData.Server);
        await this.store.set('Surfaces',BlankData.Surfaces);
        
      } else {
        console.info("Game saveData Found.")
        // The next 2 lines are temporary to force terrain regeneration onstart before I make a function that loads the saved surfaces.
        let BlankData = initalization.initalizeGame();
        await this.store.set('Surfaces',BlankData.Surfaces); 
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

      //update gamestate
      gameState.serverData.container = ServerData;
      gameState.surfacesData.container = SurfacesData;
      gameState.playersData.container = PlayersData;

      //Store Autosave Setup
      autoStoreInterval = setInterval(async ()=>{
        console.info("Saving Store Data...")
        await this.store.set('Players',PlayersData);
        await this.store.set('Server',ServerData);
        await this.store.set('Surfaces',SurfacesData);
        console.info("Store Data has been Autosaved!")
      },60000*this.config['autosave-interval'])

      //Quest Refresh
      questInterval = setInterval(async ()=>{
        for (let i = 0; i < Object.keys(PlayersData).length; i++) {
          if(PlayersData[Object.keys(PlayersData)[i]].focusedCommand === "quests"){
            NpcSystem.clearUI(PlayersData[Object.keys(PlayersData)[i]])
          }
          PlayersData[Object.keys(PlayersData)[i]].questInfo.availableQuests = generateQuests(PlayersData[Object.keys(PlayersData)[i]]).questInfo.availableQuests
        }
        Omegga.broadcast('<color="33bbff"><size="16">></></> Quests have been refreshed!')
        console.info("Quests refreshed.")
      },60000*this.config['quest-interval'])

      //Noise function generation
      console.info("Creating Noise Functions...")
      const SurfacesKeys = Object.keys(SurfacesData)
      for (let i = 0; i < SurfacesKeys.length; i++) {
        const seed = SurfacesData[SurfacesKeys[i]].surfaceSeed
        const surfaceNoise = createNoise3D(()=>{return seed});
        loadedNoiseFunctions[SurfacesKeys[i]] = surfaceNoise
      }
      //Loading environment
      Omegga.loadEnvironment('Brickadia-Mining-Plate');
      //Loading Map Procedure
      Omegga.clearAllBricks()

      setTimeout(async ()=>{
        Omegga.loadBricks('BrickadiaMining-Structures/SpawnZoneNauvis', {quiet:false})
        SurfacesData['Nauvis'].coordinateData = generationSystem.mineGround(ServerData, SurfacesData['Nauvis'],[0,0,0],[16,16,16],loadedNoiseFunctions,"rectangular",0,8,8,0)
        const players = await Omegga.getPlayers();
        players.forEach(player => {
          Omegga.writeln(`Chat.Command /TP "${player.name}" ${-800+120*Math.random()} ${580+120*Math.random()} ${1_040_502} 0`);
        });
      },250)


      //Gameloop set
      gameLoop.state = true;

      Omegga.broadcast(`<color="33bbff"><size="16">></></> Brickadia Mining started!`);
      
    })
    
    Omegga.on('cmd:stop-mining', async (speaker:string) => {
      if(!permissions.getPermission(speaker,"Admin")) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(!gameLoop.state) {Omegga.whisper(speaker, "The game isn't running!");return;};

      Omegga.broadcast(`Stopping Brickadia Mining...`);
      //gameloop clean up.

      // Manual stopping forces a save.
      await this.store.set('Players',PlayersData);
      await this.store.set('Server',ServerData);
      await this.store.set('Surfaces',SurfacesData);

      //Stopping autoStoreInterval
      clearInterval(autoStoreInterval);
      clearInterval(questInterval);
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
    Omegga.on('cmd:equip', (speaker:string, itemName:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      const temporaryPlayerData: PlayerData = commands.equip(PlayersData[speaker],itemName)
      PlayersData[speaker].hand = temporaryPlayerData.hand
      console.log(PlayersData[speaker].hand)
    });

    //CONTEXT COMMANDS SECTION
    Omegga.on('cmd:option', async (speaker:string, option:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = await commands.option(PlayersData[speaker], parseInt(option))
    });
    Omegga.on('cmd:exit', (speaker:string, option:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker] = commands.exit(speaker,PlayersData[speaker])
    });
    Omegga.on('cmd:buy', (speaker:string, amount:string, ...itemName:string[]) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      const temporaryPlayerData: PlayerData = commands.buy(PlayersData[speaker],itemName,amount)
      PlayersData[speaker].credits = temporaryPlayerData.credits
      PlayersData[speaker].inventory = temporaryPlayerData.inventory
    });
    Omegga.on('cmd:sell', (speaker:string, amount:string, ...itemName:string[]) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      const temporaryPlayerData: PlayerData = commands.sell(PlayersData[speaker],itemName,amount)
      PlayersData[speaker].credits = temporaryPlayerData.credits
      PlayersData[speaker].inventory = temporaryPlayerData.inventory
    });
    Omegga.on('cmd:upgrade', (speaker:string, amount:string) => {
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      const temporaryPlayerData: PlayerData = commands.upgrade(PlayersData[speaker],amount)
      PlayersData[speaker].credits = temporaryPlayerData.credits
      PlayersData[speaker].inventory = temporaryPlayerData.inventory
    });

    Omegga.on('cmd:check', (speaker:string) => {
      PlayersData[speaker].UIPage = 2
      console.log(PlayersData[speaker])
    });


    //DEV COMMANDS SECTION

    Omegga.on('cmd:enable-dev-mode', async (speaker:string) => {
      if(!permissions.getPermission(speaker,this.config['authorized-role'])) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> You dont have permission to use this command!`);return;};
      if(!gameLoop.state) {Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> This command cannot be used while the game isn't running!`); return;};
      PlayersData[speaker].bDevMode = !(PlayersData[speaker].bDevMode)
      Omegga.whisper(speaker, `<color="33bbff"><size="16">></></> DevMode set to ${PlayersData[speaker].bDevMode}!`)
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
      //Check if user is holding pickaxe
      console.log(PlayersData[player.name])
      if(Tools[PlayersData[player.name].hand] != undefined) {
        playerSystem.damageGround(player.name, PlayersData, SurfacesData, ServerData, position, loadedNoiseFunctions)
      } else {
        Omegga.whisper(player.name, `You must equip a pickaxe to dig!`)
      }
    })

    Omegga.on('triggerNpc', async ({ player, NPC }) => {
      PlayersData[player.name] = await NpcSystem.focusOnNPC(PlayersData[player.name], NPC)
    });


    return { registeredCommands: [
      'start-mining','stop-mining',
      'inventory','i','balance','bal','equip',
      'enable-dev-mode',
      'option', 'exit', 'buy', 'sell','upgrade',
      'viewquest','cancelquest'
    ] };
  }
  async stop() {
    // Manual stopping forces a save.
    await this.store.set('Players',PlayersData);
    await this.store.set('Server',ServerData);
    await this.store.set('Surfaces',SurfacesData);
  }
}
