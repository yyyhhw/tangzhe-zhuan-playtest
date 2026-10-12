import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda f: open(os.path.join(d,'src',f),encoding='utf-8').read()
js=r('main.js').replace('/*@PORTRAITS@*/\n', r('portraits.js')).replace('/*@SPACE@*/', r('space.js'))
out=r('head.html')+'<style>'+r('style.css')+'</style>'+r('markup.html')+'<script>'+js+'</script>\n'
open(os.path.join(d,'xingtu-demo.html'),'w',encoding='utf-8').write(out)
print(len(out))
