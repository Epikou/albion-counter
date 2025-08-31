// toggle-addon.js — n'ajoute QUE le toggle/dé-fade, sans toucher à ton app.js
(function(){
  'use strict';

  let lastId = null;

  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function showAll(){
    if (typeof window.showAllEdges === 'function'){
      try{ window.showAllEdges(); return; }catch(_){}
    }
    // fallback générique
    qsa('.edge').forEach(e=>{ e.classList.remove('dim','highlight'); e.style.display=''; });
    qsa('.node,.label-wrap').forEach(n=> n.classList.remove('dim'));
  }

  function clearUI(){
    showAll();
    try{ qs('#title').textContent = 'Counter Albion'; }catch(_){}
    try{ qs('#metaSmall').textContent = ''; }catch(_){}
    try{ qs('#forces').innerHTML = ''; qs('#weaks').innerHTML=''; }catch(_){}
  }

  function getNodeIdFromTarget(t){
    const n = t.closest && t.closest('.node');
    if (!n) return null;
    return n.getAttribute('data-id') || n.dataset && n.dataset.id || null;
  }

  function onSvgClickCapture(e){
    if (e.button !== 0) return; // gauche
    const id = getNodeIdFromTarget(e.target);
    if (id){ // clic sur une arme
      if (lastId && lastId === id){
        // toggle off : empêcher le handler interne et tout dé-fader
        e.stopPropagation();
        e.preventDefault();
        lastId = null;
        clearUI();
        return;
      } else {
        // laisser l'app d'origine gérer, on mémorise l'id
        lastId = id;
        return;
      }
    } else {
      // clic dans le vide → reset
      lastId = null;
      clearUI();
    }
  }

  function boot(){
    const svg = qs('#canvas svg') || qs('svg');
    if (!svg){ requestAnimationFrame(boot); return; }
    svg.addEventListener('click', onSvgClickCapture, true); // CAPTURE
    const canvas = qs('#canvas');
    if (canvas) canvas.addEventListener('click', onSvgClickCapture, true);
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ lastId=null; clearUI(); } });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

