import { Brick, WriteSaveObject } from "omegga";
import { CoordinateData, CoordinateDataModel, InventoryItem, PlayerData, Surface, Vector3 } from "./pluginTypes";

import Ores from "src/Data/Ores.json"
import Tools from "src/Data/Tools.json"
import Placeables from "src/Data/Placeables.json"

const CHUNK_SIZE = 1024;

const GROUND_SIZE = 32;
//A Function where CoordinateDataModel is converted into Bricks

export function coordinateDataModelToBricks(surfaceCoordinateData:CoordinateDataModel):Brick[] {
    let bricks:Brick[] = []
    const newSurfaceCoordinateData:CoordinateDataModel = JSON.parse(JSON.stringify(surfaceCoordinateData))
    affectCoordinateDataCells((cellData:CoordinateData, chunkPosition:Vector3)=>{
        const absolutePosition = gamePositionToAbsolutePosition({chunkPosition:chunkPosition,relativePosition:cellData.position});
        bricks.push({
            position:absolutePosition,
            size:cellData.size,
            components:{
                BCD_Interact:{bPlayInteractSound:true,Message:``,ConsoleTag:`type:${cellData.type},name:${cellData.name}`}
            }
        })
    },newSurfaceCoordinateData)


    return bricks;
}
 
//A Function where Bricks is converted into CoordinateDataModel

export function bricksToCoordinateDataModel(bricks:Brick[]):CoordinateDataModel {
    let surfaceCoordinateData:CoordinateDataModel = {}
    const newBricks:Brick[] = JSON.parse(JSON.stringify(bricks))
    for (let i = 0; i < newBricks.length; i++) {
        const gamePosition = absolutePositionToGamePosition(newBricks[i].position);


        let type;
        let name;

        if(newBricks[i].components === undefined || newBricks[i].components.BCD_Interact === undefined || newBricks[i].components.BCD_Interact.ConsoleTag === undefined) {
            type = "Unknown"
            name = "unknown"
        } else {
            const message = newBricks[i].components.BCD_Interact.ConsoleTag
            const typeMatch = message.match(
                /type:(?<type>-?\w+)?/i
            )
            type = typeMatch.groups.type
    
            const nameMatch = message.match(
                /name:(?<name>-?\w+)?/i
            )
            name = nameMatch.groups.name
        }

        if(surfaceCoordinateData[`${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]}`] === undefined) surfaceCoordinateData[`${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]}`] = {};
        surfaceCoordinateData[`${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]}`][`${gamePosition.relativePosition[0]},${gamePosition.relativePosition[1]},${gamePosition.relativePosition[2]}`] = {
            type:type,
            name:name,
            position:gamePosition.relativePosition,
            size:newBricks[i].size,
            health:10
        }
    }
    return surfaceCoordinateData;
}

//A Function where two CoordinateDataModels are merged where type Air gets priority

