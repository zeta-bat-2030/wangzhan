#!/usr/bin/env python3
"""把 src.html + css/style.css + js/app.js 内联压缩为 index.html（首屏单请求）"""
import re
css=open('css/style.css').read();css=re.sub(r'/\*.*?\*/','',css,flags=re.S);css=re.sub(r'\s*\n\s*','',css);css=re.sub(r'\s*([{};:,>])\s*',r'\1',css)
js=open('js/app.js').read();js='\n'.join(l.strip() for l in js.split('\n') if l.strip() and not l.strip().startswith('/*'))
h=open('src.html').read().replace('/*CSS*/',css).replace('/*JS*/',js)
h=re.sub(r'>\s*\n\s*<','><',h)
open('index.html','w').write(h);print('index.html',len(h.encode()),'bytes')
