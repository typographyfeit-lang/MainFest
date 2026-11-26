'use strict';
const ArenaTowers3D=ArenaArt3D?(()=>{
  const A=ArenaArt3D,{T,G,C,TAU}=A;
  const stones=['#9c828b','#b89a94','#856d80','#a98c8d','#927a87'];
  function build(t){
    const root=new T.Group();root.position.set(t.x,0,t.y);const intact=new T.Group(),ruins=new T.Group();root.add(intact,ruins);ruins.visible=false;
    const batch=A.batch(intact),team=t.team,tc=C.team[team],cloth=A.material(C.cloth[team],'cloth'),trim=A.material(C.trim[team],'cloth'),emit=A.material(tc,'glow'),dark=A.material('#3b2c43');
    const stone=A.stone,rand=A.rng(t.x*127+t.y*77),color=()=>stones[Math.floor(rand()*stones.length)],banners=[];
    const bx=(x,y,z,w,h,d,col=color(),ry=0)=>batch.add(G.bevel,stone,x,y,z,w,h,d,0,ry,0,col);
    const sm=(geo,mat,x,y,z,w,h,d,rx=0,ry=0,rz=0,shadow=true)=>batch.add(geo,mat,x,y,z,w,h,d,rx,ry,rz,null,shadow);
    let orb,guardian,staff,ring,coreLight,attack=0,peak;const high=new URLSearchParams(location.search).get('quality')==='high';
    if(t.king){
      peak=117;intact.scale.set(1.12,1.10,1.12);ruins.scale.setScalar(1.10);
      ArenaHDModels.add(intact,'citadel-hd');
      sm(G.cyl,trim,0,52,0,20,3,20);sm(G.cyl,emit,0,55.2,0,14,1,14,0,0,0,false);
      // Visible arched windows around the circular citadel.
      for(const a of [-2.45,-1.12,1.12,2.45]){const x=Math.sin(a)*30.7,z=Math.cos(a)*30.7;sm(G.arch,A.material('#493644'),x,25,z,12.8,22,2.7,0,a);sm(G.arch,emit,x*1.045,25,z*1.045,8.6,17,1.5,0,a,0,false);sm(G.arch,A.material('#bd9372','gold'),x*1.012,25,z*1.012,10.5,20,1.3,0,a);sm(G.arch,emit,x*1.055,25,z*1.055,7.7,15.2,1.6,0,a,0,false);for(const dy of [22,29])sm(G.box,trim,x*1.075,dy,z*1.075,7.4,.9,1,0,a,0,false);A.glow(intact,tc,x*1.12,25,z*1.12,19,.22)}
      // The golden crown is part of the GLB architecture; only magic is animated.
      ring=A.mesh(intact,G.torus,A.material(tc,'glow'),0,56.8,0,17,17,17,-Math.PI/2,0,0,false);
      orb=A.crystal(intact,team,0,83,0,25,40,true);
      // In High, a real short-range non-shadow point light colors the upper masonry.
      if(high&&T.PointLight){coreLight=new T.PointLight(A.lin(tc),.58,76,2);coreLight.position.set(0,70,0);intact.add(coreLight)}
      A.lightPool(intact,tc,0,0,63,59,.19,55.4);
      A.glow(intact,tc,0,58,0,36,.28);
      // Both teams' banners face the fixed camera, like the art reference.
      banners.push(A.banner(intact,team,0,27,34.1,29,40));sm(G.cyl,A.gold,0,46,35,1.8,30,1.8,0,0,Math.PI/2);
      for(const x of [-20,20])sm(G.bevel,A.gold,x,9,26,4,6,5);
    }else{
      peak=84;intact.scale.set(1.09,1.07,1.09);ruins.scale.setScalar(1.06);
      ArenaHDModels.add(intact,'guardian-hd');
      for(const x of [-20,20]){sm(G.bevel,dark,x,19,24.1,8,17,2.2);sm(G.bevel,emit,x,19,25.5,4.5,12,1.2,0,0,0,false);A.glow(intact,tc,x,19,26,15,.22)}
      banners.push(A.banner(intact,team,0,24,27.2,22,31));sm(G.cyl,A.gold,0,39.5,27.4,1.35,23,1.35,0,0,Math.PI/2);
      // Guardian is a purely visual tower part, not a game unit.
      guardian=new T.Group();guardian.position.set(0,41,1);intact.add(guardian);const g=A.batch(guardian);
      g.add(G.sphere,cloth,0,7,0,9.3,9.2,7);g.add(G.sphere,trim,0,2,0,10,3.5,8);g.add(G.hood,cloth,0,17,-1,10.4,11,8.8,0,0,-.10);g.add(G.sphere,trim,0,15.5,4.8,7.9,8.4,3.4);g.add(G.sphere,A.gold,0,15.6,6.1,7.0,7.3,2.25);g.add(G.sphere,A.material('#14101f','skin'),0,15.8,7.1,6.2,6.5,2.1);g.add(G.sphere,trim,0,4.5,2,9.8,3.8,7.5);g.add(G.shield,A.gold,0,6,7.9,3.3,4.2,1.6);for(const s of [-1,1]){g.add(G.sphere,A.material('#f4faff','glow'),s*2.4,17,9.02,1.4,1.7,.65,0,0,0,null,false);g.add(G.sphere,cloth,s*8.2,7,2.8,3.5,5,3.8,0,0,s*.35);g.add(G.bevel,A.gold,s*8.3,10,3,4.2,1.8,4.3,0,0,s*.23)}g.add(G.oct,A.gold,0,5,7.1,2.2,2.5,1.1);g.flush();
      staff=new T.Group();staff.position.set(10,8,4);guardian.add(staff);A.mesh(staff,G.cyl,A.material('#714b30','wood'),0,9,0,1.25,26,1.25);A.mesh(staff,G.cyl,A.gold,0,22,0,2.5,2.8,2.5);orb=A.crystal(staff,team,0,27,0,9,12,true);
    }
    batch.flush();
    A.contact(root,0,0,t.king?105:80,t.king?93:70,.085);
    const light=A.lightPool(intact,tc,0,3,t.king?104:76,t.king?92:70,t.king?.19:.13,.17);
    const rubble=A.batch(ruins);for(let i=0;i<13;i++){let a=i*2.4,rad=(t.king?26:20)*rand();rubble.add(G.bevel,stone,Math.cos(a)*rad,2+rand()*3,Math.sin(a)*rad,7+rand()*7,4+rand()*5,8+rand()*6,rand()*.5,a,rand()*.5,color())}rubble.flush();
    const hp=A.health(root,team,t.king?40:35,peak+5);let dead=false;
    return {t,root,peak,update(time,dt,cam,hasAttack){if(t.hp<=0){if(!dead){dead=true;intact.visible=false;ruins.visible=true}A.updateHealth(hp,0,cam,false);return}
      if(hasAttack)attack=.23;attack=Math.max(0,attack-dt);
      light.material.opacity=(t.king?.19:.13)*(1+.15*Math.sin(time*2+t.x));if(coreLight)coreLight.intensity=.58+.09*Math.sin(time*2+t.x);
      orb.root.position.y=orb.baseY+Math.sin(time*2.2+t.x*.02)*(t.king?1.8:.55);orb.root.rotation.y=time*(t.king?.28:.7);if(ring)ring.scale.setScalar(17+Math.sin(time*2)*.7);if(guardian){guardian.rotation.y=Math.sin(time*.9+t.x)*.08;staff.rotation.x=-Math.sin(attack/.23*Math.PI)*.8;staff.rotation.z=-.13-Math.sin(attack/.23*Math.PI)*.25}
      for(const m of banners)A.waveBanner(m,time+t.x*.01);
      A.updateHealth(hp,t.hp/t.max,cam,t.hp<t.max);
    },isDead:()=>dead};
  }
  return {build};
})():null;
