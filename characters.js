'use strict';
const ArenaCharacters3D=ArenaArt3D?(()=>{
  const A=ArenaArt3D,{T,G,C}=A;
  const steel=A.material('#b0b8c8','gold'),darkSteel=A.material('#697587','gold'),leather=A.material('#79543d','wood'),dark=A.material('#252236','skin'),white=A.material('#f7eee8','skin');
  const profiles={guard:['#8898ad',1],archer:['#67865a',.88],colossus:['#858293',1.45],imp:['#c76a39',.78],mage:['#8b5bb1',.96],hounds:['#a299a5',.9],swarm:['#887b72',.69],brute:['#a06b55',1.35]};
  function pivot(parent,x,y,z){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g}
  function build(u){
    const root=new T.Group(),body=new T.Group();root.add(body);const [base,s]=profiles[u.id]||profiles.guard;const team=u.team,col=A.material(C.cloth[team],'cloth'),gold=A.gold,mat=A.material(base,'skin'),skin=A.material(u.hd||'#d2a679','skin'),glow=A.material(C.team[team],'glow');
    const big=!!u.big,animal=u.id==='hounds',rock=u.id==='swarm';const parts=[];
    const key=u.id+":"+team;let partIndex=0;const batch=A.modelBatch(body,key+":body");const p=(b,g,m,x,y,z,w,h,d,rx=0,ry=0,rz=0,shadow=true)=>b.add(g,m,x,y,z,w,h,d,rx,ry,rz,null,shadow);
    const part=(x,y,z,make)=>{const g=pivot(body,x,y,z),b=A.modelBatch(g,key+":part:"+(partIndex++));make(b);b.flush();parts.push(g);return g};
    let legs=[],arms=[],head;
    if(animal){
      p(batch,G.sphere,mat,0,10,-2,7.5,6.2,11);p(batch,G.sphere,col,0,11,5,7.2,5,4);
      head=part(0,15,8,b=>{p(b,G.sphere,mat,0,0,0,7,6.2,6);p(b,G.sphere,skin,0,-2,5.4,5.2,3.2,4.5);p(b,G.sphere,dark,0,0,9,2.3,1.6,1.5);for(const s of [-1,1]){p(b,G.cone,mat,s*4,7,-1,3.2,7,3.2,0,0,-s*.27);p(b,G.sphere,glow,s*3,2,5.2,1.3,1.25,.8,0,0,0,false)}});
      for(const x of [-4.7,4.7])for(const z of [-8,4])legs.push(part(x,7,z,b=>{p(b,G.sphere,mat,0,-3,0,2.5,4,2.7);p(b,G.sphere,dark,0,-6,1,2.7,1.8,3.1)}));p(batch,G.cone,mat,0,12,-15,2.4,9,2.4,-1.2,0,0);
    }else if(rock){
      p(batch,G.oct,mat,0,8,0,8.6,10,7.5);p(batch,G.oct,col,0,14,0,5,5,5);for(const x of [-4,4])p(batch,G.sphere,glow,x,10,5,1.6,1.4,.85,0,0,0,false);for(const x of [-4.8,4.8])legs.push(part(x,4,0,b=>p(b,G.sphere,mat,0,-2,0,3,2.8,3)));
    }else{
      p(batch,G.sphere,mat,0,14,0,7.9,9,5.6);p(batch,G.cyl,col,0,9,0,7.2,3.1,5.6);p(batch,G.shield,gold,0,15,5.7,4.8,6.1,1.5);p(batch,G.gem,glow,0,15,6.8,1.55,1.9,.85,0,0,0,false);p(batch,G.sphere,col,0,16,-4.9,6.9,9.5,1.4);
      for(const x of [-4.4,4.4])legs.push(part(x,8,0,b=>{p(b,G.sphere,mat,0,-3,0,3.2,4.2,3.1);p(b,G.sphere,leather,0,-6,1.4,3.8,2.2,4.5)}));
      head=part(0,26,0,b=>{
        p(b,G.sphere,u.id==='mage'?col:skin,0,0,0,9,9.6,8);if(u.id==='mage'){p(b,G.hood,col,0,1,-1,10,10,8.2,0,0,-.12);p(b,G.sphere,dark,0,-1,6.4,6.1,7,2.6)}
        for(const x of [-3.5,3.5]){p(b,G.sphere,u.id==='mage'?glow:white,x,1.2,7.3,2.2,2.2,1.3,0,0,0,false);if(u.id!=='mage')p(b,G.sphere,dark,x,1.1,8.45,1.1,1.4,.6,0,0,0,false)}
        if(u.id==='guard'||u.id==='brute'){p(b,G.sphere,steel,0,5,-1,9.6,6.3,8.5);p(b,G.bevel,darkSteel,0,6,7.2,3.7,8,2)}if(u.id==='archer'){p(b,G.cone,mat,0,7,-1,10.2,9,8);p(b,G.box,gold,0,5.5,8,4,.9,1)}if(u.id==='imp'||u.id==='brute')for(const q of [-1,1])p(b,G.cone,gold,q*6,8,-1,2.2,7,2.2,0,0,-q*.35);if(u.id==='colossus'){p(b,G.bevel,mat,0,5,0,14,9,12);p(b,G.oct,glow,0,1,8,2,2,1,0,0,0,false)}
      });
      for(const q of [-1,1])arms.push(part(q*8,20,0,b=>{p(b,G.sphere,col,0,-2,0,4.1,4.6,4.2);if(u.id==='guard'||u.id==='brute'||u.id==='colossus'){p(b,G.bevel,darkSteel,0,0,0,8,4.1,7.7,0,0,q*.16);p(b,G.bevel,gold,0,1,2.8,7.2,1.5,1.6,0,0,q*.16)}p(b,G.sphere,mat,0,-6,0,3.1,5.1,3.1);p(b,G.sphere,skin,0,-10,1,3.1,3.4,3.1);if(q<0&&u.id==='guard'){p(b,G.shield,gold,-3,-6,3,12,14,2.2,0,0,.10);p(b,G.shield,darkSteel,-3,-6,4.1,9.6,11.6,1.6,0,0,.10);p(b,G.gem,gold,-3,-6,5.5,2.6,3.5,1.2)}if(q>0){if(u.id==='mage'){p(b,G.cyl,leather,0,-2,4,1,24,1);p(b,G.oct,glow,0,11,4,3.5,5,3.5,0,0,0,false)}else if(u.id==='guard'||u.id==='brute'){p(b,G.cyl,leather,0,-7,4,1.5,12,1.5);p(b,u.id==='guard'?G.bevel:G.gem,steel,0,2,4,u.id==='guard'?3.6:6,u.id==='guard'?16:6,3);p(b,G.bevel,gold,0,-5,4,7.2,1.4,2.3)}else if(u.id==='imp'){p(b,G.sphere,dark,0,-6,5,5,5,5);p(b,G.cyl,gold,0,0,5,1,4,1)}else if(u.id==='archer'){p(b,G.torus,leather,0,-3,4,7,9,2,0,0,0);p(b,G.cyl,white,0,-3,4,.35,18,.35,0,0,0,false)}}}));
    }
    batch.flush();
    body.scale.setScalar(s);const floor=A.contact(root,0,0,(big?27:19)*s,(big?20:14)*s,.12);const ring=A.mesh(root,G.torus,new T.MeshBasicMaterial({color:A.lin(C.team[team]),toneMapped:false,transparent:true,opacity:.60,depthWrite:false}),0,.24,0,10*s,10*s,4,-Math.PI/2,0,0,false);ring.userData.ownedMaterial=true;floor.userData.ownedMaterial=true;
    const hp=A.health(root,team,19,((animal?26:rock?20:39)*s+5));let lastX=u.x,lastZ=u.y,ry=team?0:Math.PI,age=0,lastHp=u.hp,hit=0;
    return {u,root,update(t,dt,cam){age+=dt;const dx=u.x-lastX,dz=u.y-lastZ,moving=Math.hypot(dx,dz)>.03;lastX=u.x;lastZ=u.y;if(moving){let a=Math.atan2(dx,dz)-ry;a=Math.atan2(Math.sin(a),Math.cos(a));ry+=a*Math.min(1,dt*13)}if(u.hp<lastHp)hit=.15;lastHp=u.hp;hit=Math.max(0,hit-dt);const phase=t*(7+u.s*.07)+u.x*.06;const swing=moving?Math.sin(phase)*.6:0;legs.forEach((g,i)=>g.rotation.x=swing*(i%2?-1:1));const atk=u.as-u.cd,attack=atk>=0&&atk<.27?Math.sin(atk/.27*Math.PI):0;arms.forEach((g,i)=>g.rotation.x=(i?1:-1)*swing-(i?attack*1.7:0));if(head){head.rotation.z=Math.sin(t*2)*.035+hit*.48;head.rotation.x=-attack*.08}body.rotation.y=ry;body.rotation.x=hit*.35-attack*.11;const appear=Math.min(1,age/.28);body.scale.setScalar(s*(.25+.75*appear+Math.sin(appear*Math.PI)*.12));const crossing=Math.abs(u.y-280)<22&&Math.min(Math.abs(u.x-90),Math.abs(u.x-270))<=34;root.position.set(u.x,(crossing?4:0)+(moving?Math.abs(swing)*1.4:Math.sin(t*2+u.x)*.25),u.y);A.updateHealth(hp,u.hp/u.max,cam,u.hp<u.max);}};
  }
  return {build};
})():null;
