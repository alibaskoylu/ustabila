import { supabase } from './supabase.js';



// --- Türkçe harf duyarsızlaştırma ---
function normalizeText(str) {
  return String(str || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i')
    .replace(/İ/g,'i')
    .replace(/ş/g,'s').replace(/Ş/g,'s')
    .replace(/ğ/g,'g').replace(/Ğ/g,'g')
    .replace(/ü/g,'u').replace(/Ü/g,'u')
    .replace(/ö/g,'o').replace(/Ö/g,'o')
    .replace(/ç/g,'c').replace(/Ç/g,'c');
}

let allData = { cats: [], prods: [] };
let searchText = '';

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}

function formatTRY(val) {
  const n = Number(val || 0);
  try { return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }); }
  catch (e) { return (n + ' ₺'); }
}

/* -----------------------
   BANNER / MODAL (leave design as-is if user already has)
------------------------*/

function ensureModalRoot() {
  let root = document.getElementById('product-modal-root');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'product-modal-root';
  Object.assign(root.style, {
    position: 'fixed', inset: '0', display: 'none',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,.55)', zIndex: '9999'
  });
  document.body.appendChild(root);

  // close when clicking the dimmed backdrop (but not when clicking modal content)
  root.addEventListener('click', (e) => {
    if (e.target === root) closeModal();
  });

  // ensure Escape key closes modal (only add once)
  if (!window.__bila_modal_escape_added) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') closeModal();
    });
    window.__bila_modal_escape_added = true;
  }

  return root;
}



function openModal(content, product) {
  // If project already defines openModal externally, do not override
  if (window.__customOpenModal) return window.__customOpenModal(content, product);

  const root = ensureModalRoot();
  root.innerHTML = '';
  root.style.display = 'flex';

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: 'min(880px,95vw)', maxHeight: '90vh', background: '#f8f8f8',
    borderRadius: '18px', boxShadow: '0 12px 36px rgba(0,0,0,.45)',
    overflow: 'hidden', display: 'flex',
    flexDirection: window.innerWidth < 768 ? 'column' : 'row'
  });

  const left = document.createElement('div');
  left.style.flex = window.innerWidth < 768 ? '0 0 25vh' : '0 0 45%';
  left.style.width = '100%';
  left.style.background = '#fff';
  left.style.overflow = 'hidden';

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = (product && product.image_url) || '';
  Object.assign(img.style, {
    width: '100%', height: '100%', objectFit: 'contain', display: 'block'
  });
  left.appendChild(img);

  const right = document.createElement('div');
  Object.assign(right.style, {
    flex: '1', padding: '20px 22px', color: '#222',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px'
  });
  right.appendChild(content);

  const closeBtn = document.createElement('span');
  Object.assign(closeBtn.style, {
    position: 'absolute', right: '16px', top: '12px', fontSize: '22px',
    cursor: 'pointer', color: '#111', background: 'rgba(255,255,255,0.9)',
    borderRadius: '50%', width: '36px', height: '36px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  });
  closeBtn.textContent = '✖';
  closeBtn.setAttribute('aria-label', 'Kapat');
  // ensure close button is on top of modal content
  closeBtn.style.zIndex = '10001';
  closeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeModal();
  });

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position: 'relative', width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  });

  wrapper.appendChild(card);
  wrapper.appendChild(closeBtn);

  card.appendChild(left);
  card.appendChild(right);
  root.appendChild(wrapper);
}



function closeModal() {
  const root = document.getElementById('product-modal-root');
  if (root) {
    try {
      root.style.display = 'none';
      // remove content to prevent duplicate event targets and free memory
      root.innerHTML = '';
      // optionally remove root from DOM to avoid duplicates on repeated loads
      // keep root for reuse to improve performance
      // if (root.parentElement) root.parentElement.removeChild(root);
    } catch (e) {
      console.error('closeModal error', e);
    }
  }
}


/* -----------------------
   DATA
------------------------*/
async function fetchData() {
  const { data: cats, error: ec } = await supabase.from('categories').select('*').order('id');
  if (ec) { console.error(ec); return; }
  const { data: prods, error: ep } = await supabase.from('products').select('*, categories(name)').order('id');
  if (ep) { console.error(ep); return; }
  allData = { cats: cats || [], prods: prods || [] };
  renderAll();
  // show warning if no categories fetched
  if(allData.cats.length === 0){
    const cont = document.querySelector('#dynamic-content') || document.body;
    const msg = document.createElement('div');
    msg.style.color='red'; msg.style.padding='12px'; msg.textContent = 'UYARI: Kategoriler gelmedi veya boş. Supabase bağlantısını kontrol et.';
    cont.prepend(msg);
  }

}

function matchesSearch(p) {
  if (!searchText) return true;
  const s = normalizeText(searchText);
  return [p.name, p.subtitle, p.description].some(x => normalizeText(x).includes(s));
}

