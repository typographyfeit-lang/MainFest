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
      peak=54;ruins.scale.setScalar(.66);
      sm(G.cyl,dark,0,2,0,16,4,16);sm(G.cyl,A.gold,0,4.7,0,13.5,2,13.5);
      sm(G.cyl,A.material('#9d8690'),0,15,0,10.5,19,10.5);
      for(const q of [-1,1]){sm(G.bevel,A.material('#b09a9d'),q*9,13,0,5,18,8);sm(G.bevel,A.gold,q*9,22,0,6,2.5,9);}
      sm(G.cyl,A.gold,0,25,0,12,3,12);sm(G.cyl,trim,0,27.2,0,8.5,2,8.5);sm(G.arch,emit,0,13,10.7,5.2,12,1.2,0,0,0,false);
      orb=A.crystal(intact,team,0,40,0,16,25,true);ring=A.mesh(intact,G.torus,A.material(tc,'glow'),0,28,0,10,10,10,-Math.PI/2,0,0,false);

    }
    batch.flush();
    A.contact(root,0,0,t.king?105:43,t.king?93:40,.085);
    const light=A.lightPool(intact,tc,0,3,t.king?104:52,t.king?92:48,t.king?.19:.13,.17);
    const rubble=A.batch(ruins);for(let i=0;i<13;i++){let a=i*2.4,rad=(t.king?26:20)*rand();rubble.add(G.bevel,stone,Math.cos(a)*rad,2+rand()*3,Math.sin(a)*rad,7+rand()*7,4+rand()*5,8+rand()*6,rand()*.5,a,rand()*.5,color())}rubble.flush();
    const hp=A.health(root,team,t.king?40:28,peak+5);let dead=false;
    return {t,root,peak,update(time,dt,cam,hasAttack){if(t.hp<=0){if(!dead){dead=true;intact.visible=false;ruins.visible=true}A.updateHealth(hp,0,cam,false);return}
      if(hasAttack)attack=.23;attack=Math.max(0,attack-dt);
      light.material.opacity=(t.king?.19:.13)*(1+.15*Math.sin(time*2+t.x));if(coreLight)coreLight.intensity=.58+.09*Math.sin(time*2+t.x);
      orb.root.position.y=orb.baseY+Math.sin(time*2.2+t.x*.02)*(t.king?1.8:.55);orb.root.rotation.y=time*(t.king?.28:.7);if(ring)ring.scale.setScalar((t.king?17:10)+Math.sin(time*2)*.7);if(guardian){guardian.rotation.y=Math.sin(time*.9+t.x)*.08;staff.rotation.x=-Math.sin(attack/.23*Math.PI)*.8;staff.rotation.z=-.13-Math.sin(attack/.23*Math.PI)*.25}
      for(const m of banners)A.waveBanner(m,time+t.x*.01);
      A.updateHealth(hp,t.hp/t.max,cam,t.hp<t.max);
    },isDead:()=>dead};
  }
  return {build};
})():null;
