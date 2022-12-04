import OmeggaPlugin, { OmeggaPlayer, WriteSaveObject } from 'omegga';
import { NoiseFunction3D } from 'simplex-noise';
import * as utility from 'src/utility';
import { CoordinateData, CoordinateDataModel, GamePosition, Mineable, PlayerData, Server, Surface, Vector3 } from './pluginTypes';
import { generateQuests } from './questSystem';

//Module to be renamed to generatorSystem and all non related functions will be moved elsewhere


const CELL_SIZE = 2;
const GROUND_SIZE = 32;
const CHUNK_SIZE = 1024;

//Refactor this code for readability, please!
export function mineGround(serverData:Server, surface:Surface, chunkPosition:Vector3 , relPosition:Vector3, loadedNoiseFunctions:{[index:string]: NoiseFunction3D}, key:string = "rectangular", size:number = 0, width:number = 0, height:number = 0, length:number = 0, vector:Vector3 = [0,0,0]):CoordinateDataModel {

    let airData:CoordinateDataModel = {};

    let absolutePosition:Vector3 = utility.gamePositionToAbsolutePosition({relativePosition:relPosition,chunkPosition:chunkPosition})
    let t2 = Date.now();

    switch (key) {
        case 'rectangular':

            for (let x = -width; x < width+1; x++) {
                for (let y = -height; y < height+1; y++) {
                    for (let z = -length; z < length+1; z++) {
                        
                        let newGamePosition:GamePosition = utility.absolutePositionToGamePosition([absolutePosition[0]+x*GROUND_SIZE,absolutePosition[1]+y*GROUND_SIZE,absolutePosition[2]+z*GROUND_SIZE]);

                        //if chunk wasn't made yet, make it.
                        if(airData[`${newGamePosition.chunkPosition[0]},${newGamePosition.chunkPosition[1]},${newGamePosition.chunkPosition[2]}`] === undefined) airData[`${newGamePosition.chunkPosition[0]},${newGamePosition.chunkPosition[1]},${newGamePosition.chunkPosition[2]}`] = {};
                        
                        //cells in chunks always get overwritten
                        airData[`${newGamePosition.chunkPosition[0]},${newGamePosition.chunkPosition[1]},${newGamePosition.chunkPosition[2]}`][`${newGamePosition.relativePosition[0]},${newGamePosition.relativePosition[1]},${newGamePosition.relativePosition[2]}`] = {
                            type: "air",
                            name: "Air",
                            position: newGamePosition.relativePosition,
                            size: [GROUND_SIZE/2,GROUND_SIZE/2,GROUND_SIZE/2],
                            health:0
                        }
                        
                    }
                }  
            }

            break;

        case 'spherical': // broken please fix

            for (let x = -size; x < size+1; x++) {
                for (let y = -size; y < size+1; y++) {
                    for (let z = -size; z < size+1; z++) {

                        let absolutePosition1:Vector3 = [
                            x*GROUND_SIZE+relPosition[0]+chunkPosition[0]*CHUNK_SIZE,
                            y*GROUND_SIZE+relPosition[1]+chunkPosition[1]*CHUNK_SIZE,
                            z*GROUND_SIZE+relPosition[2]+chunkPosition[2]*CHUNK_SIZE
                        ];

                        
                        let distance = Math.pow((Math.pow(absolutePosition1[0] - absolutePosition[0], 2) +
                        Math.pow(absolutePosition1[1] - absolutePosition[1], 2) +
                        Math.pow(absolutePosition1[2] - absolutePosition[2], 2) * 1.0), 0.5);

                        if(distance/GROUND_SIZE > size) continue;
                        
                        let newGamePosition:GamePosition = utility.absolutePositionToGamePosition([absolutePosition[0]+x*GROUND_SIZE,absolutePosition[1]+y*GROUND_SIZE,absolutePosition[2]+z*GROUND_SIZE]);

                        //if chunk wasn't made yet, make it.
                        if(airData[`${newGamePosition.chunkPosition[0]},${newGamePosition.chunkPosition[1]},${newGamePosition.chunkPosition[2]}`] === undefined) airData[`${newGamePosition.chunkPosition[0]},${newGamePosition.chunkPosition[1]},${newGamePosition.chunkPosition[2]}`] = {};
                        
                        //cells in chunks always get overwritten
                        airData[`${newGamePosition.chunkPosition[0]},${newGamePosition.chunkPosition[1]},${newGamePosition.chunkPosition[2]}`][`${newGamePosition.relativePosition[0]},${newGamePosition.relativePosition[1]},${newGamePosition.relativePosition[2]}`] = {
                            type: "air",
                            name: "Air",
                            position: newGamePosition.relativePosition,
                            size: [GROUND_SIZE/2,GROUND_SIZE/2,GROUND_SIZE/2],
                            health:0
                        }
                    }
                }  
            }

            break;

        case 'directional':
            if(length === undefined) length = 0;
            if(vector === undefined) vector = [0,0,0];
            break;
    
        default:
            break;
    }
    const t3 = Date.now();
    console.log(`AirCoordinateGeneration took ${t3-t2}ms to complete!`)

    airData = generateCaveAir(surface,loadedNoiseFunctions,airData)
    let groundData = generateGroundData(airData, surface, loadedNoiseFunctions, serverData)
    let worldData = utility.mergeCoordinateDataModel(groundData, airData)
    worldData = filterNoMineZones(worldData)
    updateBricks(absolutePosition, width,height,length, worldData, serverData)

    const t0 = Date.now();
    let newLocalCoordinateData:CoordinateDataModel = utility.getChunksFromCubicSelection(size,{chunkPosition:chunkPosition,relativePosition:relPosition},surface)
    let newSurfaceCoordinateData:CoordinateDataModel = utility.mergeCoordinateDataModel(worldData, newLocalCoordinateData)
    newSurfaceCoordinateData = utility.combineChunks(newSurfaceCoordinateData,surface)
    const t1 = Date.now();
    console.log(`gameSurface Update took ${t1-t0}ms to complete!`)
    return newSurfaceCoordinateData;
}