/* -----------------------
   RENDER
------------------------*/
function renderAll() {
  const container = document.getElementById('dynamic-content') || document.body;
  container.innerHTML = '';

  for (const cat of allData.cats) {
    const catDiv = el('div', { class: 'kategori' });

    const okSpan = el('span', { class: 'ok' }, '▼');
    okSpan.style.marginLeft = '8px';

    const head = el('div', { class: 'kategori-header' }, [cat.name, okSpan]);
    head.style.cursor = 'pointer';

    const grid = el('div', { class: 'urunler' });
    grid.style.display = 'none'; // CLOSED ON LOAD

    head.addEventListener('click', () => {
      grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
    });

    const items = allData.prods.filter(p => p.category_id === cat.id && matchesSearch(p));

    
    // --- Auto-open category if searching & there are matches ---
    if (typeof searchText === 'string' && searchText.trim() !== '' && items.length > 0) {
      grid.style.display = 'grid';
      try { okSpan.classList.add('don'); } catch(e){}
    } else {
      // keep default closed state when no search or no matches
      // grid.style.display stays 'none'
    }
// Arrow color by availability
    okSpan.style.color = items.length > 0 ? '#2e7d32' : '#c62828';

    if (items.length === 0) {
      grid.appendChild(el('div', { class: 'urun', style: 'opacity:.7;padding:8px' }, ['Ürün yok']));
    } else {
      for (const p of items) {
        grid.appendChild(el('div', { class: 'urun', onclick: () => showProduct(p) }, [
          el('img', { src: p.image_url || '', alt: p.name, loading: 'lazy' }),
          el('p', {}, p.name),
          el('p', { style: 'font-size:13px;color:#555;' }, p.subtitle || ''),
          el('p', { style: 'font-weight:600;color:#2e7d32;' }, formatTRY(p.price))
        ]));
      }
    }

    catDiv.appendChild(head);
    catDiv.appendChild(grid);
    container.appendChild(catDiv);
  }
}

function showProduct(p) {
  const content = document.createElement('div');
  content.innerHTML = `
    <h2 style="margin-bottom:4px;font-size:22px">${p.name}</h2>
    <h4 style="color:#555;margin-top:0;font-size:15px">${p.subtitle || ''}</h4>
    <p style="font-size:14px;line-height:1.5;margin-top:10px;white-space:normal">${((p.description||'').replace(/\r?\n/g,'<br>'))}</p>
    <p style="font-weight:700;font-size:18px;margin-top:10px;color:#2e7d32">${formatTRY(p.price)}</p>
  `;
  openModal(content, p);
}

/* -----------------------
   SEARCH: force single input
------------------------*/
function ensureSingleSearch() {
  // Try to find an existing search input
  let input = document.getElementById('search');
  if (!input) {
    // Fallback: any input whose placeholder includes 'ara'
    input = Array.from(document.querySelectorAll('input')).find(i => (i.placeholder || '').toLowerCase().includes('ara'));
  }

  // If still not found, create one above dynamic-content
  if (!input) {
    const host = document.getElementById('dynamic-content') || document.body;
    const bar = document.createElement('div');
    bar.style.textAlign = 'center';
    bar.style.margin = '20px 0';
    const inp = document.createElement('input');
    inp.id = 'search';
    inp.type = 'text';
    inp.placeholder = 'Ürün veya kategori ara...';
    inp.style.cssText = 'width:80%;max-width:420px;padding:10px 14px;border:1px solid #ccc;border-radius:10px;font-size:15px;outline:none;box-shadow:0 2px 6px rgba(0,0,0,0.1);';
    bar.appendChild(inp);
    host.parentElement.insertBefore(bar, host);
    input = inp;
  }

  // Remove duplicates (keep the first one we selected)
  const allInputs = Array.from(document.querySelectorAll('input'));
  for (const i of allInputs) {
    if (i === input) continue;
    const looksLikeSearch = (i.id === 'search') || (i.type === 'search') || ((i.placeholder || '').toLowerCase().includes('ara'));
    if (looksLikeSearch) {
      i.closest('div') ? i.closest('div').remove() : i.remove();
    }
  }

  // Bind handler
  input.addEventListener('input', (e) => {
    searchText = (e.target.value || '').trim();
    renderAll();
  // show warning if no categories fetched
  if(allData.cats.length === 0){
    const cont = document.querySelector('#dynamic-content') || document.body;
    const msg = document.createElement('div');
    msg.style.color='red'; msg.style.padding='12px'; msg.textContent = 'UYARI: Kategoriler gelmedi veya boş. Supabase bağlantısını kontrol et.';
    cont.prepend(msg);
  }

  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchData();
  ensureSingleSearch();
});
