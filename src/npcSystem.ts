import { Mineable, PlayerData } from "./pluginTypes";
import NPCDialogue from 'src/Data/NPCDialogue.json'
import NPCShops from 'src/Data/NPCShops.json'
import PriceTable from 'src/Data/PriceTable.json'
import Ores from 'src/Data/Ores.json'
import * as Quests from "./questSystem";

export async function focusOnNPC(playerData:PlayerData, npcName):Promise<PlayerData> {

    let newPlayerData:PlayerData = JSON.parse(JSON.stringify(playerData))
    newPlayerData = Quests.completeQuests(playerData)
    newPlayerData.contextNPC = 'greet'
    newPlayerData.focusedCommand = 'NPC';
    switch (npcName) {
        case 'Minerals Expert':
            newPlayerData.focusedNPC = 'Minerals Expert'
            break;
    
        default:
            break;
    }
    newPlayerData = await talkToNPC(newPlayerData, 0)
    return newPlayerData
}

export function defocusOnNPC(playerData:PlayerData):PlayerData {
    let newPlayerData:PlayerData = JSON.parse(JSON.stringify(playerData))
    newPlayerData.focusedNPC = '';
    newPlayerData.focusedCommand = '';
    newPlayerData.contextNPC = '';
    return newPlayerData
}

export async function talkToNPC(playerData:PlayerData, option:number):Promise<PlayerData>{
    let newPlayerData:PlayerData = JSON.parse(JSON.stringify(playerData))
    if(newPlayerData.donePendingQuests[newPlayerData.focusedNPC] != undefined && newPlayerData.donePendingQuests[newPlayerData.focusedNPC].length > 0) {
        newPlayerData = await Quests.redeemPendingQuests(playerData);
    }
    let texts:Array<string> = accessNPCDialogueTree(newPlayerData.focusedNPC,newPlayerData.contextNPC,`option${option}`)
    if(option !== 0 && NPCDialogue[newPlayerData.focusedNPC][newPlayerData.contextNPC][`option${option}`] != undefined) newPlayerData.contextNPC = NPCDialogue[newPlayerData.focusedNPC][newPlayerData.contextNPC][`option${option}`]
    for(let i = 0; i < texts.length; i++){
        texts[i] = texts[i].replace('%player%', newPlayerData.name)
        texts[i] = texts[i].replace('%notFound%', "%options%")
    }
    for (let i = 0; i < texts.length; i++) {
        setTimeout(()=>{
            if (texts[i].match(/%shop_UI\(\)%/) != undefined) {
                texts[i] = texts[i].replace(/%shop_UI\(\)%/, '')
                newPlayerData = triggerShopUI(newPlayerData, newPlayerData.focusedNPC, "1");
                newPlayerData.UIPage = 1
            }
            if (texts[i].match(/%quest_UI\(\)%/) != undefined) {
                texts[i] = texts[i].replace(/%quest_UI\(\)%/, '')
                if(newPlayerData.lockedQuestsNPC[playerData.focusedNPC] != undefined) {
                    texts[i] = "Finish the quest you accepted from me before asking for more jobs."
                    newPlayerData.focusedCommand = ""
                } else {
                    newPlayerData = triggerQuestUI(newPlayerData, newPlayerData.focusedNPC, "1");
                    newPlayerData.UIPage = 1
                }
            }
            if(texts[i].match(/%options%/) != undefined) {
                let txtArray = []
                for(let j = 0; j < Object.keys(NPCDialogue[newPlayerData.focusedNPC][newPlayerData.contextNPC]).length; j++){
                    if(j === 0) continue; // Since the text property will always be the first item, a simple check will do just fine as long as nobody incorrectly uses NPCDialogue
                    txtArray.push(`/option ${j}: ${NPCDialogue[newPlayerData.focusedNPC][newPlayerData.contextNPC][Object.keys(NPCDialogue[newPlayerData.focusedNPC][newPlayerData.contextNPC])[j]]}`)  
                }
                const newTxt = `<color="777777"><size="12">${txtArray.join(", ")}</></>`
                try {
                    Omegga.whisper(newPlayerData.name,newTxt)
                } catch (error) {
                    console.info(`Plugin Attempted to send whisperText to ${newPlayerData.name} but they couldn't be found. Ignoring.`)
                }
                return;
            }
            Omegga.whisper(newPlayerData.name,`<color="ffff00">${newPlayerData.focusedNPC}</>: ${texts[i]}`)


        },i*1500)
    }
    return newPlayerData
}

function accessNPCDialogueTree(npcName,location,option:string):Array<string>{
    if(option === "option0") return NPCDialogue[npcName][location].t
    if(NPCDialogue[npcName][location][option] == undefined) return ['%notFound%'];
    const result = NPCDialogue[npcName][NPCDialogue[npcName][location][option]].t
    return JSON.parse(JSON.stringify(result))
}


//Quests