/**
 * Takes worldData and applies all empty neighbours of air with groundData without the airData
 * !!MAKE SURE ALL AIR HAS BEEN GENERATED!!
 * @param worldData 
 * @returns A new CoordinateDataModel Object
 */
function generateGroundData(worldData:CoordinateDataModel, surface:Surface, loadedNoiseFunctions:{[index:string]: NoiseFunction3D}, serverData:Server):CoordinateDataModel {
    let t0 = Date.now();
    let newWorldData:CoordinateDataModel = {}

    let noise3D:NoiseFunction3D = loadedNoiseFunctions[surface.name]

    const worldDataKeys = Object.keys(worldData)
    
    for (let i = 0; i < worldDataKeys.length; i++) {
        const chunkData = worldData[worldDataKeys[i]]
        const chunkDataKeys = Object.keys(chunkData)

        const chunkPositionString:string[] = worldDataKeys[i].split(",", 3)
        const chunkPosition:Vector3 = [parseInt(chunkPositionString[0]),parseInt(chunkPositionString[1]),parseInt(chunkPositionString[2])] 

        for (let j = 0; j < chunkDataKeys.length ; j++) {
            let groundData = chunkData[chunkDataKeys[j]]
            if(groundData.name !== "Air") continue;

            
            const x = groundData.position[0]
            const y = groundData.position[1]
            const z = groundData.position[2]
            
            const neighbours:Array<Vector3> = [[x-GROUND_SIZE,y,z],[x+GROUND_SIZE,y,z],[x,y-GROUND_SIZE,z],[x,y+GROUND_SIZE,z],[x,y,z-GROUND_SIZE],[x,y,z+GROUND_SIZE]]
             
            for (let k = 0; k < neighbours.length; k++) {
                //var t2 = now()
                let neighbourRelPosition:Vector3 = neighbours[k];
                
                //set the correct chunk positions and relative positions from the cell neighbour's position
                
                let newRelPosition:Vector3 = [
                    Math.round(((neighbourRelPosition[0]/CHUNK_SIZE) - Math.floor(( + neighbourRelPosition[0]/CHUNK_SIZE)))*CHUNK_SIZE),
                    Math.round(((neighbourRelPosition[1]/CHUNK_SIZE) - Math.floor(( + neighbourRelPosition[1]/CHUNK_SIZE)))*CHUNK_SIZE),
                    Math.round(((neighbourRelPosition[2]/CHUNK_SIZE) - Math.floor(( + neighbourRelPosition[2]/CHUNK_SIZE)))*CHUNK_SIZE)
                ];
                
                let newChunkPosition:Vector3 = [
                    Math.floor(neighbourRelPosition[0] / CHUNK_SIZE) + chunkPosition[0],
                    Math.floor(neighbourRelPosition[1] / CHUNK_SIZE) + chunkPosition[1],
                    Math.floor(neighbourRelPosition[2] / CHUNK_SIZE) + chunkPosition[2] 
                ];
                
                
                
                //look for a value in in worldData, if it doesn't exist, it's assumed to be ground.
                
                //if chunk wasn't made yet, make it.
                
                if(newWorldData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`] === undefined) newWorldData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`] = {};
                
                //if value doesn't exist, then generate the ground 
                
                //Note: The risk of a reference error is removed by how the OR conditional works, If the chunk is undefined, the JIT complier wont check the other condition with property references.
                if(worldData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`] === undefined || worldData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`][`${newRelPosition[0]},${newRelPosition[1]},${newRelPosition[2]}`] === undefined){
                    if(surface.coordinateData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`] === undefined || surface.coordinateData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`][`${newRelPosition[0]},${newRelPosition[1]},${newRelPosition[2]}`] === undefined) {
                        
                        newWorldData[`${newChunkPosition[0]},${newChunkPosition[1]},${newChunkPosition[2]}`][`${newRelPosition[0]},${newRelPosition[1]},${newRelPosition[2]}`] = generateGround(noise3D,serverData.discoveredMineables.crustMineables,serverData.discoveredMineables.valuableMineables,newChunkPosition,newRelPosition)
                    }
                }
                //var t3 = now();
                //console.log(`generateGroundNames took ${(t3-t2).toFixed(1)}ms to complete!`)
            }
        }
        let t1 = Date.now();
        console.log(`generateGroundData took ${t1-t0}ms to complete!`)
    }

    return newWorldData;
}

