const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const M={species:['イノシシ','シカ','キョン','アライグマ','ハクビシン','タヌキ'],districts:['須賀','浜','高山田','久保','新町','六軒町','岩和田','実谷','七本','上布施','御宿台'],methods:['箱わな','くくりわな','猟銃','その他'],disposals:['焼却','埋設','解体','その他']};
const state={id:null,records:[],photos:{},filter:null};
let db;

addEventListener('DOMContentLoaded',async()=>{db=await openDB(); masters(); bind(); await reload(); showList(); if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js');});
function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open('kujo-report',1);q.onupgradeneeded=()=>{const d=q.result;d.createObjectStore('records',{keyPath:'id',autoIncrement:true});d.createObjectStore('photos',{keyPath:'key'});};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store);}
function all(store){return new Promise((ok,no)=>{const q=tx(store).getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});}
function get(store,key){return new Promise((ok,no)=>{const q=tx(store).get(key);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});}
function put(store,value){return new Promise((ok,no)=>{const q=tx(store,'readwrite').put(value);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});}
function del(store,key){return new Promise((ok,no)=>{const q=tx(store,'readwrite').delete(key);q.onsuccess=()=>ok();q.onerror=()=>no(q.error);});}
function addRecord(value){return new Promise((ok,no)=>{const q=tx('records','readwrite').add(value);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error);});}

