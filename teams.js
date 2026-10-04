'use strict';
const MAX_MEMBERS=3;
function assign(teams, preferred){
 if(preferred){const chosen=teams.find(t=>t.id===preferred);if(!chosen)throw Error('That team does not exist.');
 if(chosen.members.length>=MAX_MEMBERS)throw Error('That team already has three members.');return chosen;}
 return teams.find(t=>t.members.length<MAX_MEMBERS)||null;
}
function assignRole(team){return team.members.some(m=>m.role==='reader')?'engineer':'reader';}
module.exports={MAX_MEMBERS,assign,assignRole};
