import OmeggaPlayer from 'omegga';

/**
 * 
 * @param player by uuid, name, controller, state, or player object
 * @param role 
 * @return true or false depending if the user has a role
 */
export function getPermission(player:string|OmeggaPlayer, role:string) {
    let playerObject;
    if(typeof player === "string") playerObject = Omegga.getPlayer(player); else playerObject = player;

    const playerRoles = playerObject.getRoles()

    for (let i = 0; i < playerRoles.length; i++) {
        if(playerRoles[i] = role) return true;
    }
    
    return false;
}