function loadCellData(groundData:CoordinateDataModel, serverData:Server):void {

    let cellDataArray:Array<CoordinateData> = [];

    let groundDataKeys = Object.keys(groundData);
    
    for (let i = 0; i < groundDataKeys.length; i++) {
        
        
        let chunkData = groundData[groundDataKeys[i]]
        if(chunkData == undefined) continue;
        let chunkDataKeys = Object.keys(chunkData)
        
        for (let j = 0; j < chunkDataKeys.length; j++) {
            
            const cellData = chunkData[chunkDataKeys[j]]

            if(cellData.type === "air") continue;
            
            const relPosition:Vector3 = cellData.position
            const chunkPositionString:string[] = groundDataKeys[i].split(",", 3)
            const chunkPosition:Vector3 = [parseInt(chunkPositionString[0]),parseInt(chunkPositionString[1]),parseInt(chunkPositionString[2])] 
            
            let absolutePosition:Vector3 = utility.gamePositionToAbsolutePosition({chunkPosition:chunkPosition,relativePosition:relPosition})
            cellDataArray.push({
                type:cellData.type,
                name:cellData.name,
                position:absolutePosition,
                size:cellData.size,
                health:cellData.health
            });
            
        }
        
    }
    
    const publicUser = {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        name: 'Generator',
    };
    
    let save:WriteSaveObject;
    try{
        save = {
            author: {
              id: publicUser.id,
              name: 'TypeScript',
            },
            description: 'Segment generated from Brickadia Mining',
            map: 'Brickadia Mining Load Segment',
            brick_assets:["PB_DefaultMicroBrick"],
            materials: [
              'BMC_Plastic',
              'BMC_Metallic',
              'BMC_Glow',
              'BMC_Glass',
              'BMC_Hologram'
              ],
            brick_owners: [publicUser],
            bricks: cellDataArray
              .map(({type, name, position, size}) => ({
                size: size,
                position: position,
                ...serverData.discoveredMineables.allMineables[name].brickData,
                components:{
                    BCD_Interact:{
                        bPlayInteractSound:false,
                        ConsoleTag:``,
                        Message:''
                    },
                    ...serverData.discoveredMineables.allMineables[name].brickData.components
                }
                
              })
              )
          };
    } catch(error){
        console.error("Invalid Mineable name was in the save, replacing to Dirt")
        save = {
            author: {
              id: publicUser.id,
              name: 'TypeScript',
            },
            description: 'Segment generated from Brickadia Mining',
            map: 'Brickadia Mining Load Segment',
            brick_assets:["PB_DefaultMicroBrick"],
            materials: [
              'BMC_Plastic',
              'BMC_Metallic',
              'BMC_Glow',
              'BMC_Glass',
              'BMC_Hologram'
              ],
            brick_owners: [publicUser],
            bricks: cellDataArray
              .map(({position, size}) => ({
                size: size,
                position: position,
                ...serverData.discoveredMineables.crustMineables.Dirt.brickData,
                components:{
                    BCD_Interact:{
                        bPlayInteractSound:false,
                        ConsoleTag:``,
                        Message:''
                    },
                    ...serverData.discoveredMineables.crustMineables.Dirt.brickData.components
                }
                
              })
              )
          };
    }
    
      
      let t0 = Date.now()
      if (cellDataArray.length > 0) {
        let inputData = {offX: 0, offY: 0, offZ: 0, quiet: true, correctPalette: true, correctCustom: false};
        Omegga.loadSaveData(save,inputData);
      }
      
      let t1 = Date.now()
      console.log(`Loading function took ${t1-t0}ms to complete!`)
      
}

