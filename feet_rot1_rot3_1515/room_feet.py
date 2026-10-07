import json
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:49883/preview/index.html'; SH='/workspace/sofa-rot1-v2/feet/shots'
J=json.load(open('/workspace/sofa-rot1-v2/feet/feet_calc.json'))
FEET={n:{'bbox':d['bbox'],'front':d['front'],'rear':d['rear_y']} for n,d in J.items()}
MEAS="""((uid,F)=>{const e=document.querySelector('#roomFloor .furn[data-uid="'+uid+'"]'), i=e.querySelector('img'); const fl=document.querySelector('#roomFloor').getBoundingClientRect(), cw=fl.width/6, ch=fl.height/4;
 const n=e.dataset.fid.replace(/^furn_/,''), f=F[n], eb=e.getBoundingClientRect(), b=i.getBoundingClientRect(), mir=i.classList.contains('mir');
 const [bx0,by0,bx1,by1]=f.bbox, sx=b.width/(bx1-bx0), sy=b.height/(by1-by0);
 const Y=y=>b.top+(y-by0)*sy, X=x=>mir? b.right-(x-bx0)*sx : b.left+(x-bx0)*sx;
 const fy=Y(f.front[0][1]+1), ry=Y(f.rear), fx=f.front.map(p=>X(p[0]));
 const rm=document.getElementById('room').getBoundingClientRect();
 const add=(x,y,c)=>{const d=document.createElement('div'); d.className='qa-dot'; d.style.cssText=`position:fixed;left:${x-5}px;top:${y-5}px;width:10px;height:10px;border-radius:50%;border:3px solid ${c};background:#fff;z-index:99999;pointer-events:none`; document.body.appendChild(d)};
 const line=(x0,x1,y,c,dash)=>{const d=document.createElement('div'); d.className='qa-dot'; d.style.cssText=`position:fixed;left:${x0}px;top:${y-1}px;width:${x1-x0}px;height:0;border-top:2px ${dash?'dashed':'solid'} ${c};z-index:99998;pointer-events:none`; document.body.appendChild(d)};
 line(eb.left,eb.right,eb.top,'#06f',true); line(eb.left,eb.right,eb.bottom,'#06f',true);
 fx.forEach(x=>{add(x,fy,'#0a0'); add(x,ry,'#e00')});
 return {fid:n, rot:mir?3:1, src:i.getAttribute('src').split('?')[0], nw:i.naturalWidth, nh:i.naturalHeight, cw:+cw.toFixed(1),
   frontDevPx:+(fy-eb.bottom).toFixed(1), rearDevPx:+(ry-eb.top).toFixed(1), frontDevCell:+((fy-eb.bottom)/ch).toFixed(2), rearDevCell:+((ry-eb.top)/ch).toFixed(2),
   feetX:fx.map(x=>+((x-eb.left)/cw).toFixed(2)), imgTopOverCell:+((eb.top-b.top)/ch).toFixed(2), inRoom:b.top>=rm.top}})"""
res=[]; errs=[]
with sync_playwright() as p:
    b=p.webkit.launch()
    for dn,tag in [('iPhone SE','SE'),('iPhone 15','iP15')]:
        ctx=b.new_context(**p.devices[dn]); pg=ctx.new_page()
        pg.on('console', lambda m, t=tag: m.type=='error' and errs.append(f'{t} console: {m.text}'))
        pg.on('pageerror', lambda e, t=tag: errs.append(f'{t} pageerror: {e}'))
        pg.on('response', lambda r, t=tag: r.status>=400 and errs.append(f'{t} {r.status} {r.url}'))
        pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900)
        for _ in range(6):
            if pg.evaluate("!document.querySelector('#modal').classList.contains('hidden')") and pg.locator('#mOk').count(): pg.locator('#mOk').first.click(); pg.wait_for_timeout(250)
        pg.locator('#bottomNav [data-tab="home"]').click(); pg.wait_for_timeout(600)
        for _ in range(4):
            if pg.evaluate("!document.querySelector('#modal').classList.contains('hidden')") and pg.locator('#mOk').count(): pg.locator('#mOk').first.click(); pg.wait_for_timeout(250)
        for rot, ctrl in [(1,['furn_sofa','furn_pearl_scallop_sofa']),(3,['furn_rocket_pipe_sofa','furn_sofa'])]:
            items=[['furn_sofa',0,1,rot],['furn_pearl_scallop_sofa',2,1,rot],['furn_rocket_pipe_sofa',4,1,rot],[ctrl[0],0,0,0],[ctrl[1],3,0,0]]
            u=pg.evaluate("(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e9; s.homes.c77.placed.slice().forEach(q=>E.storeItem(s,'c77',q.uid)); const items="+json.dumps(items)+"; items.forEach(([f])=>E.buyFurniture(s,f)); const r=items.map(([f,x,y,rot])=>{const q=E.placeItem(s,'c77',f,x,y,rot); return q.ok?q.uid:('ERR:'+q.why)}); __tzz.persist(); __tzz.renderTab(); return r;})()")
            pg.wait_for_function("[...document.querySelectorAll('#roomFloor .furn img')].every(i=>i.complete&&i.naturalWidth)", timeout=15000); pg.wait_for_timeout(300)
            pg.evaluate("document.getElementById('room').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
            pg.locator('#room').screenshot(path=f'{SH}/{tag}_rot{rot}_plain.png')
            for k in range(3):
                m=pg.evaluate(MEAS+"('"+u[k]+"',"+json.dumps(FEET)+")"); m['dev']=tag; res.append(m)
            ctrlok=[x for x in u[3:] if not str(x).startswith('ERR')]
            hg=pg.evaluate("(us=>us.map(uid=>{const e=document.querySelector('#roomFloor .furn[data-uid=\"'+uid+'\"]'),i=e.querySelector('img'),fl=document.querySelector('#roomFloor').getBoundingClientRect(),cw=fl.width/6,eb=e.getBoundingClientRect(),b=i.getBoundingClientRect(); return {fid:e.dataset.fid,src:i.getAttribute('src').split('?')[0],w:+(eb.width/cw).toFixed(2),h:+(eb.height/cw).toFixed(2),imgH:+(b.height/cw).toFixed(2),foot:+(b.bottom-eb.bottom).toFixed(1)}}))("+json.dumps(ctrlok)+")")
            res.append({'dev':tag,'rot':rot,'placed':u,'horizontal_ctrl':hg})
            pg.locator('#room').screenshot(path=f'{SH}/{tag}_rot{rot}_feet.png')
            pg.evaluate("document.querySelectorAll('.qa-dot').forEach(d=>d.remove())")
        ctx.close()
    b.close()
print(json.dumps(res,ensure_ascii=False)); print('ERRS',json.dumps(errs,ensure_ascii=False))
