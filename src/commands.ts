import * as NPC from "./npcSystem";
import NPCShops from "src/Data/NPCShops.json";
import PriceTable from "src/Data/PriceTable.json";
import { PlayerData, Players, Quest } from "./pluginTypes";
import Ores from "src/Data/Ores.json";
import * as quest from "./questSystem";
import NPCDialogue from "src/Data/NPCDialogue.json"
import * as utility from "src/utility";

export function viewInventory(playerName:string, playerData:Players, page:number, filter:string):void{
    const player = Omegga.getPlayer(playerName);
    filter = filter.toLowerCase();
    switch (filter) {
        case ("all"):
            break;
        case ("pickaxe"):
            filter = "toolPickaxe"
            break;
        case ("materials"):
            filter = "ground"
            break;
        default:
            Omegga.whisper(player,`<color="33bbff"><size="16">></></> The filter ''${filter}'' isn't an acceptable filter, try using these: (pickaxe, materials)`)
            return;
    }
    const playerInventory = playerData[playerName].inventory;   const inventoryKeys = Object.keys(playerInventory); let filteredInventory = {};
    if(filter !== "all"){
        for (let i = 0; i < inventoryKeys.length; i++) if(playerInventory[inventoryKeys[i]] && playerInventory[inventoryKeys[i]].type === filter) filteredInventory[inventoryKeys[i]] = playerInventory[inventoryKeys[i]];
    } else {
        filteredInventory = playerInventory;
    }
    const filteredKeys = Object.keys(filteredInventory);
    if(filteredKeys.length <= 0) {Omegga.whisper(player,`<color="33bbff"><size="16">></></> You dont have any of these kinds of items!`) ;return;};
    if(page > Math.ceil(filteredKeys.length/7)) page = Math.ceil(filteredKeys.length/7)+1;
    Omegga.whisper(player,`<color="33bbff"><size="16">></></> Viewing page <color="ffff00">${page}</> of <color="ffff00">${Math.ceil(filteredKeys.length/7)}</>`)
    for (let i = (page-1)*7; i < filteredKeys.length; i++) {
        
        if(playerInventory[filteredKeys[i]].type === "toolPickaxe") {
            let maxLevelTag = ""
            if(playerInventory[filteredKeys[i]].level >= playerInventory[filteredKeys[i]].maxLevel) maxLevelTag = '<color="ff0000"> MAXED!!</>'
            Omegga.whisper(player,`<color="33bbff"><size="16">></></> ${playerInventory[filteredKeys[i]].name}: (Damage: ${playerInventory[filteredKeys[i]].damage}, Level: ${playerInventory[filteredKeys[i]].level}${maxLevelTag})`);
        }
        if(playerInventory[filteredKeys[i]].type === "ground") {
            
            Omegga.whisper(player,`<color="33bbff"><size="16">></></> ${playerInventory[filteredKeys[i]].name}: (Amount: ${playerInventory[filteredKeys[i]].amount})`);
        }
    }
}

export function viewBalance(playerName:string, playerData:PlayerData) {
    Omegga.whisper(playerName,`<color="33bbff"><size="16">></></> You currently have <color="44ff44">¢${(playerData.credits).toFixed(2)}</> in your balance!`)
}

export async function option(playerName:string, playerData:PlayerData, option:number):Promise<PlayerData> {
    if(option === NaN) {
        Omegga.whisper(playerData.name,`That option is not a number!`)
        return playerData
    }
    const context = playerData.focusedCommand
    switch (context) {
        case 'NPC':
            playerData = await NPC.talkToNPC(playerData, option)
            break;

            
        case 'quests':
            NPC.clearUI(playerData)
            
            playerData = await quest.activateQuest(playerData, option, 0)
            playerData.focusedNPC = ''
            break;

        default:
            break;
    }
    return playerData
}

export function exit(playerName:string, playerData:PlayerData):PlayerData {
    const context = playerData.focusedCommand
    switch (context) {
        case 'shop':
            NPC.clearUI(playerData)
            playerData.focusedNPC = ''
            Omegga.whisper(playerName, "Exiting Shop")
            break;

        case 'quests':
            NPC.clearUI(playerData)
            playerData.focusedNPC = ''
            Omegga.whisper(playerName, "Exiting Quests")
            break;
    
        default:
            break;
    }
    return playerData
}