export function triggerQuestUI(playerData:PlayerData, npcName:string, page:string):PlayerData {
    if(parseInt(page) == NaN) return playerData;
    playerData.focusedCommand = "quests"
    playerData.UIData = getQuestUIData(npcName, playerData);

    //Page constructor
    let UIpageArray = [] //Ideally the section of the quests could be pulled in using a formula, but since data pulled from the quest generator isn't always 3 per tier, we have to check for difficulty.

    for(let i = 0; i < playerData.UIData.length; i++){
        const match = playerData.UIData[i].match(/\[<color="ff4444">(?<difficulty>\d)<\/>\]/)
        if(match.groups != undefined && match.groups.difficulty == page) {
            UIpageArray.push(playerData.UIData[i])
        }
    }
    let UIPage = `<size="12">Tier ${page} of ${Math.ceil(playerData.completedQuests[npcName]/3+1)}</> <br> ${UIpageArray.join(`<br>`)} <br> <size="12"><color="777777">/? quests</></>`
    Omegga.middlePrint(playerData.name, UIPage)
    playerData.focusedUI = setInterval(()=>{
        try {
            Omegga.middlePrint(playerData.name, UIPage)
        } catch (error) {
            console.info(`Plugin Attempted to send middleText to ${playerData.name} but they couldn't be found. Ignoring...`)
        }
        
    },3000)
    return playerData;
}

function getQuestUIData(npcName: string, playerData: PlayerData): Array<string> {
    const newPlayerData:PlayerData = JSON.parse(JSON.stringify(playerData))
    const npcQuests = newPlayerData.availableQuests[npcName]
    let questStringArray = []

    for(let i = 0; i < npcQuests.length; i++){
        const quest = npcQuests[i]
        
        questStringArray.push(`[<color="ff4444">${quest.difficulty}</>] Type: ${quest.type}, ''${quest.objective.t}'', Reward: <color="44ff44">¢${quest.reward}</>`)
    }
    return questStringArray;
}


//Shops
export function triggerShopUI(playerData:PlayerData, npcName:string, page:string):PlayerData {
    if(parseInt(page) == NaN) return playerData;
    const pageIndex = parseInt(page)-1
    playerData.focusedCommand = "shop"
    playerData.UIData = getShopUIData(npcName);

    //Page constructor
    let UIpageArray = playerData.UIData.slice(pageIndex*6,pageIndex*6+6)
    let UIPage = `<size="12">Page ${page} of ${Math.ceil(playerData.UIData.length/6)}</> <br> ${UIpageArray.join(`<br>`)} <br> <size="12"><color="777777">/? shops</></>`
    Omegga.middlePrint(playerData.name, UIPage)
    playerData.focusedUI = setInterval(()=>{
        try {
            Omegga.middlePrint(playerData.name, UIPage)
        } catch (error) {
            console.info(`Plugin Attempted to send middleText to ${playerData.name} but they couldn't be found. Ignoring...`)
        }
        
    },3000)
    return playerData;
}

export function clearUI(playerData:PlayerData):void {
    clearInterval(playerData.focusedUI);
    if(playerData.focusedCommand != ""){
        Omegga.middlePrint(playerData.name, `<br>`)
    }
    playerData.focusedCommand = ""
    playerData.UIData = []
}

function getShopUIData(npcName):Array<string> {
    const shop = NPCShops[npcName]
    const shopItemKeys = Object.keys(shop.inventory)
    let shopItems = {}
    for (let i = 0; i < shopItemKeys.length; i++) {
        switch (shopItemKeys[i]) {
            case 'tools':
                const priceTableKeysTools = Object.keys(PriceTable.tools)
                for(let j = 0; j < priceTableKeysTools.length; j++) {
                    if(shopItems[priceTableKeysTools[j]] == undefined) {
                        shopItems[priceTableKeysTools[j]] = {
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
                    if(PriceTable[priceTableKeys[j]][shopItemKeys[i]] !== undefined){
                        shopItems[shopItemKeys[i]] = {
                            price:PriceTable[priceTableKeys[j]][shopItemKeys[i]],
                            bCanBuy:shop.inventory[shopItemKeys[i]].bCanBuy,
                            bCanSell:shop.inventory[shopItemKeys[i]].bCanSell
                        }
                    }
                }
                break;
        }
    }

    const restructuredItemKeys = Object.keys(shopItems)
    let shopMessagesArray = []
    for(let i = 0; i < restructuredItemKeys.length; i++) {
        //Apply a numeric price to %baseHealth%
        if(shopItems[restructuredItemKeys[i]].price.match('%baseHealth%') != undefined){
            shopItems[restructuredItemKeys[i]].price = /*baseHealth*/(parseInt(shopItems[restructuredItemKeys[i]].price.replace('%baseHealth%', Ores[restructuredItemKeys[i]].baseHealth))) / 4
        }
    
        //message constructor
        let message = `${restructuredItemKeys[i]}: `
        if(shopItems[restructuredItemKeys[i]].bCanBuy) message += `<size="10">Buy</> <color="cc3333">${shopItems[restructuredItemKeys[i]].price*shop.buyPriceMultiplier + /*Fee*/(shopItems[restructuredItemKeys[i]].price*shop.buyPriceMultiplier*shop.fee)}</> `
        if(shopItems[restructuredItemKeys[i]].bCanSell) message += `<size="10">Sell</> <color="33cc33">${shopItems[restructuredItemKeys[i]].price - /*Fee*/(shopItems[restructuredItemKeys[i]].price*shop.fee)}</> `
    
        shopMessagesArray.push(message)
    }

    return shopMessagesArray;
}