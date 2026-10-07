import json, sys
from playwright.sync_api import sync_playwright
CFG=sys.argv[1]  # A or B
URL='http://127.0.0.1:49884/preview/index.html'; SH='/workspace/sofa-v3/shots'
C=json.load(open('/workspace/sofa-v3/feet_calc_v3.json'))
PAD={'pearl_scallop_sofa':(8,223),'rocket_pipe_sofa':(11,218)} if CFG=='B2' else {}
FEET={n:{'bbox':d['bbox'],'front':d['front'],'rear':d['rear'],'pad':[PAD[n][0]/240,PAD[n][1]/240] if n in PAD else [0,1]} for n,d in C.items()}
MEAS="""((uid,F)=>{const e=document.querySelector('#roomFloor .furn[data-uid="'+uid+'"]'), i=e.querySelector('img'); const fl=document.querySelector('#roomFloor').getBoundingClientRect(), cw=fl.width/6, ch=fl.height/4;
 const n=e.dataset.fid.replace(/^furn_/,''), f=F[n], eb=e.getBoundingClientRect(), bb=i.getBoundingClientRect(), mir=i.classList.contains('mir');
 const s=Math.min(bb.width/i.naturalWidth, bb.height/i.naturalHeight), dw=i.naturalWidth*s, dh=i.naturalHeight*s; const b={left:bb.left+(bb.width-dw)/2, top:bb.top+(bb.height-dh)/2, width:dw, height:dh}; b.right=b.left+dw; b.bottom=b.top+dh; if(f.pad){b.left+=f.pad[0]*dw; b.width=f.pad[1]*dw; b.right=b.left+b.width;}
 const [bx0,by0,bx1,by1]=f.bbox, sx=b.width/(bx1-bx0), sy=b.height/(by1-by0);
 const Y=y=>b.top+(y+1-by0)*sy, X=x=>mir? b.right-(x+0.5-bx0)*sx : b.left+(x+0.5-bx0)*sx;
 const fr=f.front.map(p=>({x:X(p[0]),y:Y(p[1])})), re=f.rear.map(p=>({x:X(p[0]),y:Y(p[1])}));
 const rm=document.getElementById('room').getBoundingClientRect();
 const add=(x,y,c)=>{const d=document.createElement('div'); d.className='qa-dot'; d.style.cssText=`position:fixed;left:${x-5}px;top:${y-5}px;width:10px;height:10px;border-radius:50%;border:3px solid ${c};background:#fff;z-index:99999;pointer-events:none`; document.body.appendChild(d)};
 const line=(x0,x1,y,c)=>{const d=document.createElement('div'); d.className='qa-dot'; d.style.cssText=`position:fixed;left:${x0}px;top:${y-1}px;width:${x1-x0}px;height:0;border-top:2px dashed ${c};z-index:99998;pointer-events:none`; document.body.appendChild(d)};
 line(eb.left,eb.right,eb.top,'#06f'); line(eb.left,eb.right,eb.bottom,'#06f');
 fr.forEach(p=>add(p.x,p.y,'#0a0')); re.forEach(p=>add(p.x,p.y,'#e00'));
 const fy=Math.max(...fr.map(p=>p.y)), ry=re[0].y;
 return {fid:n, rot:mir?3:1, nw:i.naturalWidth, nh:i.naturalHeight, cw:+cw.toFixed(1), drawW_cells:+(dw/cw).toFixed(3), drawH_cells:+(dh/ch).toFixed(3),
   frontDevPx:+(fy-eb.bottom).toFixed(1), frontDevCell:+((fy-eb.bottom)/ch).toFixed(3), rearDevPx:+(ry-eb.top).toFixed(1), rearDevCell:+((ry-eb.top)/ch).toFixed(3),
   frontX:fr.map(p=>+((p.x-eb.left)/cw).toFixed(2)), rearX:re.map(p=>+((p.x-eb.left)/cw).toFixed(2)), imgLeftCell:+((b.left-eb.left)/cw).toFixed(3), imgRightCell:+((eb.right-b.right)/cw).toFixed(3),
   imgTopAboveBack:+((eb.top-b.top)/ch).toFixed(2), inRoom:b.top>=rm.top-0.5}})"""
res=[]; errs=[]
def closem(pg,n=6):
    for _ in range(n):
        if pg.evaluate("!document.querySelector('#modal').classList.contains('hidden')") and pg.locator('#mOk').count(): pg.locator('#mOk').first.click(); pg.wait_for_timeout(250)
def place(pg,items):
    return pg.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e9; s.homes.c77.placed.slice().forEach(q=>E.storeItem(s,'c77',q.uid)); const items="+json.dumps(items)+"; items.forEach(([f])=>E.buyFurniture(s,f)); const r=items.map(([f,x,y,rot])=>{const q=E.placeItem(s,'c77',f,x,y,rot); return q.ok?q.uid:('ERR:'+q.why)}); __tzz.persist(); __tzz.renderTab(); return r;})()")
