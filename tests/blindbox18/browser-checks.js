() => {
 const {display,baseDisplay,render,ITEMS,EIGHT_WEARABLES,actual,old,E,state,who,canvas}=review;
 let checks=0;const assert=(ok,message)=>{checks++;if(!ok)throw Error(message)};
 const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 const bounds=c=>{const d=pixels(c);let l=c.width,t=c.height,r=-1,b=-1;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return [l,t,r,b];};
 const result={checks:0,bounds:{},firstEightPixelComparisons:0,facePixelComparisons:0,poseCases:0};
 for(const it of ITEMS){const c=canvas(240,240),ctx=c.getContext('2d');ctx.translate(120,180);const transform=ctx.getTransform().toString(),fill=ctx.fillStyle;it.type==='hat'?render.drawCollectibleHat(ctx,it.id):render.drawCollectibleClothes(ctx,it.id);assert(ctx.getTransform().toString()===transform&&ctx.fillStyle===fill,it.id+' context restored');const b=bounds(c).map((n,i)=>n-(i%2?180:120));result.bounds[it.id]=b;const limit=it.type==='hat'?[-23,-150,23,-109]:[-28,-80,28,-28];assert(b[0]>=limit[0]&&b[1]>=limit[1]&&b[2]<=limit[2]&&b[3]<=limit[3],it.id+' bounds '+b);
  const cat=canvas(512,512);render.drawCatalog(cat.getContext('2d'),it.id);const cb=bounds(cat);assert(cb[0]>0&&cb[1]>0&&cb[2]<511&&cb[3]<511,it.id+' catalog margin');
  for(const id of who){const eq={[it.type]:it.id},s=state(eq),look=display.look(actual.LOOKS[id],E,s,id),a=canvas(240,240),b=canvas(240,240);// Translate both heads identically below.
   a.getContext('2d').translate(120,180);b.getContext('2d').translate(120,180);actual.drawHead(a.getContext('2d'),look);actual.drawHead(b.getContext('2d'),{...look,hat:look.hat?'__no_geometry__':null});const da=a.getContext('2d').getImageData(85,70,70,57).data,db=b.getContext('2d').getImageData(85,70,70,57).data;assert(same(da,db),it.id+' '+id+' face/lower hair');result.facePixelComparisons++;
   for(const pose of ['sit','lie']){const p=canvas(352,352);HomeInteraction.drawPose(p.getContext('2d'),actual.drawPerson,look,pose,undefined,{candidateVisual:true});const pb=bounds(p);assert(pb[0]>0&&pb[1]>0&&pb[2]<351&&pb[3]<351,it.id+' '+id+' '+pose+' sprite clipped');result.poseCases++;}
  }
 }
 for(const it of EIGHT_WEARABLES)for(const id of who)for(const pose of ['work','wave']){const s=state({[it.type]:it.id}),a=canvas(280,320),b=canvas(280,320),fit=display.fitPerson(280,320,16);actual.drawPerson(a.getContext('2d'),fit.x,fit.y,fit.scale,display.look(actual.LOOKS[id],E,s,id),{pose,t:.5});old.drawPerson(b.getContext('2d'),fit.x,fit.y,fit.scale,baseDisplay.look(old.LOOKS[id],E,s,id),{pose,t:.5});assert(same(pixels(a),pixels(b)),'first eight changed '+it.id+' '+id);result.firstEightPixelComparisons++;}
 // Every clothes x hat combination on every CEO, standing and both existing home poses.
 for(const clothes of render.IDS.clothes)for(const hat of render.IDS.hat)for(const id of who){const look=display.look(actual.LOOKS[id],E,state({clothes,hat}),id);for(const pose of ['sit','lie']){const c=canvas(352,352);HomeInteraction.drawPose(c.getContext('2d'),actual.drawPerson,look,pose,undefined,{candidateVisual:true});const b=bounds(c);assert(b[0]>0&&b[1]>0&&b[2]<351&&b[3]<351,'combination clipped');result.poseCases++;}}
 const ctx=canvas(160,180).getContext('2d'),look=display.look(actual.LOOKS.c77,E,state({clothes:ITEMS[0].id,hat:ITEMS[4].id}),'c77');const start=performance.now();for(let i=0;i<1000;i++){ctx.clearRect(0,0,160,180);actual.drawPerson(ctx,80,170,1,look,{pose:'work',t:i/60});}result.draw1000Milliseconds=performance.now()-start;
 assert(localStorage.length===0&&sessionStorage.length===0,'synthetic preview touched storage');result.checks=checks;return result;
}
