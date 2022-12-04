import { Mineable, PlayerData, Quest } from "./pluginTypes";
import NPCDialogue from 'src/Data/NPCDialogue.json';
import Ores from 'src/Data/Ores.json';
import * as utility from 'src/utility'

export function generateQuests(playerData:PlayerData):PlayerData {
    
    let newPlayerData:PlayerData = JSON.parse(JSON.stringify(playerData))
    const npcNames = Object.keys(NPCDialogue)
    for (let i = 0; i < npcNames.length; i++) {
        let npcQuests = [];
        let oreObject = JSON.parse(JSON.stringify(Ores));
        for (let j = 0; j < Math.floor(newPlayerData.questInfo.completedQuests[npcNames[i]] / 10 + 1)*3 && j < 30; j++) {

            
            let quest:Quest = {
                type:null, // Fetch, Kill?, Discover, Activate
                difficulty: Math.ceil((j+1)/3), //Based on the tier, sets the minimum/maximum amount of value objective wants
                objective:null, // an object with information about how to complete the quest
                reward:null // The amount of credits given, maybe exp later on. This doesn't include the item after finishing a quest.
            }
            
            // calculate the value so we know what we may need for the quest
            const value = Math.floor((quest.difficulty**5)*50 - (Math.random()* (quest.difficulty**5)*50))+100 //Generates a random quest value from current difficulty and the next
            // generate the reward amount for the quest based off the value
            let reward = (value.toString()).slice(0,2)
            
            for(let k = 0; k < (value.toString().length-2); k++){
                reward += "0"
            }
            quest.reward = parseInt(reward)
            
            //set the type of mission. **More mission types planned**
            const typeArray = ["Fetch"]
            quest.type = typeArray[Math.floor(Math.random()*1)]

            //get the objective based on the type of mission and value

            switch (quest.type) {
                case "Fetch":
                    //To make quests worth doing, the value is double ore hp, instead of 1/4 in /sell.
                    //I take all the ores from the JSON file (Replace this to the live variable discovered ores object later) 
                    //Then make sure value is greater than the ore, and the value is less than 100x greater. (To prevent high tier quests requesting a bunch of low level ores)
                    let validOreArray:Array<Mineable> = []

                    const oreKeys = Object.keys(oreObject)
                    
                    for (let k = 0; k < oreKeys.length; k++) {
                        const ore:Mineable = oreObject[oreKeys[k]]
                        
                        if(ore.baseHealth*2 < value && value < ore.baseHealth*200) {
                            validOreArray.push(oreObject[oreKeys[k]])
                        }
                    }
                    //After filtering, we select the ore randomly from the array and set the amount needed

                    const selectedOre = validOreArray[Math.floor(Math.random()*validOreArray.length)]

                    if(selectedOre == undefined) break; //selectedOre only becomes undefined when no appropriate ores of value are there, therefore we generate less quests.
                    
                    delete oreObject[selectedOre.name];
                    
                    
                    
                    quest.objective = {
                        item: selectedOre.name,
                        amount: Math.ceil(value/(selectedOre.baseHealth*2)),
                        t: `Collect ${Math.ceil(value/(selectedOre.baseHealth*2))} <color="${utility.rgbToHex(selectedOre.brickData.color)}">${selectedOre.name}</>`
                    }
                    
                    break;
            
                default:
                    break;
            }
            if(quest.objective === null) continue;
            npcQuests.push(quest)
        }
        
        newPlayerData.questInfo.availableQuests[npcNames[i]] = npcQuests;
    }
    return newPlayerData;
}

export async function activateQuest(playerData: PlayerData, option: number, personal:number): Promise<PlayerData> {
    let newPlayerData: PlayerData = JSON.parse(JSON.stringify(playerData))
    let filteredQuests: Array<Quest> = []
    switch (personal) {
        case 0: //Activated through personal means
            const page = newPlayerData.UIPage
            const questArray = newPlayerData.questInfo.availableQuests[newPlayerData.focusedNPC]

            //Filter the quests by tier
            for (let i = 0; i < questArray.length; i++) {
                if(questArray[i].difficulty === page) {
                    filteredQuests.push(questArray[i])
                }
            }
            //Filter bad options
            if(option < 0 && option >= filteredQuests.length) {
                Omegga.whisper(playerData.name, `Option ''${option+1}'' isn't a valid choice.`)
                return playerData;
            }
            //Lock the quest, preventing the player from accepting another one personally from this NPC, until they complete or cancel it.
            
            newPlayerData.questInfo.lockedQuestsNPC[newPlayerData.focusedNPC] = filteredQuests[option-1]
            if(newPlayerData.questInfo.activeQuests[newPlayerData.focusedNPC] == undefined) newPlayerData.questInfo.activeQuests[newPlayerData.focusedNPC] = []
            newPlayerData.questInfo.activeQuests[newPlayerData.focusedNPC].push(filteredQuests[option-1])

            Omegga.whisper(newPlayerData.name,`<color="ffff00">${newPlayerData.focusedNPC}</>: Stay safe out in the mines!`)
            const playerPositions = await Omegga.getAllPlayerPositions()
            let savedPlayerPosition:[number,number,number];
            for (let i = 0; i < playerPositions.length; i++) {
                const playerPosition = playerPositions[i];
                if(playerPosition.player.name == playerData.name) {
                    savedPlayerPosition = playerPosition.pos as [number,number,number]
                }
            }
            //Offsets have a -1 attached to them because they're not positioned at the origin in the save.
            Omegga.middlePrint(newPlayerData.name,`<size="24">Quest Started!</> <br><br> <size="16">${filteredQuests[option-1].objective.t}</>`)
            Omegga.loadBricks('BrickadiaMining-Structures/QuestSounds/QuestStarterSound', {quiet:true, offX:savedPlayerPosition[0]-1, offY:savedPlayerPosition[1]-1, offZ:savedPlayerPosition[2]-1,})

            setTimeout(()=>{
                Omegga.clearRegion({center:savedPlayerPosition, extent:[1,1,1]})
            },1800)
            
            break;
        
        case 1: //Activated through the party system.
            //Prerequisites include the actual party system lol
            break;
    
        default:
            break;
    }
    return newPlayerData;
}