/**
 * 
 * @param absolutePosition 
 * @param size 
 * @param cellData 
 */
async function updateBricks(absolutePosition:Vector3, width:number = 0, height:number = 0, length:number = 0, cellData:CoordinateDataModel, serverData:Server):Promise<void> {

    let t0 = Date.now();


    //Save the region that is due to be cleared
    
    let save:WriteSaveObject = await Omegga.getSaveData({center:absolutePosition, extent:[width*GROUND_SIZE+GROUND_SIZE*3,height*GROUND_SIZE+GROUND_SIZE*3,length*GROUND_SIZE+GROUND_SIZE*3]})
    
    //Filter the WriteSaveObject to only include typeData of "Ground"
    let finalizedCoordinateDataModel:CoordinateDataModel = {};
    if(save !== undefined) {
        let filteredSave:WriteSaveObject = JSON.parse(JSON.stringify(save));
        filteredSave.bricks = []

        for (let i = 0; i < save.bricks.length; i++) {
            if(save.bricks[i].components === undefined || save.bricks[i].components.BCD_Interact === undefined) continue;
            const message = save.bricks[i].components.BCD_Interact.ConsoleTag

            const typeMatch = message.match(
                /^type:(?<type>-?\w+)?/i
            )
            if(typeMatch === null || typeMatch.groups === null) continue;
            const type = typeMatch.groups.type
            
            if(type === "mineable"){
                //Make a new WriteSaveObject that's Filtered
                filteredSave.bricks.push(save.bricks[i]);
            }

        }

        //Convert the filtered WriteSaveObject into a CoordinateDataModel.
        let generatedCoordinateDataModel:CoordinateDataModel = {}
        generatedCoordinateDataModel = utility.bricksToCoordinateDataModel(filteredSave.bricks)
        //Take the inserted CoordinateDataModel and the generated Model, and make a new model where air in either of the models overwrites ground.
        finalizedCoordinateDataModel = utility.mergeCoordinateDataModel(cellData,generatedCoordinateDataModel)
    } else {
        finalizedCoordinateDataModel = cellData
    }
    //Clear the region

    Omegga.clearRegion({center:absolutePosition, extent:[width*GROUND_SIZE+GROUND_SIZE,height*GROUND_SIZE+GROUND_SIZE,length*GROUND_SIZE+GROUND_SIZE]})

    //Finally Load the finalizedDataModel.
    loadCellData(finalizedCoordinateDataModel,serverData);

    let t1 = Date.now();
    console.log(`updateBricks function took ${t1-t0}ms to complete!`)

}

