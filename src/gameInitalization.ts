import OmeggaPlugin from 'omegga';

import * as coordinateSystem from 'src/coordinateSystem';
import * as generationSystem from 'src/generationSystem';
import { FullDataStructure, PlayerData, Server } from './pluginTypes';
import OresJSON from 'src/Data/Ores.json';
import DirtJSON from 'src/Data/Dirt.json';
import { generateQuests } from './questSystem';
import NPCS from 'src/Data/NPCDialogue.json';


/**
 * Checks if the game's version matches with the data version
 */
export function checkGameVersion(version:string, ServerData:Server) {
    if(ServerData != undefined && version === ServerData.version){
        return true;
    };
    return false;
}




/**
 * Initalizes the game to a clean slate.
 * @return an object containing the full game data structure
 */
export function initalizeGame() {
    let fullGameDataStructure:FullDataStructure = {
        Surfaces:{},
        Players:{},
        Server:{
            version:"0.0.1",
            serverSellMultiplier: 1,
            discoveredMineables:{
                allMineables:{},
                valuableMineables:{},
                crustMineables:{}
            }
        }
    };


    //generate discovered mineables json.
    const oreKeys = Object.keys(OresJSON)
    for (let i = 0; i < oreKeys.length; i++) {
        fullGameDataStructure.Server.discoveredMineables.allMineables[oreKeys[i]] = OresJSON[oreKeys[i]]
        fullGameDataStructure.Server.discoveredMineables.valuableMineables[oreKeys[i]] = OresJSON[oreKeys[i]]
    }
    const dirtKeys = Object.keys(DirtJSON)
    for (let i = 0; i < dirtKeys.length; i++) {
        fullGameDataStructure.Server.discoveredMineables.allMineables[dirtKeys[i]] = DirtJSON[dirtKeys[i]]
        fullGameDataStructure.Server.discoveredMineables.crustMineables[dirtKeys[i]] = DirtJSON[dirtKeys[i]]
    }

    let Nauvis = new coordinateSystem.coordinateSurfaceModel('Nauvis', Math.random())

    fullGameDataStructure.Surfaces[Nauvis.surfaceName] = {coordinateData:Nauvis.coordinateData, surfaceSeed:Nauvis.surfaceSeed, name:Nauvis.surfaceName}

    let players = Omegga.getPlayers()
    for (let i = 0; i < players.length; i++) {
        let playerData = initalizePlayer(players[i].name)
        fullGameDataStructure.Players[players[i].name] = playerData
    }
    
    return fullGameDataStructure;
}


export function initalizePlayer(player:string) {
    console.log(player)
    let playerObject = Omegga.getPlayer(player);
    console.log(playerObject)
    let playerData:PlayerData = {
        name:playerObject.name,
        effects:[],
        health:100,
        credits:0,
        inventory: {
            Basic_Pickaxe:{
                name:'Basic_Pickaxe',
                type:'toolPickaxe',
                mineMethod:'rectangular',
                damage:1,
                effectSize:0,
                level:1,
                maxLevel:25
            }
        },
        hand:"Basic_Pickaxe",
        lastInteractCall:0,
        lastMineCall:0,
        bDevMode:false,
        focusedCommand:'',
        focusedNPC:'',
        focusedUI:0,
        UIData:[],
        UIPage:1,
        contextNPC:'',
        questInfo:{
            completedQuests:{},
            activeQuests:{},
            availableQuests:{},
            lockedQuestsNPC:{},
            donePendingQuests:{}
        }
    }

    const npckeys = Object.keys(NPCS)

    npckeys.forEach((npc)=>{
        playerData.questInfo.completedQuests[npc] = 0;
    })
    
    playerData = generateQuests(playerData)

    return playerData;
}