import { Players, Server, Surfaces, Vector3, FullDataStructure } from "./pluginTypes";
import * as utility from 'src/utility';
import * as NpcSystem from 'src/npcSystem';
import * as generationSystem from 'src/generationSystem';
import { NoiseFunction3D } from "simplex-noise";

export function damageGround(playerName: string, playersData: Players, SurfacesData: Surfaces, ServerData: Server, absolutePosition:Vector3, loadedNoiseFunctions:{[index:string]: NoiseFunction3D}): void{

    const gamePosition = utility.absolutePositionToGamePosition(absolutePosition);
    //Clear the UI to prevent players from mining while still talking to an NPC.
    let playerData = playersData[playerName]
    NpcSystem.clearUI(playerData)

    try {
      //If cell's health is over 0, decrease it by pickaxe damage
    
      let selectedCell = SurfacesData['Nauvis'].coordinateData[`${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]}`][`${gamePosition.relativePosition[0]},${gamePosition.relativePosition[1]},${gamePosition.relativePosition[2]}`]
      selectedCell.health -= Math.round(playerData.inventory[playerData.hand].damage*playerData.inventory[playerData.hand].level)
      if(selectedCell.health > 0 && !(playerData.bDevMode)){
        if(ServerData.discoveredMineables.allMineables[selectedCell.name].class['valuable']){
          Omegga.middlePrint(playerData.name,
            `${selectedCell.name}: ${selectedCell.health}<br>Worth <color="33dd33">¢${(ServerData.discoveredMineables.valuableMineables[selectedCell.name].baseHealth/5 * ServerData.serverSellMultiplier)}</>`
            )
        } else {
          Omegga.middlePrint(playerData.name,
            `${selectedCell.name}: ${selectedCell.health}`
            )
        }
      } else {

        if (Date.now() - playerData.lastMineCall < 334) return;
        playerData.lastMineCall = Date.now()

        if(ServerData.discoveredMineables.allMineables[selectedCell.name].class['valuable']){
          Omegga.middlePrint(playerName,
            `Mined ${selectedCell.name}!<br>Worth <color="44ff44">¢${(ServerData.discoveredMineables.valuableMineables[selectedCell.name].baseHealth/5 * ServerData.serverSellMultiplier)}</>`
            )
        } else {
          Omegga.middlePrint(playerName,
            `Mined ${selectedCell.name}!`
            )
        }

        const mineMethod = playerData.inventory[playerData.hand].mineMethod
        const effectSize = playerData.inventory[playerData.hand].effectSize

        SurfacesData['Nauvis'].coordinateData = generationSystem.mineGround(ServerData, SurfacesData['Nauvis'], gamePosition.chunkPosition, gamePosition.relativePosition, loadedNoiseFunctions,mineMethod,effectSize,effectSize,effectSize,effectSize)
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
      const mineMethod = playerData.inventory[playerData.hand].mineMethod
      const effectSize = playerData.inventory[playerData.hand].effectSize
      SurfacesData['Nauvis'].coordinateData = generationSystem.mineGround(ServerData, SurfacesData['Nauvis'], gamePosition.chunkPosition, gamePosition.relativePosition, loadedNoiseFunctions, mineMethod, effectSize,effectSize,effectSize,effectSize)
    }
}