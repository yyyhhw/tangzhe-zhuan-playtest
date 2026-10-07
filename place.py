import json,sys
from playwright.sync_api import sync_playwright
SH='/workspace/sofa-redraw/shots'
def S(pg,e): return pg.evaluate(e)
def close_modals(pg,n=6):
    for _ in range(n):
        if not pg.evaluate("!document.querySelector('#modal').classList.contains('hidden')"): return
        for sel in ['#mOk','#pvNo','#mNo','#claim']:
            if pg.locator(sel).count(): pg.locator(sel).first.click(); pg.wait_for_timeout(250); break
        else: return
GEO="""(uid=>{const e=document.querySelector('#roomFloor .furn[data-uid="'+uid+'"]'); if(!e) return null; const i=e.querySelector('img'), rm=document.querySelector('#room'), rr=rm.getBoundingClientRect(), bt=parseFloat(getComputedStyle(rm).borderTopWidth)||0;
 const eb=e.getBoundingClientRect(), b=i.getBoundingClientRect(), sc=Math.min(b.width/i.naturalWidth,b.height/i.naturalHeight), dw=i.naturalWidth*sc, dh=i.naturalHeight*sc;
 return {src:i.getAttribute('src'),cls:i.className,nw:i.naturalWidth,nh:i.naturalHeight,ew:eb.width,eh:eb.height,dw,dh,dl:b.left+(b.width-dw)/2,el:eb.left,foot:eb.bottom-b.bottom,drawTop:b.bottom-dh,fpTop:eb.top,roomTop:rr.top+bt,tf:getComputedStyle(i).transform}})"""
LAY=[['furn_sofa',0,0,1],['furn_pearl_scallop_sofa',2,1,1],['furn_rocket_pipe_sofa',4,1,3],['furn_sofa',1,4,0]]
out={}
with sync_playwright() as p:
    b=p.webkit.launch()
    for tag,url in [('base13i','http://127.0.0.1:49882/index.html'),('cand','http://127.0.0.1:49881/index.html')]:
        for dn in ['iPhone 15','iPhone SE']:
            c=b.new_context(**p.devices[dn]); pg=c.new_page(); errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('response',lambda r: r.status>=400 and errs.append(f'{r.status} {r.url}'))
            pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900); close_modals(pg)
            pg.locator('#bottomNav [data-tab="home"]').click(); pg.wait_for_timeout(600); close_modals(pg)
            S(pg,"__tzz.homeMode='decor'")
            u=S(pg,"(()=>{const s=__tzz.state,E=__tzz.E; s.coins=1e9; s.homes.c77.placed.slice().forEach(q=>E.storeItem(s,'c77',q.uid)); const items="+json.dumps(LAY)+"; items.forEach(([f])=>E.buyFurniture(s,f)); const r=items.map(([f,x,y,rot])=>{const q=E.placeItem(s,'c77',f,x,y,rot); return q.ok?q.uid:q.why}); __tzz.persist(); __tzz.renderTab(); return r;})()")
            pg.wait_for_function("[...document.querySelectorAll('#roomFloor .furn img')].every(i=>i.complete&&i.naturalWidth)",timeout=15000); pg.wait_for_timeout(300)
            k=f'{tag}|{dn}'; out[k]={'uids':u,'errs':errs,'geo':{}}
            for (f,x,y,r),uid in zip(LAY,u):
                g=S(pg,GEO+"('"+uid+"')") if isinstance(uid,str) and uid.startswith(('u','f')) or (isinstance(uid,str) and len(uid)>3) else None
                if g:
                    cell=g['ew'] if r&1 else g['eh']
                    g['cell']=cell; g['up_cells']=round(g['dh']/cell,3); g['over_top_cells']=round((g['fpTop']-g['drawTop'])/cell,3); g['foot_px']=round(g['foot'],2); g['width_fill']=round(g['dw']/g['ew'],3); g['inRoom']=g['drawTop']>=g['roomTop']-1
                out[k]['geo'][f'{f}@{x},{y},r{r}']=g
            fn=f"{SH}/{tag}_{dn.replace(' ','')}"
            pg.locator('#room').screenshot(path=fn+'.png')
            pg.add_style_tag(content="#roomFloor .furn{outline:2px dashed #0070f3!important;outline-offset:-1px}")
            pg.wait_for_timeout(150); pg.locator('#room').screenshot(path=fn+'_grid.png')
            c.close()
    b.close()
json.dump(out,open('/workspace/sofa-redraw/geo.json','w'),ensure_ascii=False,indent=1)
for k,v in out.items():
    print('==',k,'uids',v['uids'],'errs',v['errs'][:3])
    for n,g in v['geo'].items():
        if g: print('  ',n,'nat %dx%d'%(g['nw'],g['nh']),'cell %.1f'%g['cell'],'up',g['up_cells'],'overTop',g['over_top_cells'],'foot',g['foot_px'],'wfill',g['width_fill'],'inRoom',g['inRoom'],g['cls'],g['src'][:40])
        else: print('  ',n,None)
