const interactRegExp =
  /^Player "(?<name>[^"]+)" \((?<id>[^,]+), (?<pawn>[^,]+), (?<controller>[^)]+)\) interacted with brick "(?<brick>[^\"]+)" at (?<x>-?\d+) (?<y>-?\d+) (?<z>-?\d+), message: "(?<message>.*)".$/;
const NPCRegExp = 
  /^NPC:.+$/

/**
 * Call only once on plugin init.
 */
export function addMineMatcher(gameState) {
    //The reason I'm making this it's own custom matcher is because I need the interact event to be debounced to hopefully increase performance in some capacity.
    //This version of interaction is more simplistic to it's official counterpart, given that the extra code is bloat.
    Omegga.addMatcher(
        //Pattern
        (_line, logMatch)=>{
          if(!gameState.gameLoop.state) return;
          
          if(!logMatch) return;

          const { generator, data } = logMatch.groups;

          if(generator !== 'LogBrickadia') return;

          const match = data.match(interactRegExp)

          if(match) {
            if(Date.now() - gameState.playersData[match.groups.name].lastInteractCall < 150) return;
            gameState.playersData[match.groups.name].lastInteractCall = Date.now()
            if(match.groups.message) return; //Mining in this gamemode is the only operation that shouldn't use messages.
            


            return {
              player: {
                id: match.groups.id,
                name: match.groups.name,
                controller: match.groups.controller,
                pawn: match.groups.pawn
              },
              brick_name: match.groups.brick,
              position: [
                Number(match.groups.x),
                Number(match.groups.y),
                Number(match.groups.z)
              ]
            }
          }

        },
        //Callback
        (interaction) => {
          Omegga.emit('minebrick',interaction)
          return true;
        }
    )
}

export function addNPCMatcher(gameState) {
  Omegga.addMatcher(
      //Pattern
      (_line, logMatch)=>{
        if(!gameState.gameLoop.state) return;
        
        if(!logMatch) return;
        const { generator, data } = logMatch.groups;

        if(generator !== 'LogBrickadia') return;

        const match = data.match(interactRegExp)

        if(match) {
          const matchNPC = match.groups.message.match(NPCRegExp)
          if(!matchNPC) return;
          
          if(Date.now() - gameState.playersData[match.groups.name].lastInteractCall < 1000) return;
          gameState.playersData[match.groups.name].lastInteractCall = Date.now()



          return {
            player: {
              id: match.groups.id,
              name: match.groups.name,
              controller: match.groups.controller,
              pawn: match.groups.pawn
            },
            /*brick_name: match.groups.brick,
            position: [
              Number(match.groups.x),
              Number(match.groups.y),
              Number(match.groups.z)
            ],*/
            NPC: match.groups.message.substring(4)
          }
        }

      },
      //Callback
      (interaction) => {
        Omegga.emit('triggerNpc',interaction)
        return true;
      }
  )
}
