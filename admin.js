// --- Session-based login guard ---
(function(){
  try{
    if (sessionStorage.getItem('auth') !== '1'){
      window.location.href = 'login.html';
    }
  }catch(e){ console.warn('Login guard error', e); }
})();

// --- Lightweight admin access gate (frontend-only) ---


import { supabase } from './supabase.js';

// --- UI helpers ---
const $ = (sel) => document.querySelector(sel);
const tbodyProducts = $('#products-tbody');
const tbodyCategories = $('#categories-tbody');
const statusPill = $('#status');

let editingProductId = null;
let editingCategoryId = null;

export const AdminUI = {
  showTab(tab){
    $('#tab-products').style.display = (tab==='products'?'block':'none');
    $('#tab-categories').style.display = (tab==='categories'?'block':'none');
  }
};
window.AdminUI = AdminUI;

// --- Data helpers ---
async function fetchCategories(){
  const { data, error } = await supabase.from('categories').select('*').order('id', { ascending:true });
  if(error){ console.error(error); alert('Kategori listesi alınamadı: '+error.message); return []; }
  return data || [];
}
async function fetchProducts(){
  const { data, error } = await supabase.from('products').select('id,name,subtitle,price,description,image_url,category_id, categories!inner(name)').order('id',{ascending:true});
  if(error){ console.error(error); alert('Ürün listesi alınamadı: '+error.message); return []; }
  return data || [];
}

// --- Init ---
async function init(){
  statusPill.textContent = 'Bağlandı';
  await loadCategoriesToSelect();
  await repaintCategories();
    await repaintProducts();
  await repaintProducts();

  // Tab default
  AdminUI.showTab('products');

  // file -> base64 preview handler
  const fileInput = document.getElementById('p-image-file');
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if(!f) return;
    const b64 = await fileToBase64(f);
    document.getElementById('p-image-url').value = b64; // store as data URL
  });
}
document.addEventListener('DOMContentLoaded', init);

// --- Rendering ---
async function loadCategoriesToSelect(){
  const select = document.getElementById('p-category');
  select.innerHTML = '';
  const cats = await fetchCategories();
  for(const c of cats){
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  }
}

async function repaintCategories(){
  const cats = await fetchCategories();
  tbodyCategories.innerHTML = '';
  for(const c of cats){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.name}</td>
      <td>
        <button class="btn muted" data-id="${c.id}" data-name="${c.name}" data-action="edit-cat">Düzenle</button>
        <button class="btn danger" data-id="${c.id}" data-action="del-cat">Sil</button>
      </td>`;
    tbodyCategories.appendChild(tr);
  }
}

async function repaintProducts(){
  const { data, error } = await supabase.from('products')
    .select('id,name,subtitle,price,category_id, description, image_url, categories(name)')
    .order('id', { ascending:true });
  if(error){ console.error(error); alert('Ürün listesi alınamadı: '+error.message); return; }
  tbodyProducts.innerHTML = '';
  for(const p of data){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.categories?.name ?? '-'}</td>
      <td>${Number(p.price ?? 0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'})}</td>
      <td>
        <button class="btn muted" data-id="${p.id}" data-action="edit-prod">Düzenle</button>
        <button class="btn danger" data-id="${p.id}" data-action="del-prod">Sil</button>
      </td>`;
    tbodyProducts.appendChild(tr);
  }
}

// --- Actions ---
function sanitizeText(s){
  if(!s) return '';
  return String(s).replace(/[\u0000-\u001F<>`]/g,'').trim();
}

export const AdminActions = {
  async saveCategory(){
    const name = $('#c-name').value.trim();
    if(!name){ alert('Kategori adı gerekli'); return; }

    if(editingCategoryId){
      const { error } = await supabase.from('categories').update({ name }).eq('id', editingCategoryId);
      if(error){ alert('Kategori güncellenemedi: '+error.message); return; }
    }else{
      const { error } = await supabase.from('categories').insert({ name });
      if(error){ alert('Kategori eklenemedi: '+error.message); return; }
    }
    editingCategoryId = null;
    $('#c-name').value='';
    await loadCategoriesToSelect();
    await repaintCategories();
    await repaintProducts();
  },

  resetCategoryForm(){
    editingCategoryId = null;
    $('#c-name').value='';
  },

  async saveProduct(){
    const name = $('#p-name').value.trim();
    const subtitle = $('#p-subtitle').value.trim();
    const price = parseFloat($('#p-price').value || '0');
    const category_id = parseInt($('#p-category').value || '0', 10);
    const description = $('#p-desc').value.trim();
    const image_url = $('#p-image-url').value.trim();

    if(!name){ alert('Ürün adı gerekli'); return; }
    if(!category_id){ alert('Kategori seçin'); return; }

    const payload = { name, subtitle, price, category_id, description, image_url };

    if(editingProductId){
      const { error } = await supabase.from('products').update(payload).eq('id', editingProductId);
      if(error){ alert('Ürün güncellenemedi: '+error.message); return; }
    }else{
      const { error } = await supabase.from('products').insert(payload);
      if(error){ alert('Ürün eklenemedi: '+error.message); return; }
    }

    editingProductId = null;
    AdminActions.resetProductForm();
    await repaintProducts();
  },

  resetProductForm(){
    $('#p-name').value='';
    $('#p-subtitle').value='';
    $('#p-price').value='';
    $('#p-desc').value='';
    $('#p-image-url').value='';
    $('#p-image-file').value='';
  }
};
window.AdminActions = AdminActions;

// Delegated click handlers
tbodyCategories.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const action = btn.dataset.action; const id = parseInt(btn.dataset.id,10);
  if(action==='del-cat'){
    if(!confirm('Bu kategoriyi silmek istiyor musunuz?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if(error){ alert('Kategori silinemedi: '+error.message); return; }
    await loadCategoriesToSelect();
    await repaintCategories();
    await repaintProducts();
  }
  if(action==='edit-cat'){
    editingCategoryId = id;
    $('#c-name').value = btn.dataset.name || '';
  }
});

tbodyProducts.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const action = btn.dataset.action; const id = parseInt(btn.dataset.id,10);
  if(action==='del-prod'){
    if(!confirm('Bu ürünü silmek istiyor musunuz?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if(error){ alert('Ürün silinemedi: '+error.message); return; }
    await repaintProducts();
  }
  if(action==='edit-prod'){
    editingProductId = id;
    // fetch and fill
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if(error){ alert('Ürün getirilemedi: '+error.message); return; }
    document.getElementById('p-name').value = data.name || '';
    document.getElementById('p-subtitle').value = data.subtitle || '';
    document.getElementById('p-price').value = data.price ?? '';
    document.getElementById('p-desc').value = data.description || '';
    document.getElementById('p-image-url').value = data.image_url || '';
    document.getElementById('p-category').value = data.category_id || '';
    window.scrollTo({top:0, behavior:'smooth'});
  }
});

// Utils
function fileToBase64(file){
  return new Promise((res, rej)=>{
    const reader = new FileReader();
    reader.onload = ()=> res(reader.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