// This should be called once the inital air has been generated
// An upper bound should be defined to prevent massive, potentially infinitely big caves from forming, if this happens, return the original coordinateModel
export function generateCaveAir(surface:Surface, loadedNoiseFunctions:{[index:string]: NoiseFunction3D}, coordinateData:CoordinateDataModel):CoordinateDataModel {

    let newCoordinateData:CoordinateDataModel = JSON.parse(JSON.stringify(coordinateData))

    //First, get the noise function from what surface is being used
    let noise3D:NoiseFunction3D = loadedNoiseFunctions[surface.name]

    //Then, iterate through the CoordinateModel's cells and check if the noise intensity is above a threshold.
    let bGenerationFailure = false;
    utility.affectCoordinateDataCells((cellData:CoordinateData,chunkDataKey:string)=>{

        const x = cellData.position[0]/GROUND_SIZE
        const y = cellData.position[1]/GROUND_SIZE
        const z = cellData.position[2]/GROUND_SIZE

        let gamePosition:{chunkPosition:Vector3, relativePosition:Vector3};
        const chunkPositionString:string[] = chunkDataKey.split(",", 3)
        const chunkPosition:Vector3 = [parseInt(chunkPositionString[0]),parseInt(chunkPositionString[1]),parseInt(chunkPositionString[2])] 
        if(((x*GROUND_SIZE < 0)||(x*GROUND_SIZE > 1023)) || ((y*GROUND_SIZE < 0)||(y*GROUND_SIZE > 1023)) || ((z*GROUND_SIZE < 0)||(z*GROUND_SIZE > 1023))){
            gamePosition = utility.correctInvalidGameCoordinates({chunkPosition:chunkPosition,relativePosition:cellData.position})
        } else {
            gamePosition = {chunkPosition:chunkPosition,relativePosition:[x*GROUND_SIZE,y*GROUND_SIZE,z*GROUND_SIZE]}
        }

        //The recursive cave algorithm is dangerous and could lead to call stack exceptions, to prevent this, we dont generate the cave whenever this error occurs
        try {
            recursiveCaveAirAlgorithm(newCoordinateData,noise3D,gamePosition.relativePosition,gamePosition.chunkPosition);
        } catch (error) {
            console.error("A cave failed to generate: Maximum call stack size exceeded")
            bGenerationFailure = true;
        }
    },newCoordinateData)

    if(bGenerationFailure) return coordinateData;
    return newCoordinateData;
}