//This is a nice example of a fat function, dont do what I did, lol
export function buy(playerName:string, playerData:PlayerData, item:string[], amount:string = "1"):PlayerData {
    const itemString = item.join(' ')
    let processedAmount = parseInt(amount)
    if(processedAmount == NaN || processedAmount <= 0) return playerData;
    const context = playerData.focusedCommand
    switch (context) {
        case 'shop':
            //Translate 'mineables' 'placeables' 'tools'
            const shop = NPCShops[playerData.focusedNPC]
            const shopInventoryKeys = Object.keys(shop.inventory)
            let shopItems = {}
            for (let i = 0; i < shopInventoryKeys.length; i++) {
                switch (shopInventoryKeys[i]) {
                    case 'tools':
                        const priceTableKeysTools = Object.keys(PriceTable.tools)
                        for(let j = 0; j < priceTableKeysTools.length; j++) {
                            if(shopItems[priceTableKeysTools[j]] == undefined) {
                                shopItems[priceTableKeysTools[j]] = {
                                    name:priceTableKeysTools[j],
                                    price:PriceTable.tools[priceTableKeysTools[j]],
                                    bCanBuy:shop.inventory.tools.bCanBuy,
                                    bCanSell:shop.inventory.tools.bCanSell
                                }
                            }
                        }
                        break;
                    
                    case 'placeables':
                        const priceTableKeysPlace = Object.keys(PriceTable.placeables)
                        for(let j = 0; j < priceTableKeysPlace.length; j++) {
                            if(shopItems[priceTableKeysPlace[j]] == undefined) {
                                shopItems[priceTableKeysPlace[j]] = {
                                    name:priceTableKeysPlace[j],
                                    price:PriceTable.placeables[priceTableKeysPlace[j]],
                                    bCanBuy:shop.inventory.placeables.bCanBuy,
                                    bCanSell:shop.inventory.placeables.bCanSell
                                }
                            }
                        }
                        break;
        
                    case 'mineables':
                        const priceTableKeysMine = Object.keys(PriceTable.mineables)
                        for(let j = 0; j < priceTableKeysMine.length; j++) {
                            if(shopItems[priceTableKeysMine[j]] == undefined) {
                                
                                shopItems[priceTableKeysMine[j]] = {
                                    name:priceTableKeysMine[j],
                                    price:PriceTable.mineables[priceTableKeysMine[j]],
                                    bCanBuy:shop.inventory.mineables.bCanBuy,
                                    bCanSell:shop.inventory.mineables.bCanSell
                                }
                            }
                        }
                        break;
                
                    default:
                        const priceTableKeys = Object.keys(PriceTable)
                        for(let j = 0; j < priceTableKeys.length; j++) {
                            if(PriceTable[priceTableKeys[j]][shopInventoryKeys[i]] !== undefined){
                                shopItems[shopInventoryKeys[i]] = {
                                    name:shopInventoryKeys[i],
                                    price:PriceTable[priceTableKeys[j]][shopInventoryKeys[i]],
                                    bCanBuy:shop.inventory[shopInventoryKeys[i]].bCanBuy,
                                    bCanSell:shop.inventory[shopInventoryKeys[i]].bCanSell
                                }
                            }
                        }
                        break;
                }
            }
            const shopItemKeys = Object.keys(shopItems)
            let selectedItem: string;
            for (let i = 0; i < shopItemKeys.length; i++) {
                if (shopItems[shopItemKeys[i]].name.toLowerCase() === itemString.toLowerCase()){
                    selectedItem = shopItems[shopItemKeys[i]].name
                }
            }

            //Check if the requested item is on the current npc shop.
            if(selectedItem == undefined) {Omegga.whisper(playerData.name, `Item ${item} doesn't exist!`); return playerData;}
            //Check if said item can be bought.
            if(shopItems[selectedItem].bCanBuy === false) {Omegga.whisper(playerData.name, `This item cannot be bought`); return playerData;}

            // Generate prices
            const restructuredItemKeys = Object.keys(shopItems)
            for(let i = 0; i < restructuredItemKeys.length; i++) {
                //Apply a numeric price to %baseHealth%
                if(shopItems[restructuredItemKeys[i]].price.match('%baseHealth%') != undefined){
                    shopItems[restructuredItemKeys[i]].price = /*baseHealth*/(parseInt(shopItems[restructuredItemKeys[i]].price.replace('%baseHealth%', Ores[restructuredItemKeys[i]].baseHealth))) / 4
                }
            }
            
            //Check if the player has enough money to buy the items.
            let modifiedPrice = shopItems[selectedItem].price*processedAmount*shop.buyPriceMultiplier+(shopItems[selectedItem].price*processedAmount*shop.buyPriceMultiplier*shop.fee)
            if(playerData.credits < modifiedPrice) {Omegga.whisper(playerData.name, `You need ${modifiedPrice} to buy ${processedAmount} ${selectedItem}s!`); return playerData;}
            //After all of that, give the players items

            if(playerData.inventory[selectedItem] == undefined) {
                playerData = utility.createItemByName(playerData, selectedItem)
                playerData.inventory[selectedItem].amount = processedAmount
            } else {
                playerData.inventory[selectedItem].amount += processedAmount;
            }
            
        
            //Loop through price tables until a section with the right item is found, then set the price to that var

            //Take the players credits
            playerData.credits -= parseFloat(modifiedPrice.toFixed(2))
            Omegga.whisper(playerData.name, `Bought ${processedAmount} ${selectedItem} for ${modifiedPrice.toFixed(2)}!`)
            
            break;
    
        default:
            break;
    }
    return playerData;
}