def waitimg(pg): pg.wait_for_function("[...document.querySelectorAll('#roomFloor .furn img')].every(i=>i.complete&&i.naturalWidth)", timeout=15000)
with sync_playwright() as p:
    b=p.webkit.launch()
    for dn,tag in [('iPhone SE','SE'),('iPhone 15','iP15')]:
        ctx=b.new_context(**p.devices[dn]); pg=ctx.new_page()
        pg.on('console', lambda m, t=tag: m.type=='error' and errs.append(f'{t} console: {m.text}'))
        pg.on('pageerror', lambda e, t=tag: errs.append(f'{t} pageerror: {e}'))
        pg.on('response', lambda r, t=tag: r.status>=400 and errs.append(f'{t} {r.status} {r.url}'))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900); closem(pg)
        pg.locator('#bottomNav [data-tab="home"]').click(); pg.wait_for_timeout(600); closem(pg,4)
        for rot, ctrl in [(1,['furn_sofa','furn_pearl_scallop_sofa']),(3,['furn_rocket_pipe_sofa','furn_sofa'])]:
            u=place(pg,[['furn_sofa',0,1,rot],['furn_pearl_scallop_sofa',2,1,rot],['furn_rocket_pipe_sofa',4,1,rot],[ctrl[0],0,0,0],[ctrl[1],3,0,0]])
            waitimg(pg); pg.wait_for_timeout(300)
            pg.evaluate("document.getElementById('room').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
            pg.locator('#room').screenshot(path=f'{SH}/{CFG}_{tag}_rot{rot}_plain.png')
            for k in range(3):
                m=pg.evaluate(MEAS+"('"+u[k]+"',"+json.dumps(FEET)+")"); m['dev']=tag; m['cfg']=CFG; res.append(m)
            hg=pg.evaluate("(us=>us.map(uid=>{const e=document.querySelector('#roomFloor .furn[data-uid=\"'+uid+'\"]'); if(!e) return uid; const i=e.querySelector('img'),fl=document.querySelector('#roomFloor').getBoundingClientRect(),cw=fl.width/6,eb=e.getBoundingClientRect(),b=i.getBoundingClientRect(); return {fid:e.dataset.fid,src:i.getAttribute('src').split('?')[0],w:+(eb.width/cw).toFixed(2),h:+(eb.height/cw).toFixed(2),foot:+(b.bottom-eb.bottom).toFixed(1)}}))("+json.dumps(u[3:])+")")
            res.append({'dev':tag,'cfg':CFG,'rot':rot,'placed':u,'horizontal_ctrl':hg})
            pg.locator('#room').screenshot(path=f'{SH}/{CFG}_{tag}_rot{rot}_feet.png')
            pg.evaluate("document.querySelectorAll('.qa-dot').forEach(d=>d.remove())")
        # interactions
        u=place(pg,[['furn_sofa',0,3,0],['furn_pearl_scallop_sofa',3,3,0],['furn_rocket_pipe_sofa',5,0,1]]); waitimg(pg)
        it={'dev':tag,'cfg':CFG}
        pg.evaluate("document.getElementById('room').scrollIntoView({block:'center'})")
        pg.locator(f'#roomFloor .furn[data-uid="{u[2]}"]').click(); pg.wait_for_timeout(700)
        it['liveTap']=pg.evaluate("(()=>{const a=__tzz.homeActor.c77; return {act:a.act,line:a.line||null}})()")
        pg.locator('.mode-tabs [data-arg="decor"]').click(); pg.wait_for_timeout(300)
        for j,uid in enumerate(u):
            pg.evaluate("document.getElementById('room').scrollIntoView({block:'center'})"); pg.wait_for_timeout(80)
            pg.locator(f'#roomFloor .furn[data-uid="{uid}"]').click(); pg.wait_for_timeout(250)
            rb=pg.locator(f'[data-act="homeRot"][data-arg="{uid}"]')
            if rb.count()==0: it[f'rot{j}']='no rotate button'; continue
            rb.click(); pg.wait_for_timeout(450)
            try: waitimg(pg)
            except Exception: pass
            it[f'rot{j}']=pg.evaluate(f"(()=>{{const s=__tzz.state,E=__tzz.E,p=s.homes.c77.placed.find(q=>q.uid==='{uid}'); const e=document.querySelector('#roomFloor .furn[data-uid=\"{uid}\"]'),i=e&&e.querySelector('img'); return p?{{fid:p.fid,rot:p.rot,x:p.x,y:p.y,ok:E.canPlace(s,'c77',p.fid,p.x,p.y,p.rot,p.uid).ok,src:i&&i.getAttribute('src').split('?')[0],cls:i&&i.className}}:null}})()")
        uid=u[0]; f=pg.locator('#roomFloor').bounding_box(); cw=f['width']/6; ch=f['height']/4
        a=pg.locator(f'#roomFloor .furn[data-uid="{uid}"]').bounding_box()
        pg.mouse.move(a['x']+a['width']/2, a['y']+a['height']*0.8); pg.mouse.down(); pg.mouse.move(f['x']+2.5*cw, f['y']+2.5*ch, steps=10); pg.wait_for_timeout(80); pg.mouse.up(); pg.wait_for_timeout(400)
        it['drag']=pg.evaluate(f"(()=>{{const s=__tzz.state,E=__tzz.E,p=s.homes.c77.placed.find(q=>q.uid==='{uid}'); return p?{{rot:p.rot,x:p.x,y:p.y,ok:E.canPlace(s,'c77',p.fid,p.x,p.y,p.rot,p.uid).ok}}:null}})()")
        m=pg.evaluate(MEAS+"('"+uid+"',"+json.dumps(FEET)+")"); it['dragFeet']={k:m[k] for k in ('frontDevPx','rearDevPx','inRoom')}
        pg.evaluate("document.querySelectorAll('.qa-dot').forEach(d=>d.remove())")
        pg.locator('#room').screenshot(path=f'{SH}/{CFG}_{tag}_after_rot_drag.png')
        res.append(it); ctx.close()
    b.close()
json.dump({'results':res,'errors':errs},open(f'/workspace/sofa-v3/room_{CFG}.json','w'),ensure_ascii=False,indent=1)
print('done',len(res),'errs',errs)