//A recursive Function that generates cave air.
function recursiveCaveAirAlgorithm(coordinateData:CoordinateDataModel, noise3D:NoiseFunction3D, relPosition:Vector3,chunkPosition:Vector3){

    const x = relPosition[0]/GROUND_SIZE
    const y = relPosition[1]/GROUND_SIZE
    const z = relPosition[2]/GROUND_SIZE

    let absolutePosition:Vector3 = utility.gamePositionToAbsolutePosition({chunkPosition:chunkPosition,relativePosition:relPosition})
    absolutePosition = [absolutePosition[0]/GROUND_SIZE,absolutePosition[1]/GROUND_SIZE,absolutePosition[2]/GROUND_SIZE]

    let intensityMask = noise3D(absolutePosition[0]/64,absolutePosition[1]/64,absolutePosition[2]/64)/2+0.5
    let intensity = fractalNoise3D(noise3D,[absolutePosition[0],absolutePosition[1],absolutePosition[2]],[32,32,16],3,0.5,2)
    let threshold = 0.50
    
    //This operation is REALLY expensive to run, keep caves to a minimum
    let caveMask = ((noise3D(absolutePosition[0]/64,absolutePosition[1]/64,absolutePosition[2]/64)*2-0.5))
    if(caveMask > 1) caveMask = 1; if(caveMask < 0) caveMask = 0; 

    if(fractalNoise3D(noise3D,[absolutePosition[0],absolutePosition[1],absolutePosition[2]],[32,32,16],3,0.5,2) * caveMask>0.60){

        //Get the position keys
        
        const cellKey = `${relPosition[0]},${relPosition[1]},${relPosition[2]}`
        const chunkKey = `${chunkPosition[0]},${chunkPosition[1]},${chunkPosition[2]}`
        //Set the position to air
        if(coordinateData[chunkKey] === undefined) coordinateData[chunkKey] = {}
        coordinateData[chunkKey][cellKey] = {
            type:"air",
            name:"Air",
            position:relPosition,
            size:[GROUND_SIZE,GROUND_SIZE,GROUND_SIZE],
            health:0
        }

        //Search for neighbours without air, if found, call itself
        let neighbours:Array<Vector3> = [[x-1,y,z],[x+1,y,z],[x,y-1,z],[x,y+1,z],[x,y,z-1],[x,y,z+1]]
        for (let i = 0; i < neighbours.length; i++) {
            //Get the new correct position and keys
            let gamePosition:{chunkPosition:Vector3, relativePosition:Vector3};
            const newChunkPosition:Vector3 = chunkPosition
            if(((neighbours[i][0]*GROUND_SIZE < 0)||(neighbours[i][0]*GROUND_SIZE > 1023)) || ((neighbours[i][1]*GROUND_SIZE < 0)||(neighbours[i][1]*GROUND_SIZE > 1023)) || ((neighbours[i][2]*GROUND_SIZE < 0)||(neighbours[i][2]*GROUND_SIZE > 1023))){
                gamePosition = utility.correctInvalidGameCoordinates({chunkPosition:newChunkPosition,relativePosition:[neighbours[i][0]*GROUND_SIZE,neighbours[i][1]*GROUND_SIZE,neighbours[i][2]*GROUND_SIZE]})
            } else {
                gamePosition = {chunkPosition:newChunkPosition,relativePosition:[neighbours[i][0]*GROUND_SIZE,neighbours[i][1]*GROUND_SIZE,neighbours[i][2]*GROUND_SIZE]}
            }
            const cellKey = `${gamePosition.relativePosition[0]},${gamePosition.relativePosition[1]},${gamePosition.relativePosition[2]}`
            const chunkKey = `${gamePosition.chunkPosition[0]},${gamePosition.chunkPosition[1]},${gamePosition.chunkPosition[2]}`
            
            if(coordinateData[chunkKey] === undefined) coordinateData[chunkKey] = {}
            if(coordinateData[chunkKey][cellKey] === undefined || coordinateData[chunkKey][cellKey].type !== "air"){
                recursiveCaveAirAlgorithm(coordinateData,noise3D,gamePosition.relativePosition,gamePosition.chunkPosition);
            }
        }
    }
}