export function completeQuests(playerData: PlayerData):PlayerData {
    //Move the quest from active to pending

    let newPlayerData: PlayerData = JSON.parse(JSON.stringify(playerData))
    const NpcKeys = Object.keys(NPCDialogue)
    for (let i = 0; i < NpcKeys.length; i++) {
        const quests = newPlayerData.questInfo.activeQuests[NpcKeys[i]];
        if(quests == undefined) continue;
        for (let j = 0; j < quests.length; j++) {
            const quest = quests[j];
            if(quest == undefined) continue;

            switch (quest.type) {
                case "Fetch":
                    if(newPlayerData.inventory[quest.objective.item] == undefined) continue;
                    if(newPlayerData.inventory[quest.objective.item].amount >= quest.objective.amount ) {
                        if(newPlayerData.questInfo.donePendingQuests[NpcKeys[i]] == undefined) newPlayerData.questInfo.donePendingQuests[NpcKeys[i]] = []
                        newPlayerData.questInfo.donePendingQuests[NpcKeys[i]].push(newPlayerData.questInfo.activeQuests[NpcKeys[i]][j])
                        newPlayerData.questInfo.activeQuests[NpcKeys[i]].splice(j,1)
                        delete newPlayerData.questInfo.lockedQuestsNPC[NpcKeys[i]]
                    }
                    break;
            
                default:
                    break;
            }
        }
    }



    return newPlayerData;
}

export async function redeemPendingQuests(playerData: PlayerData):Promise<PlayerData> {
    //Remove quest from pending and get the rewards!

    let newPlayerData: PlayerData = JSON.parse(JSON.stringify(playerData))

    newPlayerData.credits += newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].reward;
    newPlayerData.inventory[newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].objective.item].amount -= newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].objective.amount
    if(newPlayerData.inventory[newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].objective.item].amount <= 0) delete newPlayerData.inventory[newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].objective.item]
    
    for (let i = 0; i < newPlayerData.questInfo.availableQuests[newPlayerData.focusedNPC].length; i++) {
        if(newPlayerData.questInfo.availableQuests[newPlayerData.focusedNPC][i].objective.t == newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].objective.t && newPlayerData.questInfo.availableQuests[newPlayerData.focusedNPC][i].reward == newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].reward) {
            newPlayerData.questInfo.availableQuests[newPlayerData.focusedNPC].splice(i,1)
        }  
    }


    const playerPositions = await Omegga.getAllPlayerPositions()
    let savedPlayerPosition:[number,number,number];
    for (let i = 0; i < playerPositions.length; i++) {
        const playerPosition = playerPositions[i];
        if(playerPosition.player.name == playerData.name) {
            savedPlayerPosition = playerPosition.pos as [number,number,number]
        }
    }

    Omegga.middlePrint(newPlayerData.name,`<size="24">Quest Complete!</> <br><br> <size="16">${newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC][0].objective.t}</>`)
    Omegga.loadBricks('BrickadiaMining-Structures/QuestSounds/QuestCompleteSound', {quiet:true, offX:savedPlayerPosition[0]-1, offY:savedPlayerPosition[1]-1, offZ:savedPlayerPosition[2]-1,})

    setTimeout(()=>{
        Omegga.clearRegion({center:savedPlayerPosition, extent:[1,1,1]})
    },9000)

    newPlayerData.questInfo.donePendingQuests[newPlayerData.focusedNPC].shift()

    chooseSpecialReward(newPlayerData);

    return newPlayerData;
}

function chooseSpecialReward(playerData: PlayerData): PlayerData{
    //Add a function here that waits for an /option input so you can choose your weapon before getting the next reward
    return playerData;
}