//Code isn't very dry either
export function sell(playerName:string, playerData:PlayerData, item:string[], amount:string = "1"):PlayerData {
    const itemString = item.join(' ')
    let processedAmount = parseInt(amount)
    if(processedAmount == NaN || processedAmount <= 0) return playerData;;
    const context = playerData.focusedCommand
    switch (context) {
        case 'shop':
            //Translate 'mineables' 'placeables' 'tools'
            const shop = NPCShops[playerData.focusedNPC]
            const shopInventoryKeys = Object.keys(shop.inventory)
            let shopItems = {}
            for (let i = 0; i < shopInventoryKeys.length; i++) {
                switch (shopInventoryKeys[i]) {
                    case 'tools':
                        const priceTableKeysTools = Object.keys(PriceTable.tools)
                        for(let j = 0; j < priceTableKeysTools.length; j++) {
                            if(shopItems[priceTableKeysTools[j]] == undefined) {
                                shopItems[priceTableKeysTools[j]] = {
                                    name:priceTableKeysTools[j],
                                    price:PriceTable.tools[priceTableKeysTools[j]],
                                    bCanBuy:shop.inventory.tools.bCanBuy,
                                    bCanSell:shop.inventory.tools.bCanSell
                                }
                            }
                        }
                        break;
                    
                    case 'placeables':
                        const priceTableKeysPlace = Object.keys(PriceTable.placeables)
                        for(let j = 0; j < priceTableKeysPlace.length; j++) {
                            if(shopItems[priceTableKeysPlace[j]] == undefined) {
                                shopItems[priceTableKeysPlace[j]] = {
                                    name:priceTableKeysPlace[j],
                                    price:PriceTable.placeables[priceTableKeysPlace[j]],
                                    bCanBuy:shop.inventory.placeables.bCanBuy,
                                    bCanSell:shop.inventory.placeables.bCanSell
                                }
                            }
                        }
                        break;
        
                    case 'mineables':
                        const priceTableKeysMine = Object.keys(PriceTable.mineables)
                        for(let j = 0; j < priceTableKeysMine.length; j++) {
                            if(shopItems[priceTableKeysMine[j]] == undefined) {
                                
                                shopItems[priceTableKeysMine[j]] = {
                                    name:priceTableKeysMine[j],
                                    price:PriceTable.mineables[priceTableKeysMine[j]],
                                    bCanBuy:shop.inventory.mineables.bCanBuy,
                                    bCanSell:shop.inventory.mineables.bCanSell
                                }
                            }
                        }
                        break;
                
                    default:
                        const priceTableKeys = Object.keys(PriceTable)
                        for(let j = 0; j < priceTableKeys.length; j++) {
                            if(PriceTable[priceTableKeys[j]][shopInventoryKeys[i]] !== undefined){
                                shopItems[shopInventoryKeys[i]] = {
                                    name:shopInventoryKeys[i],
                                    price:PriceTable[priceTableKeys[j]][shopInventoryKeys[i]],
                                    bCanBuy:shop.inventory[shopInventoryKeys[i]].bCanBuy,
                                    bCanSell:shop.inventory[shopInventoryKeys[i]].bCanSell
                                }
                            }
                        }
                        break;
                }
                
            }
            const shopItemKeys = Object.keys(shopItems)
            let selectedItem: string;
            for (let i = 0; i < shopItemKeys.length; i++) {
                if (shopItems[shopItemKeys[i]].name.toLowerCase() === itemString.toLowerCase()){
                    selectedItem = shopItems[shopItemKeys[i]].name
                }
            }

            
            //Check if the requested item is on the current npc shop.
            if(selectedItem == undefined) {Omegga.whisper(playerData.name, `Item ${selectedItem} doesn't exist!`); return playerData;}
            //Check if said item can be sold.
            if(shopItems[selectedItem].bCanSell === false) {Omegga.whisper(playerData.name, `This item cannot be sold`); return playerData;}
            //Check if the player has any of the items to sell.
            if(playerData.inventory[selectedItem] == undefined) {Omegga.whisper(playerData.name, `You dont own any ${selectedItem}!`); return playerData;}
            //Check if the player is selling more items than they have, if so, set it to the amount they have.
            if(playerData.inventory[selectedItem].amount < processedAmount) processedAmount = playerData.inventory[selectedItem].amount;
            //After all of that, take the players items
            playerData.inventory[selectedItem].amount -= processedAmount;
            //If the items amount is < 0 remove it
            if(playerData.inventory[selectedItem].amount <= 0) playerData.inventory[selectedItem] = undefined;

            const restructuredItemKeys = Object.keys(shopItems)
            
            for(let i = 0; i < restructuredItemKeys.length; i++) {
                //Apply a numeric price to %baseHealth%
                if(shopItems[restructuredItemKeys[i]].price.match('%baseHealth%') != undefined){
                    shopItems[restructuredItemKeys[i]].price = (parseInt(shopItems[restructuredItemKeys[i]].price.replace('%baseHealth%', Ores[restructuredItemKeys[i]].baseHealth))) / 4
                }
            }
            //Give the player the credits
            playerData.credits += parseFloat((shopItems[selectedItem].price*processedAmount-(shopItems[selectedItem].price*processedAmount*shop.fee)).toFixed(2))
            Omegga.whisper(playerData.name, `Sold ${processedAmount} ${selectedItem} for ${(shopItems[selectedItem].price*processedAmount-(shopItems[selectedItem].price*processedAmount*shop.fee)).toFixed(2)}!`)

            break;
            
    
        default:
            break;
    }
    return playerData;
}