//A Function that generates fractal noise from a noise3D function, 
export function fractalNoise3D(noise3D:NoiseFunction3D, absolutePosition:Vector3, noiseScale:Vector3 = [32,32,32], octaves:number = 1, persistance:number = 0.5, lacunarity:number = 2 ):number{

    let amplitude = 1;
    let frequency = 1;
    let intensity = 0;
    
    for (let i = 0; i < octaves; i++) {
        intensity += noise3D(absolutePosition[0]/noiseScale[0]*frequency,absolutePosition[1]/noiseScale[1]*frequency,absolutePosition[2]/noiseScale[2]*frequency)*amplitude;
        amplitude *= persistance;
        frequency *= lacunarity;
    }    
    
    return intensity;
}

export function generateGround(noise3D:NoiseFunction3D,crustMineables:{ [index:string]: Mineable},valuableMineables:{ [index:string]: Mineable},chunkPosition:Vector3,relPosition:Vector3):CoordinateData{
    let hardnessIndex = Math.ceil(Math.sqrt(chunkPosition[2]*-1))-1
    if(chunkPosition[2] < -16) hardnessIndex = Math.ceil(chunkPosition[2]/-8+2)-1
    let CoordinateData:CoordinateData;
    const absolutePosition = utility.gamePositionToAbsolutePosition({chunkPosition:chunkPosition, relativePosition:relPosition})
    //This generates ore valuables
    for (let i = 0; i < Object.keys(valuableMineables).length; i++) {
        const modAbsolutePosition:Vector3 = [absolutePosition[0]*-1.1+i*20000,absolutePosition[1]*-1.2+i*17000,absolutePosition[2]*-0.8+i*-9000]
        if(noise3D(modAbsolutePosition[0]/(valuableMineables[Object.keys(valuableMineables)[i]].scale*GROUND_SIZE), modAbsolutePosition[1]/(valuableMineables[Object.keys(valuableMineables)[i]].scale*GROUND_SIZE), modAbsolutePosition[2]/(valuableMineables[Object.keys(valuableMineables)[i]].scale*GROUND_SIZE))> valuableMineables[Object.keys(valuableMineables)[i]].threshold){
            CoordinateData = {
                type: valuableMineables[Object.keys(valuableMineables)[i]].type,
                name: valuableMineables[Object.keys(valuableMineables)[i]].name,
                position: relPosition,
                size: [GROUND_SIZE/2,GROUND_SIZE/2,GROUND_SIZE/2],
                health: valuableMineables[Object.keys(valuableMineables)[i]].baseHealth
            }
        }
        if(CoordinateData !== undefined) return CoordinateData;
    }
    //If no valuables are found, calulate surface
    const crustKeys = Object.keys(crustMineables)
    
    if(hardnessIndex < 0) hardnessIndex = 0; if(hardnessIndex > crustKeys.length) hardnessIndex = crustKeys.length-1;
    
    CoordinateData = {
    type: crustMineables[crustKeys[hardnessIndex]].type,
    name: crustMineables[crustKeys[hardnessIndex]].name,
    position: relPosition,
    size: [GROUND_SIZE/2,GROUND_SIZE/2,GROUND_SIZE/2],
    health: crustMineables[crustKeys[hardnessIndex]].baseHealth
    }
    return CoordinateData;
}

function filterNoMineZones(worldData: CoordinateDataModel): CoordinateDataModel {
    let newWorldData: CoordinateDataModel = JSON.parse(JSON.stringify(worldData))

    utility.affectCoordinateDataCells((cellData:CoordinateData, chunkPositionString:string)=>{
        const chunkPositionStringArray:string[] = chunkPositionString.split(",", 3)
        const chunkPosition:Vector3 = [parseInt(chunkPositionStringArray[0]),parseInt(chunkPositionStringArray[1]),parseInt(chunkPositionStringArray[2])] 
        const relPosition:Vector3 = cellData.position
        if(chunkPosition[2] >= 0){
            newWorldData[chunkPositionString] = undefined
        }
    },newWorldData)


    return newWorldData
}
