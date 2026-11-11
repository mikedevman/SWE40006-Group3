/* MarkFlow shared frontend helpers: live preview, local drafts/settings, and backend API client. */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const LS={get(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const DEF={theme:'system',fs:14,wrap:true,spell:false,size:'A4',orient:'portrait',margin:'normal',tpl:'minimal',font:''};
const S=()=>({...DEF,...LS.get('mf-set',{})}),setS=p=>LS.set('mf-set',{...S(),...p});
const SIZES={A4:[794,1123],Letter:[816,1056],Legal:[816,1344]};
const TPL={
 minimal:{n:'Minimal',d:'Clean sans-serif with generous white space.',bf:'Inter',hf:'Inter',ac:'#0B0F1A',hb:'0',sz:'11pt'},
 academic:{n:'Academic Report',d:'Serif text with a thin rule under the title.',bf:'Newsreader',hf:'Newsreader',ac:'#1B2233',hb:'1px solid #1B2233',sz:'12pt'},
 business:{n:'Business Report',d:'Bold headings and a cornflower title rule.',bf:'Inter',hf:'Inter',ac:'#3F73E6',hb:'4px solid #548CFF',sz:'10.5pt'},
 resume:{n:'Resume / CV',d:'Compact layout that fits a career on one page.',bf:'Inter',hf:'Inter',ac:'#0B0F1A',hb:'0',sz:'9.5pt',m:52},
 tech:{n:'Technical Documentation',d:'Monospace headings, built around code and notes.',bf:'Inter',hf:'ui-monospace,Consolas,monospace',ac:'#0B0F1A',hb:'1px solid #D5DBE5',sz:'10.5pt'}
};
const SAMPLE=`# Project report

Write in plain Markdown and the template handles the layout.

## Summary

This is **sample text**. Replace it with your own, or drop in a file.

- Live preview updates as you type
- Pick any of five templates
- Export when the page looks right

### Run command

\`\`\`
docker compose up --build
\`\`\`

> A quote keeps its place across pages.

1. Write
2. Choose a template
3. Export

Read more at [the MarkFlow demo](https://example.com).
`;
const inl=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2">$1</a>');
const tblCells=l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
const isTbl=(a,b)=>Boolean(a&&b&&a.includes('|')&&b.includes('|')&&tblCells(b).every(c=>/^:?-{3,}:?$/.test(c)));
const LI=/^\s*([-*]|\d+\.)\s+/;
function md(t){const L=String(t).replace(/\r/g,'').split('\n');let h='',i=0,m;
 while(i<L.length){const l=L[i];
  if(/^```/.test(l)){const c=[];i++;while(i<L.length&&!/^```/.test(L[i]))c.push(L[i++]);i++;h+='<pre><code>'+esc(c.join('\n'))+'</code></pre>';continue}
  if(m=l.match(/^(#{1,6})\s+(.*)/)){h+=`<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`;i++;continue}
  if(/^\s*(-{3,}|\*{3,})\s*$/.test(l)){h+='<hr>';i++;continue}
  if(/^>\s?/.test(l)){const q=[];while(i<L.length&&/^>\s?/.test(L[i]))q.push(L[i++].replace(/^>\s?/,''));h+='<blockquote>'+inl(q.join(' '))+'</blockquote>';continue}
  if(LI.test(l)){const o=/^\s*\d+\./.test(l),it=[];while(i<L.length&&LI.test(L[i]))it.push(L[i++].replace(LI,''));h+=(o?'<ol>':'<ul>')+it.map(x=>'<li>'+inl(x)+'</li>').join('')+(o?'</ol>':'</ul>');continue}
  if(isTbl(l,L[i+1])){const hd=tblCells(l);i+=2;const rows=[];while(i<L.length&&L[i].trim()&&L[i].includes('|')&&!/^(#{1,6}\s|```|>)/.test(L[i])){const r=tblCells(L[i++]);rows.push('<tr>'+hd.map((_,j)=>'<td>'+inl(r[j]||'')+'</td>').join('')+'</tr>')}h+='<table><thead><tr>'+hd.map(c=>'<th>'+inl(c)+'</th>').join('')+'</tr></thead>'+(rows.length?'<tbody>'+rows.join('')+'</tbody>':'')+'</table>';continue}
  if(!l.trim()){i++;continue}
  const p=[];while(i<L.length&&L[i].trim()&&!/^(#{1,6}\s|```|>|\s*(-{3,}|\*{3,})\s*$|\s*([-*]|\d+\.)\s)/.test(L[i])&&!isTbl(L[i],L[i+1]))p.push(L[i++]);
  if(!p.length)p.push(L[i++]);h+='<p>'+inl(p.join(' '))+'</p>'}
 return h}
function applyTpl(el,k,o={}){const t=TPL[k]||TPL.minimal,[w,h]=SIZES[o.size||'A4']||SIZES.A4,ls=o.orient==='landscape',f=o.font;
 const v=(a,b)=>el.style.setProperty(a,b);
 v('--bf',f?(f==='mono'?'ui-monospace,Consolas,monospace':f):t.bf);v('--hf',t.hf);v('--ac',t.ac);v('--hb',t.hb);v('--sz',t.sz);
 v('--m',({narrow:48,normal:t.m||72,wide:96})[o.margin||'normal']+'px');
 el.style.width=(ls?h:w)+'px';el.style.minHeight=(ls?w:h)+'px'}
function fit(el){const w=el.offsetWidth,p=el.parentElement,cw=p&&p.parentElement?p.parentElement.clientWidth:0;if(!w||cw<=32)return;const s=Math.min(1,(cw-32)/w);el.style.transform='scale('+s+')';p.style.width=w*s+'px';p.style.height=el.offsetHeight*s+'px'}
const MF={SAMPLE,
 icons(){window.lucide&&lucide.createIcons()},
 toast(m,kind){const t=document.createElement('div');t.className='pointer-events-auto rounded-xl border bg-cloud px-4 py-3 text-sm shadow-lg dark:bg-[#121827] animate-[rise_.25s_ease-out] '+(kind==='error'?'border-verm':'border-black/10 dark:border-white/15');t.textContent=m;$('#toasts').append(t);setTimeout(()=>t.remove(),5000)},
 flash(m){try{sessionStorage.setItem('mf-flash',m)}catch(e){}},
 open(id){const m=$('#'+id);m.classList.remove('hidden');m.classList.add('flex');const b=$('input,select,button:not([data-close])',m)||$('button',m);b&&b.focus()},
 close(id){const m=$('#'+id);m.classList.add('hidden');m.classList.remove('flex')},
 applyTheme(){const t=S().theme,d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)},
 ago(ts){const d=Math.floor((Date.now()-ts)/864e5);return d<1?'Edited today':d===1?'Edited yesterday':'Edited '+d+' days ago'},
 docs(){let d=LS.get('mf-docs',null);if(!d){d=[['Q4 Product Report','business',1],['Thesis Chapter 2','academic',2],['Resume 2026','resume',4],['API Reference v2','tech',6],['Meeting Notes','minimal',9],['Project Proposal','business',14]].map(([t,k,n],i)=>({id:'seed'+i,title:t,tpl:k,upd:Date.now()-n*864e5,content:'# '+t+'\n\nSample content for this document.\n\n## Overview\n\n- First point\n- Second point\n- Third point\n'}));LS.set('mf-docs',d)}return d},
 saveDocs(d){LS.set('mf-docs',d)},
 async apiFetch(path,init){
  const bases=location.protocol==='file:'?['http://localhost:3000','http://127.0.0.1:3000']:['','http://localhost:3000','http://127.0.0.1:3000'].filter((b,i,a)=>!b||(location.origin!==b&&a.indexOf(b)===i));
  for(const base of bases){
   try{
    const r=await fetch(base+path,init);
    if(r.status===404||r.status===405||r.status===501)continue;
    if(r.ok&&path==='/api/convert'&&!(r.headers.get('content-type')||'').includes('pdf'))continue;
    if(r.ok&&path==='/api/templates'&&!(r.headers.get('content-type')||'').includes('json'))continue;
    return r;
   }catch(e){}
  }
  throw new Error('Cannot reach the MarkFlow PDF backend. Run "npm start" in CloudMarkDownConverter/backend and open http://localhost:3000.');
 },
 async loadTemplates(){try{const r=await this.apiFetch('/api/templates');if(!r.ok)return TPL;const list=await r.json();if(Array.isArray(list)&&list.length){Object.keys(TPL).forEach(k=>delete TPL[k]);list.forEach(t=>{TPL[t.id]={n:t.name,d:t.description,bf:t.bf,hf:t.hf,ac:t.ac,hb:t.hb,sz:t.sz,m:t.m}})}}catch(e){}return TPL},
 async exportPdf(payload){const r=await this.apiFetch('/api/convert',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok){let msg='Failed to generate PDF.';try{const j=await r.json();if(j&&j.error)msg=j.error}catch(e){}throw new Error(msg)}const blob=await r.blob();const cd=r.headers.get('content-disposition')||'';const m=cd.match(/filename="([^"]+)"/);const fallback=((payload.title||'document').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'document')+'.pdf';const name=(m&&m[1])||fallback;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return name},
 async run(ul,steps,ms=600){for(let i=0;i<=steps.length;i++){ul.innerHTML=steps.map((s,j)=>`<li class="flex items-center gap-2 ${j>i?'opacity-40':''}"><i data-lucide="${j<i?'check-circle-2':j===i?'loader-2':'circle'}" class="h-4 w-4 ${j<i?'text-flow':j===i?'animate-spin':''}"></i>${esc(s)}</li>`).join('');MF.icons();if(i<steps.length)await new Promise(r=>setTimeout(r,ms))}}
};
document.addEventListener('DOMContentLoaded',()=>{
 MF.icons();
 const f=sessionStorage.getItem('mf-flash');if(f){sessionStorage.removeItem('mf-flash');MF.toast(f)}
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-theme-toggle]')){const d=!document.documentElement.classList.contains('dark');setS({theme:d?'dark':'light'});MF.applyTheme()}
  if(e.target.closest('[data-close]')){const m=e.target.closest('[role=dialog]');m&&MF.close(m.id)}
  if(e.target.closest('#sbo')){$('#sb').classList.remove('-translate-x-full');$('#sbb').classList.remove('hidden')}
  if(e.target.closest('#sbb')){$('#sb').classList.add('-translate-x-full');$('#sbb').classList.add('hidden')}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')$$('[role=dialog].flex').forEach(m=>MF.close(m.id))});
 matchMedia('(prefers-color-scheme: dark)').addEventListener('change',MF.applyTheme);
});