export function viewQuests(playerData: PlayerData) {
    let newPlayerData: PlayerData = JSON.parse(JSON.stringify(playerData))
    Omegga.whisper(newPlayerData.name,`Your active quests`)
    const NpcKeys = Object.keys(NPCDialogue)
    let orderedQuestArray = []
    for (let i = 0; i < NpcKeys.length; i++) {
        const quests = newPlayerData.activeQuests[NpcKeys[i]];
        if(quests == undefined) continue;
        for (let j = 0; j < quests.length; j++) {
            const quest = quests[j];
            console.log(quest)
            if(quest == undefined) continue;
            orderedQuestArray.push(quest)
            Omegga.whisper(newPlayerData.name, `[<color="ff4444">${quest.difficulty}</>] ${quest.objective.t}, <color="44ff44">¢${quest.reward}</> reward from ${NpcKeys[i]}`)
        }
    }
    if(orderedQuestArray.length <= 0) {
        Omegga.whisper(playerData.name, `You dont have any active quests!`)
    }
}


export function cancelQuest(playerData: PlayerData, option: number):PlayerData {
    if(option === NaN) {
        Omegga.whisper(playerData.name,`That option is not a number!`)
        return playerData;
    }
    let newPlayerData: PlayerData = JSON.parse(JSON.stringify(playerData))
    let orderedQuestArray = []
    const NpcKeys = Object.keys(NPCDialogue)
    for (let i = 0; i < NpcKeys.length; i++) {
        const quests = newPlayerData.activeQuests[NpcKeys[i]];
        if(quests == undefined) continue;
        for (let j = 0; j < quests.length; j++) {
            const quest = quests[j];
            orderedQuestArray.push(quest)
        }
    }
    if(orderedQuestArray.length <= 0) {
        Omegga.whisper(playerData.name, `You dont have any active quests!`)
        return playerData;
    }
    if(option <= 0 || option > orderedQuestArray.length) {
        Omegga.whisper(playerData.name, `Option ''${option}'' isn't a valid choice.`)
        return playerData;
    }
    const questForDeletion:Quest = orderedQuestArray[option-1]
    for (let i = 0; i < NpcKeys.length; i++) {
        const quests = newPlayerData.activeQuests[NpcKeys[i]];
        if(quests == undefined) continue;
        for (let j = 0; j < quests.length; j++) {
            if(quests[j] == undefined) continue;
            if(newPlayerData.activeQuests[NpcKeys[i]][j] == questForDeletion){
                Omegga.whisper(playerData.name, `Cancelled quest ${newPlayerData.activeQuests[NpcKeys[i]][j].objective.t} for ${NpcKeys[i]}`)
                newPlayerData.activeQuests[NpcKeys[i]].splice(j,1)
                delete newPlayerData.lockedQuestsNPC[NpcKeys[i]]
            }
        }
    }
    return newPlayerData;
}