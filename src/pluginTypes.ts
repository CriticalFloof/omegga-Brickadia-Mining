import {Components, DefinedComponents } from 'omegga';

export type Vector3 = [number,number,number]
export type Vector4 = [number,number,number,number]
export interface GamePosition {
    relativePosition:Vector3,
    chunkPosition:Vector3
}

export interface FullDataStructure {
    Surfaces:Surfaces,
    Players:Players,
    Server:Server
}

//Surfaces
// Contains data structure for shared data in the game space.
export type Surfaces = { [index: string]: Surface }

export interface Surface {
    name:string,
    coordinateData: CoordinateDataModel,
    surfaceSeed: number
}

export type CoordinateDataModel = { [index: string]: ChunkData }

export type ChunkData = { [index: string]: CoordinateData }

export interface CoordinateData {
    type:string,
    name:string,
    position:Vector3,
    size:Vector3,
    health:number
}
//Players
// Contains data structure for player specific data
export type Players = { [index: string]: PlayerData }

export interface PlayerData {
    name:string,
    effects:string[],
    health:number,
    credits:number,
    inventory: { [index: string]: InventoryItem},
    hand:string;
    lastInteractCall:number,
    lastMineCall:number,
    bDevMode:boolean,
    focusedCommand:string,
    focusedNPC:string,
    focusedUI:number,
    UIData:string[],
    UIPage:number,
    contextNPC:string,
    questInfo: QuestData
}

interface QuestData {
    completedQuests:{ [index: string]: number},
    activeQuests:{ [index: string]: Array<Quest>},
    availableQuests:{ [index: string]: Array<Quest>}
    lockedQuestsNPC:{ [index: string]: Quest}
    donePendingQuests:{ [index: string]: Array<Quest>}
}

export interface Quest {
    type:string,
    difficulty:number,
    objective:{
        item?:string,
        amount?:number,
        t:string,
    },
    reward:number
}

export interface InventoryItem {
    name:string,
    type:string,
    damage?:number,
    effectSize?:number,
    level?:number,
    maxLevel?:number,
    amount?:number,
    mineMethod?:string
}

//Server
// Contains data structure for server specific data
export interface Server {
    version:string,
    serverSellMultiplier:number,
    discoveredMineables:{ 
        allMineables:{[index:string]: Mineable},
        crustMineables:{[index:string]: Mineable},
        valuableMineables:{[index:string]: Mineable}
    }
}

export interface Mineable {
    type:string,
    class:string[],
    name:string,
    baseHealth:number,
    startDepth?:number,
    threshold?:number,
    scale?:number,
    brickData:{
        material_index: number,
        material_intensity: number,
        color: [number,number,number],
        components: Components<DefinedComponents>
    }
}