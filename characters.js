'use strict';
// GLB skeletal character playback, independent of game state/HP calculations.
const ArenaCharacters3D=ArenaArt3D?(()=>{
  const A=ArenaArt3D,{T,G,C}=A;
  const profiles={guard:1,archer:.88,colossus:1.45,imp:.78,mage:.96,hounds:.9,swarm:.69,brute:1.35};
  function build(u){const root=new T.Group(),body=new T.Group();root.add(body);const s=profiles[u.id]||1,rig=ArenaCharacterModels.instantiate(u.id,u.team,body);body.scale.setScalar(s);const animal=u.id==='hounds',rock=u.id==='swarm';A.contact(root,0,0,(u.big?27:19)*s,(u.big?20:14)*s,.12);
    const ring=A.mesh(root,G.torus,new T.MeshBasicMaterial({color:A.lin(C.team[u.team]),toneMapped:false,transparent:true,opacity:.58,depthWrite:false}),0,.24,0,10*s,10*s,4,-Math.PI/2,0,0,false);ring.userData.ownedMaterial=true;
    const hp=A.health(root,u.team,19,((animal?26:rock?20:42)*s+5));let lastX=u.x,lastZ=u.y,ry=u.team?0:Math.PI,age=0,lastHp=u.hp,lastCd=u.cd,lastAttack=u.attackSeq||0,hit=0,attack=0,dying=false;
    root.position.set(u.x,0,u.y);body.rotation.y=ry;
    return {u,root,dispose:()=>rig.dispose(),death(){if(!dying){dying=true;hp.root.visible=false;ring.visible=false;rig.pose('Death',0,1,true)}},updateDeath(dt){rig.pose('Death',dt)},update(time,dt,cam){age+=dt;const dx=u.x-lastX,dz=u.y-lastZ,moving=Math.hypot(dx,dz)>.025;lastX=u.x;lastZ=u.y;if(moving||u.attacking&&Number.isFinite(u.targetX)&&Number.isFinite(u.targetY)){let a=(moving?Math.atan2(dx,dz):Math.atan2(u.targetX-u.x,u.targetY-u.y))-ry;a=Math.atan2(Math.sin(a),Math.cos(a));ry+=a*Math.min(1,dt*13)}if(u.hp<lastHp)hit=.26;if((u.attackSeq||0)!==lastAttack||u.cd>lastCd+.08)attack=.55;lastAttack=u.attackSeq||0;lastHp=u.hp;lastCd=u.cd;hit=Math.max(0,hit-dt);attack=Math.max(0,attack-dt);let clip=age<.36?'Spawn':attack>0?'Attack':hit>0?'Hit':moving?'Walk':'Idle';rig.pose(clip,dt,clip==='Walk'?Math.max(.75,Math.min(1.7,u.s/38)):1);body.rotation.y=ry;const crossing=Math.abs(u.y-280)<22&&Math.min(Math.abs(u.x-90),Math.abs(u.x-270))<=34;root.position.set(u.x,(crossing?4:0)+(moving?Math.abs(Math.sin(time*10))*0.65:0),u.y);A.updateHealth(hp,u.hp/u.max,cam,u.hp<u.max);}};
  }
  return {build};
})():null;