export function mergeCoordinateDataModel(Model1:CoordinateDataModel, Model2:CoordinateDataModel):CoordinateDataModel {
    
    let newModel1:CoordinateDataModel = JSON.parse(JSON.stringify(Model1))
    let newModel2:CoordinateDataModel = JSON.parse(JSON.stringify(Model2))
    
    let generatedModel:CoordinateDataModel = {};

    affectCoordinateDataCells((cellData:CoordinateData, chunkDataKey:string)=>{
        //if chunk in model 1 doesn't exist, make it
        if(newModel1[chunkDataKey] === undefined) newModel1[chunkDataKey] = {}
        
        if(newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`] === undefined) {
            newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`] = newModel2[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
        }

    },newModel2)


    newModel1 = affectCoordinateDataCells((cellData:CoordinateData, chunkDataKey:string)=>{

        //if chunk in model2 doesn't exist, make it
        if(newModel2[chunkDataKey] === undefined) newModel2[chunkDataKey] = {}

        //if cell1 is undefined, apply cell2
        if(newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`] === undefined){
            cellData = newModel2[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
        //if cell2 is undefined, apply cell1
        } else if(newModel2[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`] === undefined){
            cellData = newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
        } else {
            //if either model contains air, apply the right model. //If no models have air apply the 1st model.
            if (newModel2[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`].type === "air") {
                cellData = newModel2[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
            } else {
                cellData = newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
            }
        }

    }, newModel1)

    generatedModel = affectCoordinateDataCells((cellData:CoordinateData, chunkDataKey:string)=>{
        //if chunk in model 1 doesn't exist, make it
        //if(newModel1[chunkDataKey] === undefined) newModel1[chunkDataKey] = {}

        //Since the first model is processed all that is needed is to check for the absense of model 1, and apply 
        if(newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`] === undefined) {
            cellData = newModel2[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
        } else /*If there is model 1, apply model 1's cell to the object*/{
            cellData = newModel1[chunkDataKey][`${cellData.position[0]},${cellData.position[1]},${cellData.position[2]}`];
        };
    },newModel1)

    return generatedModel;
}

//A Function that translates AbsolutePosition into ChunkPosition and RelativePosition
export function absolutePositionToGamePosition(absolutePosition:Vector3):{chunkPosition:Vector3,relativePosition:Vector3} {

    const gamePosition:{chunkPosition:Vector3,relativePosition:Vector3} = {
        chunkPosition:[
            Math.floor(absolutePosition[0]/CHUNK_SIZE),
            Math.floor(absolutePosition[1]/CHUNK_SIZE),
            Math.floor(absolutePosition[2]/CHUNK_SIZE)-1016
        ],
        relativePosition:[
            Math.round((((absolutePosition[0])/CHUNK_SIZE) - Math.floor(((absolutePosition[0])/CHUNK_SIZE)))*CHUNK_SIZE),
            Math.round((((absolutePosition[1])/CHUNK_SIZE) - Math.floor(((absolutePosition[1])/CHUNK_SIZE)))*CHUNK_SIZE),
            Math.round((((absolutePosition[2])/CHUNK_SIZE) - Math.floor(((absolutePosition[2])/CHUNK_SIZE)))*CHUNK_SIZE)
        ]
    }

    return gamePosition;
}

//A Function that translates ChunkPosition and RelativePosition into AbsolutePosition

export function gamePositionToAbsolutePosition(gamePosition:{chunkPosition:Vector3,relativePosition:Vector3}):Vector3 {

    let absolutePosition:Vector3 = [
        gamePosition.relativePosition[0]+gamePosition.chunkPosition[0]*CHUNK_SIZE,
        gamePosition.relativePosition[1]+gamePosition.chunkPosition[1]*CHUNK_SIZE,
        gamePosition.relativePosition[2]+(gamePosition.chunkPosition[2]+1016)*CHUNK_SIZE
    ];

    return absolutePosition;
}

//A Function that applies a function to all cells in a CoordinateDataModel

export function affectCoordinateDataCells(handler:Function,surfaceCoordinateData:CoordinateDataModel):CoordinateDataModel {



    const newSurfaceCoordinateData:CoordinateDataModel = JSON.parse(JSON.stringify(surfaceCoordinateData))
    const newSurfaceCoordinateDataKeys = Object.keys(newSurfaceCoordinateData)

    for (let i = 0; i < newSurfaceCoordinateDataKeys.length; i++) {
        const chunkData = newSurfaceCoordinateData[newSurfaceCoordinateDataKeys[i]];
        const chunkDataKeys = Object.keys(chunkData)
        for (let j = 0; j < chunkDataKeys.length; j++) {
            const cellData:CoordinateData = chunkData[chunkDataKeys[j]]
            handler(cellData, newSurfaceCoordinateDataKeys[i]); 
        }
    
    }



    return newSurfaceCoordinateData;
}

//A Function that corrects invalid GameCoordinates. (Ex. A relative coordinate of -32 in chunk 0 would be changed to a relative coordinate of 992 in chunk -1)
export function correctInvalidGameCoordinates(gamePosition:{chunkPosition:Vector3,relativePosition:Vector3}):{chunkPosition:Vector3,relativePosition:Vector3}{

    let newChunkPosition:Vector3 = [
        Math.floor(gamePosition.relativePosition[0] / CHUNK_SIZE) + gamePosition.chunkPosition[0],
        Math.floor(gamePosition.relativePosition[1] / CHUNK_SIZE) + gamePosition.chunkPosition[1],
        Math.floor(gamePosition.relativePosition[2] / CHUNK_SIZE) + gamePosition.chunkPosition[2]
        
    ];
    let newRelPosition:Vector3 = [
        Math.round(((gamePosition.relativePosition[0]/CHUNK_SIZE) - Math.floor((gamePosition.relativePosition[0]/CHUNK_SIZE)))*CHUNK_SIZE),
        Math.round(((gamePosition.relativePosition[1]/CHUNK_SIZE) - Math.floor((gamePosition.relativePosition[1]/CHUNK_SIZE)))*CHUNK_SIZE),
        Math.round(((gamePosition.relativePosition[2]/CHUNK_SIZE) - Math.floor((gamePosition.relativePosition[2]/CHUNK_SIZE)))*CHUNK_SIZE)
    ];


    return {chunkPosition:newChunkPosition,relativePosition:newRelPosition};
}

//A Function that gets all chunks from a surface using size and gamePosition
export function getChunksFromCubicSelection(size:number,gamePosition:{chunkPosition:Vector3,relativePosition:Vector3},surface:Surface):CoordinateDataModel{
    let t0 = Date.now();
    //First generate the 2 opposite coordinates of the Cubic selection from size and gamePosition
    const pos0:Vector3 = [(-size*GROUND_SIZE)+gamePosition.relativePosition[0],(-size*GROUND_SIZE)+gamePosition.relativePosition[1],(-size*GROUND_SIZE)+gamePosition.relativePosition[2]]
    const pos1:Vector3 = [(size*GROUND_SIZE)+gamePosition.relativePosition[0],(size*GROUND_SIZE)+gamePosition.relativePosition[1],(size*GROUND_SIZE)+gamePosition.relativePosition[2]]

    //Next correct these positions and extract the chunkPosition
    const chunk0:Vector3 = correctInvalidGameCoordinates({chunkPosition:gamePosition.chunkPosition, relativePosition:pos0}).chunkPosition
    const chunk1:Vector3 = correctInvalidGameCoordinates({chunkPosition:gamePosition.chunkPosition, relativePosition:pos1}).chunkPosition

    //Finally, gather the difference for each axis and iterate through 3 nested for loops with the length of the difference to get an array of all chunkKeys
    let chunkKeys:Array<string> = []
    const difference:Vector3 = [chunk1[0]-chunk0[0],chunk1[1]-chunk0[1],chunk1[2]-chunk0[2]]
    for (let x = 0; x < difference[0]+1; x++) {
        for (let y = 0; y < difference[1]+1; y++) {
            for (let z = 0; z < difference[2]+1; z++) {
                chunkKeys.push(`${chunk0[0]+x},${chunk0[1]+y},${chunk0[2]+z}`)
            }
        }
    }
    //Iterate through the keys and copy from the surface to the new dataModel
    let newCoordinateDataModel:CoordinateDataModel = {};
    for (let i = 0; i < chunkKeys.length; i++) {
        newCoordinateDataModel[chunkKeys[i]] = surface.coordinateData[chunkKeys[i]]
    }
    //Make a deepCopy of the newCoordinateDataModel to prevent any unwanted object referencing.
    newCoordinateDataModel = JSON.parse(JSON.stringify(newCoordinateDataModel))

    const t1 = Date.now();
    console.log(`getChunksFromCubicSelection took ${t1-t0}ms to complete!`)

    return newCoordinateDataModel;
}

//A Function where a coordinateDataModel combines the chunks of a surface and datamodel with priority for Air

export function combineChunks (dataModel:CoordinateDataModel, target:Surface):CoordinateDataModel {
    const t0 = Date.now();
    const newTarget:CoordinateDataModel = JSON.parse(JSON.stringify(target.coordinateData))
    const newDataModel:CoordinateDataModel = JSON.parse(JSON.stringify(dataModel))

    const dataModelKeys = Object.keys(newDataModel)
    for (let i = 0; i < dataModelKeys.length; i++) {
        const chunkData = newDataModel[dataModelKeys[i]]
        if(newTarget[dataModelKeys[i]] === undefined) newTarget[dataModelKeys[i]] = {};
        const chunkDataKeys = Object.keys(chunkData)
        for (let j = 0; j < chunkDataKeys.length; j++) {
            if(newTarget[dataModelKeys[i]][chunkDataKeys[j]] === undefined) {
            newTarget[dataModelKeys[i]][chunkDataKeys[j]] = newDataModel[dataModelKeys[i]][chunkDataKeys[j]]
            } else if(newDataModel[dataModelKeys[i]][chunkDataKeys[j]].type === "air") {
                newTarget[dataModelKeys[i]][chunkDataKeys[j]] = newDataModel[dataModelKeys[i]][chunkDataKeys[j]]
            }
        }
        
        
        

    }

    const t1 = Date.now();
    console.log(`overwriteChunks took ${t1-t0}ms to complete!`)

    return newTarget;
}

export function rgbToHex([r, g, b]) {
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function createItemByName(playerData: PlayerData, itemName: string): PlayerData {
    let newPlayerData:PlayerData = JSON.parse(JSON.stringify(playerData))
    //first check if the name is dirt
    if(itemName === "Dirt"){
        newPlayerData.inventory[itemName] = {
            type:"ground",
            name:"Dirt",
        }
        return newPlayerData
    }
    //If it's in the ore group
    const OreKeys = Object.keys(Ores)
    for (let i = 0; i < OreKeys.length; i++) {
        if (itemName === Ores[OreKeys[i]].name){
            newPlayerData.inventory[itemName] = {
                type:"ground",
                name:itemName,
            }
            return newPlayerData
        }
    }
    //tools group
    const ToolKeys = Object.keys(Tools)
    for (let i = 0; i < ToolKeys.length; i++) {
        if (itemName === Tools[ToolKeys[i]].name){
            newPlayerData.inventory[itemName] = Tools[itemName]
            return newPlayerData
        }
    }
    //placeables group
    const PlaceKeys = Object.keys(Placeables)
    for (let i = 0; i < PlaceKeys.length; i++) {
        if (itemName === Placeables[PlaceKeys[i]].name){
            newPlayerData.inventory[itemName] = Placeables[itemName]
            return newPlayerData
        }
    }
    console.info(`Failed to give player ${playerData.name} item ${itemName}`)
    return playerData;
}