// Auto-color "Forces/Avantages" & "Faiblesses/Contres" titles in the sidebar
(function(){
  function SB(){ return document.getElementById('sidebar') || document.querySelector('#app #sidebar'); }
  function tagTitles(){
    const sb = SB(); if(!sb) return;
    const headers = sb.querySelectorAll('h3, .group h3, header h3');
    headers.forEach(h => {
      const t = (h.textContent || '').toLowerCase();
      // clear previous
      h.classList.remove('title-green','title-red');
      if (t.includes('force') || t.includes('avantage')) h.classList.add('title-green');
      if (t.includes('faiblesse') || t.includes('contre')) h.classList.add('title-red');
    });
  }
  const boot = () => {
    tagTitles();
    const sb = SB();
    if (sb){
      const obs = new MutationObserver(tagTitles);
      obs.observe(sb, {subtree:true, childList:true, characterData:true});
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


// === Per-relation inline notes in sidebar ===
(function(){
  const SB = () => document.getElementById('sidebar') || document.querySelector('#app #sidebar');

  // Robust slug (ASCII, for keys)
  function slug(s){
    try{
      return String(s||'').normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .replace(/[^a-zA-Z0-9]+/g,' ')
        .trim().replace(/\s+/g,'-').toLowerCase();
    }catch(_){ return String(s||'').toLowerCase(); }
  }

  function currentSubject(){
    // Try to read weapon selected from the header "Counter Albion — XXXXX"
    const h = document.querySelector('#sidebar header h1, #sidebar .panel-title, #app h1, header h1');
    if(h && h.textContent.includes('—')){
      return h.textContent.split('—').pop().trim();
    }
    // fallback: read small "arme sélectionnée" area if provided somewhere
    const lbl = document.querySelector('#sidebar [data-selected-name]');
    if (lbl) return lbl.getAttribute('data-selected-name');
    return 'global';
  }

  function keyFor(subject, section, name){
    return `ca_note::${slug(subject)}::${section}::${slug(name)}`;
  }

  function saveNote(k, v){ try{ localStorage.setItem(k, v); }catch(_){ /* ignore */ } }
  function loadNote(k){ try{ return localStorage.getItem(k) || ''; }catch(_){ return ''; } }

  function findSections(sb){
    // try explicit containers if they exist
    const forces = sb.querySelector('#forces') || sb.querySelector('[data-section="forces"]');
    const weaks  = sb.querySelector('#weaks')  || sb.querySelector('[data-section="weaks"]');
    if (forces || weaks) return {forces, weaks};

    // fallback: find by headings text
    let f=null, w=null;
    sb.querySelectorAll('h3').forEach(h=>{
      const t=(h.textContent||'').toLowerCase();
      if(!f && (t.includes('force')||t.includes('avantage'))) f = h.parentElement;
      if(!w && (t.includes('faiblesse')||t.includes('contre')))  w = h.parentElement;
    });
    return {forces:f, weaks:w};
  }

  function cardName(card){
    // try dedicated name element
    const el = card.querySelector('.rel-name, .name, strong, b, .title');
    if (el) return el.textContent.trim();
    // fallback: first text node
    return (card.textContent||'').trim().split('\n')[0].trim();
  }

  function enhanceSection(sectionEl, sectionKey){
    if(!sectionEl) return;
    // each card could be .rel-card or any direct child (buttons already inside)
    const cards = Array.from(sectionEl.querySelectorAll('.rel-card, .card, .item'))
      .concat(Array.from(sectionEl.children).filter(x=>x.matches && !x.matches('h3, header, textarea, input, button')));
    const subject = currentSubject();

    cards.forEach(card=>{
      if (card.dataset && card.dataset.noteEnhanced) return;
      // Skip if this is a container row (no checkbox/name/icon)
      const nm = cardName(card);
      if (!nm) return;

      // Build textarea
      const ta = document.createElement('textarea');
      ta.className = 'rel-note';
      ta.placeholder = 'Note…';
      const key = keyFor(subject, sectionKey, nm);
      ta.value = loadNote(key);
      ta.addEventListener('input', e => saveNote(key, ta.value));

      // insert at end of card
      card.appendChild(ta);
      if (card.dataset) card.dataset.noteEnhanced = '1';
    });
  }

  function run(){
    const sb = SB(); if(!sb) return;
    const {forces, weaks} = findSections(sb);
    enhanceSection(forces, 'forces');
    enhanceSection(weaks,  'weaks');
  }

  // initial + observe updates
  const boot = () => {
    run();
    const sb = SB();
    if (sb){
      const obs = new MutationObserver(run);
      obs.observe(sb, {subtree:true, childList:true});
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


// === Repeating chevrons overlay on edges (direction hint) ===
(function(){
  const NS = 'http://www.w3.org/2000/svg';

  function buildChevronsForPath(path){
    if (!path || typeof path.getTotalLength !== 'function') return;
    const total = path.getTotalLength();
    if (!isFinite(total) || total <= 1) return;

    // Remove previous sibling chevrons if any
    const next = path.nextSibling;
    if (next && next.classList && next.classList.contains('edge-chevrons')) next.remove();

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'edge-chevrons');

    // color: match path stroke
    const stroke = path.getAttribute('stroke') || getComputedStyle(path).stroke || '#4ade80';

    // spacing & size
    const STEP = 26;     // px between chevrons along the path
    const LEN  = 12;     // tip-to-tail length of each chevron
    const W    = 6;      // width (thickness)

    for (let s = STEP*0.8; s < total - STEP*0.8; s += STEP){
      const p  = path.getPointAtLength(s);
      const p2 = path.getPointAtLength(Math.min(total, s + 0.01));
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      const cos = Math.cos(ang), sin = Math.sin(ang);

      const tipx = p.x + cos * (LEN/2),  tipy = p.y + sin * (LEN/2);
      const tailx= p.x - cos * (LEN/2),  taily= p.y - sin * (LEN/2);
      const lx   = tailx + (-sin) * (W/2),  ly   = taily + (cos) * (W/2);
      const rx   = tailx - (-sin) * (W/2),  ry   = taily - (cos) * (W/2);

      const poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', `${lx},${ly} ${tipx},${tipy} ${rx},${ry}`);
      poly.setAttribute('fill', stroke);
      g.appendChild(poly);
    }

    // insert just after path → CSS sibling rules sync dim/highlight
    path.parentNode.insertBefore(g, path.nextSibling);
  }

  function regenAllChevrons(){
    const svg = document.querySelector('#canvas svg, svg');
    if (!svg) return;
    const paths = svg.querySelectorAll('.edge'); // your edges use class "edge"
    paths.forEach(p => { try { buildChevronsForPath(p); } catch(_){ } });
  }

  // Initial build (after DOM & drawing)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(regenAllChevrons, 0));
  } else {
    setTimeout(regenAllChevrons, 0);
  }

  // Observe redraws / class changes / d changes
  const obs = new MutationObserver((muts)=>{
    let need=false;
    muts.forEach(m=>{
      if (m.type === 'childList'){
        if ([...m.addedNodes].some(n => n.nodeType===1 && (n.matches?.('.edge') || n.querySelector?.('.edge')))) need=true;
      }
      if (m.type === 'attributes'){
        const t = m.target;
        if (t.matches?.('.edge') && (m.attributeName === 'd' || m.attributeName === 'class')) {
          need = true;
        }
      }
    });
    if (need) { setTimeout(regenAllChevrons, 0); }
  });
  obs.observe(document, {subtree:true, childList:true, attributes:true, attributeFilter:['d','class']});
})();


// === Single "Ajouter flèche" button (use only add_force) ===
(function(){
  function SB(){ return document.getElementById('sidebar') || document.querySelector('#app #sidebar'); }
  function findButton(byText){
    const sb = SB(); if(!sb) return null;
    const buttons = sb.querySelectorAll('button, .btn, [role="button"]');
    for(const b of buttons){
      const t = (b.textContent || '').trim().toLowerCase();
      if (t.includes(byText)) return b;
    }
    return null;
  }
  function markRedButton(){
    const b = findButton('flèche rouge');
    if (b){
      b.classList.add('btn-red');
      b.setAttribute('aria-hidden', 'true');
      b.style.display = 'none';
    }
  }
  function renameGreenToAdd(){
    const b = findButton('flèche verte');
    if (b){
      if (!b.dataset._singleAddWired){
        b.dataset._singleAddWired = '1';
        b.textContent = 'Ajouter flèche';
        b.addEventListener('click', ()=>{
          try{
            // force the mode to add_force; toggle visual active class
            if (window.MODE === 'add_force'){ window.MODE = 'view'; b.classList.remove('btn-add-active'); }
            else { window.MODE = 'add_force'; b.classList.add('btn-add-active'); }
          }catch(_){}
        }, {capture:false});
      }
    }
  }
  function boot(){
    markRedButton();
    renameGreenToAdd();
    // Observe sidebar in case it gets rebuilt
    const sb = SB();
    if (sb){
      const obs = new MutationObserver(()=>{ markRedButton(); renameGreenToAdd(); });
      obs.observe(sb, {subtree:true, childList:true, characterData:true});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


// tag edges incoming/outgoing around selection
(function(){
  function clearEdgeDir(){
    document.querySelectorAll('.edge.edge-incoming, .edge.edge-outgoing')
      .forEach(p=>{ p.classList.remove('edge-incoming','edge-outgoing'); });
  }
  function applyEdgeDir(id){
    clearEdgeDir();
    const all = document.querySelectorAll('.edge');
    all.forEach(p=>{
      const src = p.getAttribute('data-src') || p.dataset?.src;
      const dst = p.getAttribute('data-dst') || p.dataset?.dst;
      if (!src || !dst) return;
      if (src === id){ p.classList.add('edge-outgoing'); }
      if (dst === id){ p.classList.add('edge-incoming'); }
    });
  }
  function onCaptureClick(e){
    if (e.button !== 0) return;
    const node = e.target.closest && e.target.closest('.node');
    if (node){
      const id = node.getAttribute('data-id') || node.dataset?.id;
      if (id) applyEdgeDir(id);
    } else {
      clearEdgeDir();
    }
  }
  // hook capture on svg/canvas
  function boot(){
    const svg = document.querySelector('#canvas svg, svg');
    const canvas = document.getElementById('canvas');
    if (svg) svg.addEventListener('click', onCaptureClick, true);
    if (canvas) canvas.addEventListener('click', onCaptureClick, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