function masters(){
 $('#species-options').innerHTML=M.species.map(x=>`<label><input type="radio" name="species" value="${x}" required> ${x}</label>`).join('');
 const s=$('[name=district]');M.districts.forEach(x=>s.add(new Option(x,x)));
 $('#method-options').innerHTML=M.methods.map(x=>`<label><input type="radio" name="capture_method" value="${x}"> ${x}</label>`).join('');
 $('#disposal-options').innerHTML=M.disposals.map(x=>`<label><input type="radio" name="disposal" value="${x}"> ${x}</label>`).join('');
}
function bind(){
 $('#new-btn').onclick=openNew;$('#back-btn').onclick=()=>{showList();reload();};
 $('#filter-month').onchange=e=>{state.filter=e.target.value;reload();};$('#filter-clear').onclick=()=>{state.filter=null;$('#filter-month').value='';reload();};
 $('#record-form').onsubmit=save;$('#delete-btn').onclick=removeCurrent;
 $('#pdf-btn').onclick=$('#print-btn').onclick=()=>open(`print.html?id=${state.id}`,'_blank');
 $('#docx-btn').onclick=$('#backup-btn').onclick=backup;$('#restore-btn').onclick=()=>$('#restore-file').click();$('#restore-file').onchange=restore;
 $$('.photo-slot').forEach(el=>{const n=+el.dataset.slot,input=$('input[type=file]',el),frame=$('.photo-frame',el);frame.onclick=()=>input.click();input.onchange=async()=>{if(input.files[0]){state.photos[n]=await normalize(input.files[0]);renderPhoto(n,state.photos[n]);}input.value='';};$('.photo-clear',el).onclick=async e=>{e.stopPropagation();delete state.photos[n];if(state.id)await del('photos',`${state.id}:${n}`);renderPhoto(n);};});
}
function showList(){$('#list-view').hidden=false;$('#edit-view').hidden=true;$('#back-btn').hidden=true;}
function showEdit(){$('#list-view').hidden=true;$('#edit-view').hidden=false;$('#back-btn').hidden=false;}
async function reload(){let a=(await all('records')).sort((a,b)=>(b.capture_date||'').localeCompare(a.capture_date||'')||b.id-a.id);if(state.filter)a=a.filter(x=>(x.capture_date||'').startsWith(state.filter));state.records=a;const counts={};a.forEach(x=>counts[x.species]=(counts[x.species]||0)+1);$('#summary').innerHTML=`<strong>${state.filter||'全期間'}</strong>: 合計 ${a.length} 件 `+Object.entries(counts).map(([k,v])=>`<span class="chip">${k} <strong>${v}</strong></span>`).join('');const body=$('#records-tbody');body.innerHTML='';for(const r of a){const pc=(await Promise.all([1,2,3].map(n=>get('photos',`${r.id}:${n}`)))).filter(Boolean).length;const tr=document.createElement('tr');tr.innerHTML=`<td>${e(r.capture_date)}</td><td>${e(r.species)}</td><td>${e(r.sex)}</td><td>${e(r.district)}</td><td>${e(r.location)}</td><td>${e(r.trap_number)}</td><td>${pc}/3</td><td class="row-actions"><button data-edit="${r.id}">編集</button><button data-print="${r.id}" class="primary">印刷</button></td>`;body.append(tr);}body.onclick=ev=>{const b=ev.target.closest('button');if(b?.dataset.edit)openExisting(+b.dataset.edit);if(b?.dataset.print)open(`print.html?id=${b.dataset.print}`,'_blank');};$('#empty-state').hidden=!!a.length;$('#records-table').hidden=!a.length;}
function reset(){$('#record-form').reset();state.photos={};for(let n=1;n<=3;n++)renderPhoto(n);$('#form-error').hidden=true;}
function buttons(on){['pdf-btn','print-btn','docx-btn','delete-btn'].forEach(x=>$('#'+x).hidden=!on);}
function openNew(){state.id=null;reset();$('[name=capture_date]').value=new Date().toISOString().slice(0,10);buttons(false);showEdit();}
async function openExisting(id){const r=await get('records',id);state.id=id;reset();for(const [k,v]of Object.entries(r)){const els=$$(`[name="${k}"]`);if(!els.length)continue;if(els[0].type==='radio'){const x=els.find(z=>z.value===String(v));if(x)x.checked=true;}else els[0].value=v??'';}for(let n=1;n<=3;n++){const p=await get('photos',`${id}:${n}`);if(p){state.photos[n]=p.blob;renderPhoto(n,p.blob);}}buttons(true);showEdit();}
async function save(ev){ev.preventDefault();const d=Object.fromEntries(new FormData(ev.currentTarget));d.updatedAt=Date.now();if(state.id){d.id=state.id;await put('records',d);}else state.id=await addRecord(d);for(const[n,blob]of Object.entries(state.photos))await put('photos',{key:`${state.id}:${n}`,recordId:state.id,slot:+n,blob});buttons(true);toast('端末に保存しました');await reload();}
async function removeCurrent(){if(!state.id||!confirm('この記録を削除しますか？'))return;await del('records',state.id);for(let n=1;n<=3;n++)await del('photos',`${state.id}:${n}`);showList();reload();}
function renderPhoto(n,blob){const el=$(`.photo-slot[data-slot="${n}"]`),img=$('img',el),ph=$('.placeholder',el),btn=$('.photo-clear',el);if(!blob){img.hidden=true;ph.hidden=false;btn.hidden=true;return;}img.src=URL.createObjectURL(blob);img.hidden=false;ph.hidden=true;btn.hidden=false;}
async function normalize(file){let image,url;if('createImageBitmap'in window){image=await createImageBitmap(file,{imageOrientation:'from-image'});}else{url=URL.createObjectURL(file);image=new Image;await new Promise((ok,no)=>{image.onload=ok;image.onerror=no;image.src=url;});}const w=image.width||image.naturalWidth,h=image.height||image.naturalHeight,scale=Math.min(1,2560/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);if(url)URL.revokeObjectURL(url);return new Promise(ok=>c.toBlob(ok,'image/jpeg',.9));}
async function backup(){const records=await all('records'),photos=await all('photos'),encoded=[];for(const p of photos)encoded.push({...p,blob:await blob64(p.blob)});download(new Blob([JSON.stringify({version:1,records,photos:encoded})],{type:'application/json'}),'捕獲報告書バックアップ.json');}
async function restore(ev){try{const data=JSON.parse(await ev.target.files[0].text());for(const r of data.records||[])await put('records',r);for(const p of data.photos||[])await put('photos',{...p,blob:base64Blob(p.blob)});toast('復元しました');reload();}catch{alert('バックアップを読み込めませんでした');}ev.target.value='';}
function blob64(b){return new Promise(ok=>{const r=new FileReader;r.onload=()=>ok(r.result);r.readAsDataURL(b);});}function base64Blob(s){const[a,b]=s.split(','),m=a.match(/:(.*?);/)[1],x=atob(b),u=new Uint8Array(x.length);for(let i=0;i<x.length;i++)u[i]=x.charCodeAt(i);return new Blob([u],{type:m});}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function e(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}function toast(s){const t=$('#toast');t.textContent=s;t.hidden=false;setTimeout(()=>t.hidden=true,2200);}
