(function(){
  const svg = document.getElementById('meta');
  const titleEl = document.getElementById('title');
  const metaSmall = document.getElementById('metaSmall');
  const forcesDiv = document.getElementById('forces');
  const weaksDiv = document.getElementById('weaks');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const exportArea = document.getElementById('exportArea');
  const modeView = document.getElementById('modeView');
  const modeAddForce = document.getElementById('modeAddForce');
  const modeAddWeak = document.getElementById('modeAddWeak');
  const modeDelete = document.getElementById('modeDelete');
  const themeSelect = document.getElementById('themeSelect');
  const bgColor = document.getElementById('bgColor');

  let MODE = 'view', pendingSrc = null;
  let size = 3000, center = [1500,1500], icon_px = 72;
  let nodes = [], edges = [];
  const svgNS = 'http://www.w3.org/2000/svg';
  const CATS = ['Mobilité','Burst','Sustain'];
  const NODE_NOTE_KEY='albion_node_notes_v1';
  function loadNodeNotes(){ try{return JSON.parse(localStorage.getItem(NODE_NOTE_KEY)||'{}');}catch(e){return {}} }
  function saveNodeNotes(d){ localStorage.setItem(NODE_NOTE_KEY, JSON.stringify(d)); }
  function slug(s){ try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}catch(e){return String(s).toLowerCase();} }
  function loadAttrs(){ try{return JSON.parse(localStorage.getItem('albion_meta_attrs_v1')||'{}');}catch(e){return {};} }
  function saveAttrs(obj){ localStorage.setItem('albion_meta_attrs_v1', JSON.stringify(obj)); }

  function make(tag, attrs){ const el=document.createElementNS(svgNS, tag); if(attrs){ for(const k in attrs){ el.setAttribute(k, attrs[k]); } } return el; }

  function setThemeVars(bg1,bg2,accent){
    // panel vars
    const isLight = (bg1.startsWith('#f')||bg1.startsWith('#e'));
    const panelBg = isLight ? '#f3ead5' : '#0f1115';
    const panelCard = isLight ? '#ffffff' : '#161a22';
    const panelBorder = isLight ? '#c9bfa6' : '#222630';
    const textCol = isLight ? '#222' : '#e6e6e6';
    document.documentElement.style.setProperty('--bg1', bg1);
    document.documentElement.style.setProperty('--bg2', bg2);
    if(accent) document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--panel-bg', panelBg);
    document.documentElement.style.setProperty('--panel-card', panelCard);
    document.documentElement.style.setProperty('--panel-border', panelBorder);
    document.documentElement.style.setProperty('--text', textCol); // panel vars
    // also apply inline so it's always visible
    const canvasWrap = document.getElementById('canvasWrap');
    if(canvasWrap){ canvasWrap.style.background = 'radial-gradient(ellipse at center, '+bg1+' 0%,'+bg2+' 70%)'; }
  }
  function applyTheme(val){
    if(val==='albion-dark'){ setThemeVars('#141821','#0f1115','#c9732a'); bgColor.style.display='none'; }
    else if(val==='albion-copper'){ setThemeVars('#1a1410','#0e0a08','#d58a3b'); bgColor.style.display='none'; }
    else if(val==='albion-parchment'){ setThemeVars('#f2e6cf','#d8c9a7','#a05c2d'); bgColor.style.display='none'; }
    else { bgColor.style.display='inline-block'; }
  }
  themeSelect.onchange = ()=>applyTheme(themeSelect.value);
  // canvas background click clears fades
  /*canvas-clear-dim*/
  svg.addEventListener('click', (e)=>{ if(e.target===svg) showAllEdges(); });

  // Middle-click pan (idempotent)
  (function(){
    if (svg.__panInit) return;
    svg.__panInit = true;
    let isPanning=false, panStart=[0,0], panVB=[0,0,0,0];
    svg.addEventListener('mousedown', e=>{
      if(e.button!==1) return;
      e.preventDefault();
      isPanning=true;
      panStart=[e.clientX, e.clientY];
      panVB = svg.getAttribute('viewBox').split(' ').map(parseFloat);
    });
    window.addEventListener('mousemove', e=>{
      if(!isPanning) return;
      const rect = svg.getBoundingClientRect();
      const dx = (e.clientX - panStart[0]) * (panVB[2]/rect.width);
      const dy = (e.clientY - panStart[1]) * (panVB[3]/rect.height);
      svg.setAttribute('viewBox', `${panVB[0] - dx} ${panVB[1] - dy} ${panVB[2]} ${panVB[3]}`);
    }, {passive:true});
    window.addEventListener('mouseup', e=>{ if(e.button===1) isPanning=false; });
  })();

  bgColor.oninput = ()=>{ document.documentElement.style.setProperty('--bg2', bgColor.value); setThemeVars(getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim()||'#141821', bgColor.value); };
  applyTheme(themeSelect.value);
  // canvas background click clears fades
  /*canvas-clear-dim*/
  svg.addEventListener('click', (e)=>{ if(e.target===svg) showAllEdges(); });

  // Middle-click pan (idempotent)
  (function(){
    if (svg.__panInit) return;
    svg.__panInit = true;
    let isPanning=false, panStart=[0,0], panVB=[0,0,0,0];
    svg.addEventListener('mousedown', e=>{
      if(e.button!==1) return;
      e.preventDefault();
      isPanning=true;
      panStart=[e.clientX, e.clientY];
      panVB = svg.getAttribute('viewBox').split(' ').map(parseFloat);
    });
    window.addEventListener('mousemove', e=>{
      if(!isPanning) return;
      const rect = svg.getBoundingClientRect();
      const dx = (e.clientX - panStart[0]) * (panVB[2]/rect.width);
      const dy = (e.clientY - panStart[1]) * (panVB[3]/rect.height);
      svg.setAttribute('viewBox', `${panVB[0] - dx} ${panVB[1] - dy} ${panVB[2]} ${panVB[3]}`);
    }, {passive:true});
    window.addEventListener('mouseup', e=>{ if(e.button===1) isPanning=false; });
  })();

  function showAllEdges(){ Array.from(svg.querySelectorAll('.edge')).forEach(e=>{e.style.display=''; e.classList.remove('highlight');}); }

  function posOf(id){ const n=nodes.find(v=>v.id===id); return {x:n.x,y:n.y, label:n.label, icon:n.icon}; }

  function addEdge(layer, e){
    const A = posOf(e.src), B = posOf(e.dst);
    const r = icon_px/2;
    const v1x = center[0] - A.x, v1y = center[1] - A.y, L1=Math.hypot(v1x,v1y)||1;
    const v2x = center[0] - B.x, v2y = center[1] - B.y, L2=Math.hypot(v2x,v2y)||1;
    const ax = A.x + v1x/L1 * r, ay = A.y + v1y/L1 * r;
    const bx = B.x + v2x/L2 * r, by = B.y + v2y/L2 * r;
    const midx=(ax+bx)/2, midy=(ay+by)/2;
    const cx=midx + (center[0]-midx)*0.2;
    const cy=midy + (center[1]-midy)*0.2;
    const path = make('path', {'class':'edge '+e.type,'data-src':e.src,'data-dst':e.dst, d:`M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`, fill:'none','stroke-width':12});
    // no arrowhead
    layer.appendChild(path);
    return path;
  }

  function loadState(){ try{return JSON.parse(localStorage.getItem('albion_meta_state_v1')||'[]');}catch(e){return[];} }
  function saveState(arr){ localStorage.setItem('albion_meta_state_v1', JSON.stringify(arr)); }
  function redrawCustom(){ customLayer.innerHTML=''; (loadState()||[]).forEach(e=> addEdge(customLayer, e)); }
  function drawCenterLogo(){
    try{
      centerLayer.innerHTML='';
      const w = Math.round(size*0.22*3);
      const h = Math.round(size*0.10*3);
      const x = center[0] - w/2;
      const y = center[1] - h/2;
      const img = make('image', {class:'center-logo', x:String(x), y:String(y), width:String(w), height:String(h)});
      try{ img.setAttribute('href','data/logo_albion.png'); }catch(_){}
      try{ img.setAttributeNS('http://www.w3.org/1999/xlink','href','data/logo_albion.png'); }catch(_){}
      centerLayer.appendChild(img);
    }catch(err){ console.error('drawCenterLogo failed', err); }
  }

  function focusNode(id){
    const combined = edges.concat(loadState());
    const outEdges = combined.filter(e=>e.src===id);
    const inEdges  = combined.filter(e=>e.dst===id);

    Array.from(svg.querySelectorAll('.edge')).forEach(e=>e.classList.remove('highlight'));
    outEdges.forEach(e=>{ const el = svg.querySelector(`.edge[data-src="${e.src}"][data-dst="${e.dst}"]`); if(el) el.classList.add('highlight'); });
    inEdges.forEach(e=>{ const el = svg.querySelector(`.edge[data-src="${e.src}"][data-dst="${e.dst}"]`); if(el) el.classList.add('highlight'); });

    forcesDiv.innerHTML=''; weaksDiv.innerHTML='';
    outEdges.forEach(e=> forcesDiv.appendChild(makeEdgeCard(e,'force')));
    inEdges.forEach(e=> weaksDiv.appendChild(makeEdgeCard(e,'weak')));

    const node = nodes.find(n=>n.id===id);
    titleEl.textContent = 'Counter Albion — '+(node?node.label:id);
    metaSmall.textContent = `${outEdges.length} forces • ${inEdges.length} faiblesses`;
    // load note of selected weapon
    try{
      const noteEl = document.getElementById('nodeNote');
      const book = loadNodeNotes();
      noteEl.value = (book[id]||''); // id is selected node id
      noteEl.oninput = (evt)=>{ const b=loadNodeNotes(); b[id]=noteEl.value; saveNodeNotes(b); };
    }catch(err){}

    if (MODE==='view'){
      const connected = new Set([id, ...outEdges.map(e=>e.dst), ...inEdges.map(e=>e.src)]);
      Array.from(svg.querySelectorAll('.node')).forEach(el=>{
        const nid = el.getAttribute('data-id');
        el.classList.toggle('dim', !connected.has(nid));
      });
      Array.from(svg.querySelectorAll('.label-wrap')).forEach(el=>{
        const nid = el.getAttribute('data-id');
        el.classList.toggle('dim', !connected.has(nid));
      });
      Array.from(svg.querySelectorAll('.edge')).forEach(el=>{
        const src=el.getAttribute('data-src'), dst=el.getAttribute('data-dst');
        const keep = (src===id || dst===id);
        el.classList.toggle('dim', !keep);
      });
    }
titleEl.textContent = 'Counter Albion — '+(node?node.label:id);
    metaSmall.textContent = `${outEdges.length} forces • ${inEdges.length} faiblesses`;
  }

  function makeEdgeCard(edge, side){
    const otherId = (side==='force') ? edge.dst : edge.src;
    const n = nodes.find(x=>x.id===otherId) || {label:otherId, icon:''};
    const key = edge.src + '|' + edge.dst;
    const attrs = loadAttrs();

    const div=document.createElement('div'); div.className='card';
    const i=document.createElement('img'); i.src=n.icon||''; i.alt=n.label||otherId; div.appendChild(i);
    const t=document.createElement('div'); t.className='title'; t.textContent=n.label||otherId; div.appendChild(t);

    const checks = document.createElement('div'); checks.className='checks';
    CATS.forEach(cat=>{
      const catKey = slug(cat);
      const lab = document.createElement('label'); lab.className='check';
      const inp = document.createElement('input'); inp.type='checkbox'; inp.checked = !!(attrs[key] && attrs[key][catKey]);
      inp.onchange = ()=>{ const m = loadAttrs(); if(!m[key]) m[key]={}; m[key][catKey]=inp.checked; saveAttrs(m); };
      const span = document.createElement('span'); span.textContent = cat;
      lab.appendChild(inp); lab.appendChild(span); checks.appendChild(lab);
    });
    div.appendChild(checks);
    return div;
  }
function setMode(m){
    MODE=m; pendingSrc=null;
    [modeView,modeAddForce,modeAddWeak,modeDelete].forEach(b=>b.classList.remove('mode-active'));
    ({'view':modeView,'add_force':modeAddForce,'add_weak':modeAddWeak,'delete':modeDelete}[m]).classList.add('mode-active');

    metaSmall.classList.remove('hint-green','hint-red','hint-idle');
    metaSmall.textContent = m==='view' ? 'Mode Voir : clique une arme pour afficher ses relations.' : (m==='add_force'?'Ajout (vert) : source puis cible.': m==='add_weak'?'Ajout (rouge) : source puis cible.':'Suppression : clique une flèche.');
    if(m==='add_force') metaSmall.classList.add('hint-green'); else if(m==='add_weak') metaSmall.classList.add('hint-red'); else metaSmall.classList.add('hint-idle');

    if(m==='view') showAllEdges();
  }
  modeView.onclick = ()=>setMode('view');
  modeAddForce.onclick = ()=>setMode('add_force');
  modeAddWeak.onclick  = ()=>setMode('add_weak');
  modeDelete.onclick   = ()=>setMode('delete');

  // Zoom: wheel on SVG only (no Ctrl)
  svg.addEventListener('wheel', e=>{
    e.preventDefault();
    const vb = svg.getAttribute('viewBox').split(' ').map(parseFloat);
    let [x,y,w,h] = vb;
    const rect = svg.getBoundingClientRect();
    const mx=(e.clientX-rect.left)/rect.width*w+x;
    const my=(e.clientY-rect.top)/rect.height*h+y;
    const scale = e.deltaY>0 ? 1.1 : 0.9;
    w*=scale; h*=scale; x=mx-(mx-x)*scale; y=my-(my-y)*scale;
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  }, {passive:false});

  // Delete by clicking edge or by clicking node (all edges)
  svg.addEventListener('click', function(e){
    try{
      if(MODE!=='delete') return;
      let el = e.target;
      if(el && el.classList && el.classList.contains('edge')){
        const src = el.getAttribute('data-src'), dst = el.getAttribute('data-dst');
        const s = loadState(); const idx = s.findIndex(ed=>ed.src===src && ed.dst===dst);
        if(idx>-1){ s.splice(idx,1); saveState(s); }
        el.remove();
        redrawCustom();
        metaSmall.textContent = 'Flèche supprimée.';
        return;
      }
      const nodeEl = e.target.closest && e.target.closest('.node');
      if(nodeEl){
        const id = nodeEl.getAttribute('data-id');
        const s = loadState().filter(ed=>!(ed.src===id||ed.dst===id));
        saveState(s);
        Array.from(svg.querySelectorAll(`.edge[data-src="${id}"], .edge[data-dst="${id}"]`)).forEach(el2=>el2.remove());
        redrawCustom();
        metaSmall.textContent = 'Flèches supprimées pour ce nœud.';
      }
    }catch(err){ console.error(err); }
  }, true);

  exportBtn.onclick = ()=>{ exportArea.value = localStorage.getItem('albion_meta_state_v1') || '[]'; exportArea.select(); document.execCommand('copy'); metaSmall.textContent='Code copié.'; };
  importBtn.onclick = ()=>{ try{ const arr=JSON.parse(exportArea.value||'[]'); if(Array.isArray(arr)){ localStorage.setItem('albion_meta_state_v1', JSON.stringify(arr)); redrawCustom(); metaSmall.textContent='Import ok.'; } else throw 0; }catch(e){ metaSmall.textContent='JSON invalide.'; } };

  // Build SVG skeleton
  const defs = make('defs');
  svg.appendChild(defs);

  const centerLayer  = make('g'); centerLayer.id='centerLayer';  svg.appendChild(centerLayer);
  const defaultLayer = make('g'); defaultLayer.id='defaultEdges'; svg.appendChild(defaultLayer);
  const customLayer  = make('g'); customLayer.id='customEdges';  svg.appendChild(customLayer);
  const nodesLayer   = make('g'); nodesLayer.id='nodesLayer';    svg.appendChild(nodesLayer);

  function onSelectNode(id){
    if(MODE==='delete'){ return; }
    if(MODE==='view'){ showAllEdges(); focusNode(id); return; }
    if(MODE==='add_force' || MODE==='add_weak'){
      if(!pendingSrc){ pendingSrc=id; metaSmall.textContent='Source choisie. Clique une cible.'; return; }
      if(pendingSrc===id){ metaSmall.textContent='Choisis une cible différente.'; return; }
      const type = (MODE==='add_force'?'force':'weak');
      const s=loadState(); s.push({src:pendingSrc,dst:id,type}); saveState(s); pendingSrc=null;
      redrawCustom(); focusNode(id);
      metaSmall.textContent='Flèche ajoutée.';
    }
  }

  // Load data
  Promise.all([
    fetch('data/nodes.json').then(r=>r.json()),
    fetch('data/edges.json').then(r=>r.json())
  ]).then(([sizeWrap, edgeWrap])=>{
    size = sizeWrap.size; center = sizeWrap.center; icon_px = sizeWrap.icon_px; nodes = sizeWrap.nodes;
    edges = edgeWrap.edges;

    /*LABEL_NUDGE_PRE*/
    // Precompute angle bins to stagger labels and reduce overlap
    const STEP = Math.PI/24; // ~7.5 degree bins
    const binCounts = new Map(); const binIndex = new Map();
    nodes.forEach(n=>{
      const ang = Math.atan2(n.y-center[1], n.x-center[0]);
      const bin = Math.round(ang/STEP);
      binCounts.set(bin, (binCounts.get(bin)||0)+1);
      binIndex.set(n.id, bin);
    });
    const binProgress = new Map();

    svg.setAttribute('viewBox', '0 0 '+size+' '+size);

    // center logo
    drawCenterLogo();

    /*PLACED_RECTS*/
    const placedLabelRects = []; // world-space rects of placed labels to avoid overlaps


    // draw nodes
    nodes.forEach(n=>{
      const img = make('image', {class:'node','data-id':n.id, href:n.icon, x:(n.x-icon_px/2), y:(n.y-icon_px/2), width:icon_px, height:icon_px});
      try{ img.setAttributeNS('http://www.w3.org/1999/xlink','href', n.icon); }catch(_){}
      const ux=(n.x-center[0]), uy=(n.y-center[1]);
      const theta = Math.atan2(uy, ux);
      const baseRad = icon_px*0.72 + 4 + Math.abs(Math.sin(theta))*8;
      const bin = binIndex.get(n.id);
      const idx = (function(){ const v=binProgress.get(bin)||0; binProgress.set(bin,v+1); return v; })();
      const nudge = idx * 8;

      let r = baseRad + nudge;
      let lx = n.x + Math.cos(theta) * r;
      let ly = n.y + Math.sin(theta) * r;

      const wrap = make('g',{class:'label-wrap','data-id':n.id, transform:`translate(${lx} ${ly})`});
      const txt = make('text',{class:'label','data-id':n.id,'text-anchor':'middle','dominant-baseline':'central'});
      txt.textContent=n.label;
      wrap.appendChild(txt);
      nodesLayer.appendChild(img); nodesLayer.appendChild(wrap);
      try{
        const bb = txt.getBBox();
        const padX = 8, padY = 4;
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const rw = (bb.width + 2*padX)/2, rh = (bb.height + 2*padY)/2;
        // ensure we clear the icon by projecting rect on radial direction
        const proj = Math.abs(rw*cosT) + Math.abs(rh*sinT);
        const minR = icon_px/2 + proj + 4;
        if (r < minR) r = minR;

        lx = n.x + cosT * r;
        ly = n.y + sinT * r;
        wrap.setAttribute('transform', `translate(${lx} ${ly})`);

        // World-rect + collision resolution: alternate radial outward and small tangent slides
        const toWorldRect = (x,y)=>({ x: x - rw, y: y - rh, w: rw*2, h: rh*2 });
        const intersects = (a,b)=> !(b.x > a.x+a.w || b.x+b.w < a.x || b.y > a.y+a.h || b.y+b.h < a.y);
        let rectW = toWorldRect(lx, ly);
        const tanX = -sinT, tanY = cosT;
        let tries = 0, slide = 0;
        while (tries < 36 && placedLabelRects.some(rct => intersects(rectW, rct))){
          if (tries % 2 === 0){ // radial step
            r += 6;
            lx = n.x + cosT * r;
            ly = n.y + sinT * r;
          } else { // tangent slide
            slide = (slide===0 ? 6 : -slide);
            lx += tanX * slide;
            ly += tanY * slide;
          }
          rectW = toWorldRect(lx, ly);
          tries++;
        }
        wrap.setAttribute('transform', `translate(${lx} ${ly})`);
        placedLabelRects.push(rectW);
const rect = make('rect',{class:'label-bg', x:String(-rw), y:String(-rh), width:String(rw*2), height:String(rh*2)});
        wrap.insertBefore(rect, txt);
      }catch(_){}

      // hover to show label
      img.addEventListener('mouseenter', ()=> wrap.classList.add('show'));
      img.addEventListener('mouseleave', ()=> { if(!wrap.matches(':hover')) wrap.classList.remove('show'); });
      wrap.addEventListener('mouseenter', ()=> wrap.classList.add('show'));
      wrap.addEventListener('mouseleave', ()=> wrap.classList.remove('show'));
      // allow click on label to select the node
      wrap.addEventListener('click', (ev)=>{ ev.stopPropagation(); onSelectNode(n.id); });
});

    // draw default edges
    edges.forEach(e=> addEdge(defaultLayer, e));

    // interactions
    const nodesEls=Array.from(svg.querySelectorAll('.node'));
    const labelsEls=Array.from(svg.querySelectorAll('.label'));
    nodesEls.forEach(n=> n.addEventListener('click', e=>{ e.stopPropagation(); onSelectNode(n.getAttribute('data-id')); }));
    labelsEls.forEach(n=> n.addEventListener('click', e=>{ e.stopPropagation(); onSelectNode(n.getAttribute('data-id')); }));

    // initial
    redrawCustom();
    setMode('view');
  }).catch(err=>{
    console.error('Data load error', err);
    metaSmall.textContent = 'Erreur de chargement des données.';
  });
})();