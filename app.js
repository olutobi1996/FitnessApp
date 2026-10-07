/* ============================================================
   PT YOUR WAY — shared UI components
   ============================================================ */

const FAV_KEY = 'ptyw:favourites';
function loadFavs(){ try{ return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }catch(e){ return new Set(); } }
function saveFavs(){ try{ localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites])); }catch(e){} }
// escape anything a user typed before it goes into HTML (stops script injection)
function esc(v){ return v == null ? '' : String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// guarantees name + role exist, so a slow/failed profile fetch can't crash the app
function normUser(u){
  if(!u) return null;
  return { ...u, name: (u.name || '').trim() || (u.email || 'Member').split('@')[0], role: u.role || 'client' };
}
function toast(msg){
  let t = document.getElementById('toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3400);
}
function requestContact(kind){
  if(!state.currentUser){ navigateTo('#/login'); return; }
  toast(kind === 'book' ? "Bookings open soon, we'll let you know the moment they do." : "Messaging opens soon, hang tight.");
}

const state = {
  favorites: loadFavs(),
  role: null, // 'client' | 'pt' | 'admin'
  currentUser: null, // set on load from AUTH.getSession()
};

/* ============================================================
   SUPABASE — real backend (auth + database)
   Fill these in from your Supabase project: Settings → API
   ============================================================ */

const SUPABASE_URL = "https://ifxkdihhjzuulysbwchk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rEK56aZHSZ6rJ2x6UnyMkQ_FLZunsQu";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   AUTH — backed by Supabase Auth + a "profiles" table
   Real accounts, hashed passwords, real sessions — Supabase
   handles all of that. We just store name/role/specialism in
   a "profiles" row linked to each auth user (see supabase-schema.sql).
   ============================================================ */

const AUTH = {
  // returns { ok:true, user } or { ok:false, error }
  async signup({ name, email, password, role, specialism }){
    email = (email || "").trim().toLowerCase();
    if(!name || !email || !password) return { ok:false, error:"Please fill in all fields." };
    if(password.length < 6) return { ok:false, error:"Password must be at least 6 characters." };

    // name/role/specialism go in user metadata — the database trigger
    // (supabase-signup-trigger.sql) reads these to build the profile row,
    // which works even before the person has confirmed their email.
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name, role, specialism: specialism || '' },
        emailRedirectTo: window.location.origin + window.location.pathname + '#/welcome',
      }
    });
    if(error) return { ok:false, error: error.message };

    const userId = data.user && data.user.id;
    if(!userId) return { ok:false, error:"Something went wrong creating your account. Please try again." };

    // No session means email confirmation is switched on — they need to
    // click the link in their inbox before they can log in.
    if(!data.session){
      return { ok:true, needsConfirmation:true, email };
    }

    const profile = await this.fetchProfile(userId);
    return { ok:true, user: { id: userId, email, name, role, specialism: specialism || null, ...profile } };
  },

  // returns { ok:true, user } or { ok:false, error }
  async login({ email, password }){
    email = (email || "").trim().toLowerCase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if(error) return { ok:false, error:"Incorrect email or password." };

    const profile = await this.fetchProfile(data.user.id);
    return { ok:true, user: { id: data.user.id, email: data.user.email, ...profile } };
  },

  async logout(){
    await sb.auth.signOut();
  },

  async fetchProfile(userId){
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if(error) return {};
    return data;
  },

  // called on page load to restore an existing session, if any
  async getSession(){
    const { data: { session } } = await sb.auth.getSession();
    if(!session) return null;
    const profile = await this.fetchProfile(session.user.id);
    return { id: session.user.id, email: session.user.email, ...profile };
  },

  // save edits from the profile page back to the profiles table
  async updateProfile(userId, fields){
    const payload = { ...fields, updated_at: new Date().toISOString() };
    const { error } = await sb.from('profiles').update(payload).eq('id', userId);
    if(error) return { ok:false, error: error.message };
    return { ok:true };
  },

  // upload a profile picture to the "avatars" storage bucket
  async uploadAvatar(userId, file){
    if(!file) return { ok:false, error:"No file selected." };
    if(!file.type.startsWith('image/')) return { ok:false, error:"Please choose an image file." };
    if(file.size > 5 * 1024 * 1024) return { ok:false, error:"Image must be under 5MB." };

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    // stored under the user's own id folder — the storage policy requires this
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await sb.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' });
    if(uploadError) return { ok:false, error: uploadError.message };

    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    // cache-bust so a replaced picture shows immediately
    const photoUrl = `${data.publicUrl}?t=${Date.now()}`;

    const saved = await this.updateProfile(userId, { photo_url: photoUrl });
    if(!saved.ok) return saved;

    return { ok:true, photoUrl };
  },
};

function icon(name){
  const icons = {
    search:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    heart:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    heartFill:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    star:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    check:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    shield:'<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/></svg>',
    map:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z"/></svg>',
    location:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    arrow:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    menu:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    close:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    camera:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h3.5L8 5.5h8L17.5 8H21v12H3z"/><circle cx="12" cy="13.5" r="3.6"/></svg>',
    mail:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    edit:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    chat:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.6A7.9 7.9 0 0 1 21 12z"/></svg>',
    users:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 12.2A5.5 5.5 0 0 1 21.5 17"/></svg>',
    target:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
    dumbbell:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="9" width="3.4" height="6" rx="1"/><rect x="19.6" y="9" width="3.4" height="6" rx="1"/><rect x="5" y="10.3" width="3" height="3.4" rx="0.6"/><rect x="16" y="10.3" width="3" height="3.4" rx="0.6"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    flexible:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    trending:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14.5 7 21 7 21 13.5"/></svg>',
    heartOutlineLg:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  };
  return icons[name] || '';
}

function starRow(rating, reviews){
  if(rating == null) return `<span class="rating new-pt">New coach</span>`;
  return `<span class="rating"><span class="star">${icon('star')}</span> ${rating.toFixed(1)} <span class="count">(${reviews})</span></span>`;
}

function renderNav(active){
  const links = [
    ["#/search","Find a PT"], ["#/how-it-works","How It Works"],
    ["#/for-pts","For PTs"], ["#/about","About"]
  ];
  const user = state.currentUser;
  const authActions = user
    ? `
      <a href="${user.role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard'}" class="btn btn-outline nav-account">
        <span class="nav-account-avatar">${esc(user.name.trim().charAt(0).toUpperCase())}</span>
        ${esc(user.name.split(' ')[0])}
      </a>
      <button class="btn btn-primary" onclick="handleLogout()">Log out</button>`
    : `
      <a href="#/login" class="btn btn-outline">Log in</a>
      <a href="#/signup" class="btn btn-primary">Sign up</a>`;
  return `
  <header class="topnav">
    <div class="wrap topnav-inner">
      <a href="#/" class="logo">
        <img src="assets/ptyw-logo.png" alt="PT Your Way" class="logo-img">
      </a>
      <nav class="nav-links">
        ${links.map(([href,label]) => `<a href="${href}" class="${active===label?'active':''}">${label}</a>`).join('')}
      </nav>
      <div class="nav-actions">
        ${authActions}
        <button class="nav-mobile-toggle" aria-label="Open menu" aria-expanded="false" onclick="toggleMobileMenu()">${icon('menu')}</button>
      </div>
    </div>
  </header>
  ${renderMobileMenu(active)}`;
}

/* ---------- mobile burger menu ----------
   Links change depending on whether someone is logged in, and whether
   they're a client or a PT — so the menu always mirrors the top nav. */

function renderMobileMenu(active){
  const user = state.currentUser;

  // Links everyone sees, logged in or not
  const publicLinks = [
    ["#/","Home"], ["#/search","Find a PT"], ["#/how-it-works","How It Works"],
    ["#/for-pts","For PTs"], ["#/about","About"]
  ];

  // Account links depend on who (if anyone) is logged in
  const accountLinks = !user
    ? [["#/login","Log in"], ["#/signup","Sign up as a client"], ["#/signup-pt","Sign up as a PT"]]
    : user.role === 'pt'
      ? [["#/pt-dashboard","Dashboard"], ["#/profile","My profile"]]
      : [["#/client-dashboard","Dashboard"], ["#/profile","My profile"], ["#/search","Find a PT"]];

  return `
  <div class="mobile-menu" id="mobile-menu" hidden>
    <div class="mobile-menu-backdrop" onclick="closeMobileMenu()"></div>
    <nav class="mobile-menu-panel" aria-label="Mobile menu">
      <div class="mobile-menu-head">
        <span class="mobile-menu-title">Menu</span>
        <button class="mobile-menu-close" aria-label="Close menu" onclick="closeMobileMenu()">${icon('close')}</button>
      </div>

      ${user ? `
        <div class="mobile-menu-user">
          <span class="mobile-menu-avatar">${esc(user.name.trim().charAt(0).toUpperCase())}</span>
          <div>
            <div class="mobile-menu-name">${esc(user.name)}</div>
            <div class="mobile-menu-role">${user.role === 'pt' ? 'Personal trainer' : 'Client'}</div>
          </div>
        </div>` : ''}

      <div class="mobile-menu-group">
        ${publicLinks.map(([href,label]) =>
          `<a href="${href}" class="${active===label?'active':''}" onclick="closeMobileMenu()">${label}</a>`
        ).join('')}
      </div>

      <div class="mobile-menu-group mobile-menu-group-account">
        <span class="mobile-menu-label">${user ? 'Your account' : 'Get started'}</span>
        ${accountLinks.map(([href,label]) =>
          `<a href="${href}" onclick="closeMobileMenu()">${label}</a>`
        ).join('')}
      </div>

      <div class="mobile-menu-foot">
        ${user
          ? `<button class="btn btn-outline btn-block" onclick="closeMobileMenu(); handleLogout();">Log out</button>`
          : `<a href="#/signup" class="btn btn-primary btn-block" onclick="closeMobileMenu()">Sign up free</a>`}
      </div>
    </nav>
  </div>`;
}

function toggleMobileMenu(){
  const menu = document.getElementById('mobile-menu');
  if(!menu) return;
  menu.hidden ? openMobileMenu() : closeMobileMenu();
}

function openMobileMenu(){
  const menu = document.getElementById('mobile-menu');
  if(!menu) return;
  menu.hidden = false;
  // next frame, so the CSS transition actually runs
  requestAnimationFrame(() => menu.classList.add('open'));
  document.body.style.overflow = 'hidden'; // stop the page scrolling behind the menu
  const toggle = document.querySelector('.nav-mobile-toggle');
  if(toggle) toggle.setAttribute('aria-expanded','true');
}

function closeMobileMenu(){
  const menu = document.getElementById('mobile-menu');
  if(!menu) return;
  menu.classList.remove('open');
  document.body.style.overflow = '';
  const toggle = document.querySelector('.nav-mobile-toggle');
  if(toggle) toggle.setAttribute('aria-expanded','false');
  setTimeout(() => { if(!menu.classList.contains('open')) menu.hidden = true; }, 250);
}

// Esc closes the menu
window.addEventListener('keydown', e => { if(e.key === 'Escape') closeMobileMenu(); });

async function handleLogout(){
  await AUTH.logout();
  state.currentUser = null;
  navigateTo('#/');
  render();
}

function renderValueStrip(){
  const items = [
    { icon:"dumbbell", title:"Personalised", text:"Training plans tailored to your goals, lifestyle and experience." },
    { icon:"flexible", title:"Flexible", text:"Train in the way that works for you. In the gym, at home or on the go." },
    { icon:"trending", title:"Results Driven", text:"Sustainable habits and progress that last beyond the gym." },
    { icon:"heartOutlineLg", title:"Supportive", text:"Ongoing support, guidance and motivation every step of the way." },
  ];
  return `
  <section class="value-strip">
    <div class="wrap value-grid">
      ${items.map(i => `
        <div class="value-item">
          <span class="value-icon" aria-hidden="true">${icon(i.icon)}</span>
          <h4>${i.title}</h4>
          <p>${i.text}</p>
        </div>`).join('')}
    </div>
  </section>`;
}

function renderFooter(){
  return `
  <footer class="footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <div class="logo mb-16"><img src="assets/ptyw-logo.png" alt="PT Your Way" class="logo-img"></div>
          <p class="muted small" style="max-width:260px;">Find the right personal trainer for your goals, your lifestyle, your way. Vetted coaches, online or in person.</p>
        </div>
        <div>
          <h5>Clients</h5>
          <ul>
            <li><a href="#/search">Find a PT</a></li>
            <li><a href="#/how-it-works">How it works</a></li>
            <li><a href="#/signup">Create account</a></li>
          </ul>
        </div>
        <div>
          <h5>Trainers</h5>
          <ul>
            <li><a href="#/for-pts">Join as a PT</a></li>
            <li><a href="#/for-pts">Pricing</a></li>
            <li><a href="#/pt-dashboard">PT dashboard</a></li>
          </ul>
        </div>
        <div>
          <h5>Company</h5>
          <ul>
            <li><a href="#/about">About</a></li>
            <li><a href="#/">Careers</a></li>
            <li><a href="#/">Contact</a></li>
          </ul>
        </div>
        <div>
          <h5>Legal</h5>
          <ul>
            <li><a href="#/">Terms</a></li>
            <li><a href="#/">Privacy</a></li>
            <li><a href="#/">Safety</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 PT Your Way. All rights reserved.</span>
        <span>Made for people who train their way.</span>
      </div>
    </div>
  </footer>`;
}

function trainerCard(t){
  const isFav = state.favorites.has(t.id);
  const hasPrice = t.price != null && t.price !== '';
  return `
  <article class="tcard" onclick="if(!event.target.closest('.tcard-fav')) navigateTo('#/trainer/${esc(t.id)}')">
    <div class="tcard-photo">
      ${t.photo ? `<img src="${esc(t.photo)}" alt="${esc(t.name)}" loading="lazy">` : `<div class="tcard-ph">${esc(t.name.trim().charAt(0).toUpperCase())}</div>`}
      <button class="tcard-fav ${isFav?'active':''}" onclick="event.stopPropagation(); toggleFavorite('${esc(t.id)}')" aria-label="${isFav ? 'Remove from saved' : 'Save trainer'}">
        ${isFav ? icon('heartFill') : icon('heart')}
      </button>
      ${t.verified ? `<span class="tcard-verified">${icon('shield')} Verified</span>` : ''}
    </div>
    <div class="tcard-body">
      <div class="tcard-name">${esc(t.name)}</div>
      <div class="tcard-spec">${esc(t.specialism)}</div>
      <div class="tcard-badges">
        <span class="badge online">${t.online ? 'Online' : 'In Person'}</span>
        <span class="badge">${esc(t.city || t.tags[0])}</span>
      </div>
      <div class="tcard-foot">
        ${starRow(t.rating, t.reviews)}
        <span class="price">${hasPrice ? `£${esc(t.price)} <small>/ session</small>` : '<small>Rates on request</small>'}</span>
      </div>
    </div>
  </article>`;
}

function toggleFavorite(id){
  if(state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavs();
  render();
}

function navigateTo(hash){
  window.location.hash = hash;
  window.scrollTo({top:0, behavior:'instant'});
}

/* ============================================================
   DATA
   ============================================================ */

const TRAINERS = [
  { id:"emily-carter",  name:"Emily Carter",  specialism:"Body Recomposition Coach", tags:["Body Recomp"], online:true, verified:false, rating:5.0, reviews:28, price:60,
    photo:"https://images.unsplash.com/photo-1518310383802-640c2de311b6?auto=format&fit=crop&w=600&q=80" },
  { id:"james-wilson",  name:"James Wilson",  specialism:"Strength & Performance Coach", tags:["Strength"], online:true, verified:false, rating:4.9, reviews:34, price:55,
    photo:"https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80" },
  { id:"sophie-moore",  name:"Sophie Moore",  specialism:"Women's Fat Loss Coach", tags:["Fat Loss"], online:true, verified:true, rating:5.0, reviews:41, price:50,
    photo:"https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=600&q=80" },
  { id:"daniel-hughes", name:"Daniel Hughes", specialism:"Hyrox & Conditioning Coach", tags:["Hyrox"], online:true, verified:false, rating:4.9, reviews:20, price:55,
    photo:"https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=600&q=80" },
  { id:"laura-bennett", name:"Laura Bennett", specialism:"Postnatal Fitness Specialist", tags:["Postnatal"], online:true, verified:false, rating:5.0, reviews:22, price:50,
    photo:"https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=600&q=80" },
  { id:"alex-thompson", name:"Alex Thompson", specialism:"Muscle Building Coach", tags:["Muscle Gain"], online:true, verified:false, rating:4.8, reviews:31, price:60,
    photo:"https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=80" },
  { id:"chloe-adams",   name:"Chloe Adams",   specialism:"PCOS & Hormone Health Coach", tags:["PCOS"], online:true, verified:true, rating:5.0, reviews:19, price:50,
    photo:"https://images.unsplash.com/photo-1550345332-09e3ac987658?auto=format&fit=crop&w=600&q=80" },
  { id:"hannah-lewis",  name:"Hannah Lewis",  specialism:"Endurance & Running Coach", tags:["Running"], online:true, verified:false, rating:4.9, reviews:27, price:55,
    photo:"https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80" },
];

const SPECIALISMS = [
  "Fat Loss","Muscle Gain","Body Recomposition","Hyrox","Marathon Running","Strength Training",
  "Women's Fitness","Men's Fitness","PCOS","Endometriosis","Menopause","Pre & Post Natal",
  "Beginners","Seniors","Nutrition Coaching","Online","In Person"
];

/* ============================================================
   PAGE: HOME
   ============================================================ */

/* Real trainers come from the public_trainers view (see supabase-public-trainers.sql).
   Set SHOW_DEMO_TRAINERS to false on launch day to remove the fake coaches. */
const SHOW_DEMO_TRAINERS = true;
let ALL_TRAINERS = SHOW_DEMO_TRAINERS ? [...TRAINERS] : [];

async function loadTrainers(){
  try{
    const { data, error } = await sb.from('public_trainers').select('*');
    if(error || !data) return;
    const real = data.filter(p => p.name).map(p => ({
      id:p.id, name:p.name, specialism:p.specialism || 'Personal Trainer', tags:[p.specialism || 'Personal Training'],
      online:true, verified:false, rating:null, reviews:0, price:p.price, city:p.city, bio:p.bio, photo:p.photo_url || '',
    }));
    ALL_TRAINERS = [...real, ...(SHOW_DEMO_TRAINERS ? TRAINERS : [])];
  }catch(e){ /* offline or view not created yet: demo coaches still show */ }
}

const BUDGETS = { 'Up to £40':[0,40], '£40 – £60':[40,60], '£60 – £80':[60,80], '£80+':[80,Infinity] };

// builds the #/search?... url from either the home search bar or the search page filters
function runSearch(f, fromHome){
  const g = n => f[n] ? f[n].value.trim() : '';
  const p = new URLSearchParams();
  [['q', g('q')], ['spec', g('spec') || g('goal')], ['budget', g('budget')], ['sort', g('sort') === 'rating' ? '' : g('sort')]]
    .forEach(([k,v]) => { if(v) p.set(k, v); });
  const h = '#/search' + (p.toString() ? '?' + p.toString() : '');
  if(fromHome){ navigateTo(h); return; }
  history.replaceState(null, '', h);
  render();
}

function renderSearch(params){
  const q = params.get('q') || '', spec = params.get('spec') || '', budget = params.get('budget') || '', sort = params.get('sort') || 'rating';
  const [lo, hi] = BUDGETS[budget] || [0, Infinity];
  const words = spec.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3);
  const num = x => (x == null || x === '') ? null : Number(x);
  const list = ALL_TRAINERS.filter(t => {
    const hay = [t.name, t.specialism, ...t.tags, t.city || '', t.online ? 'online' : 'in person'].join(' ').toLowerCase();
    if(q && !hay.includes(q.toLowerCase())) return false;
    if(words.length && !words.some(w => hay.includes(w))) return false;
    if(budget){ const p = num(t.price); if(p == null || p < lo || p > hi) return false; }
    return true;
  }).sort((a,b) => sort === 'low' ? (num(a.price) ?? 1e9) - (num(b.price) ?? 1e9)
                 : sort === 'high' ? (num(b.price) ?? -1) - (num(a.price) ?? -1)
                 : (b.rating ?? -1) - (a.rating ?? -1));
  const filtered = q || spec || budget;
  return `
  ${renderNav("Find a PT")}
  <section class="sp">
    <div class="wrap">
      <div class="sp-head">
        <span class="eyebrow">Find your coach</span>
        <h1>Personal trainers</h1>
      </div>
      <form class="sp-filters" onsubmit="event.preventDefault(); runSearch(this)">
        <label class="search-field sp-q"><span class="field-icon">${icon('search')}</span>
          <input type="search" name="q" value="${esc(q)}" placeholder="Search by name, goal or city" aria-label="Search"></label>
        <label class="form-field"><span>Specialism</span>
          <select name="spec" onchange="runSearch(this.form)"><option value="">All specialisms</option>
          ${SPECIALISMS.map(s => `<option ${spec===s?'selected':''}>${s}</option>`).join('')}</select></label>
        <label class="form-field"><span>Budget</span>
          <select name="budget" onchange="runSearch(this.form)"><option value="">Any budget</option>
          ${Object.keys(BUDGETS).map(b => `<option ${budget===b?'selected':''}>${b}</option>`).join('')}</select></label>
        <label class="form-field"><span>Sort by</span>
          <select name="sort" onchange="runSearch(this.form)">
            <option value="rating" ${sort==='rating'?'selected':''}>Top rated</option>
            <option value="low" ${sort==='low'?'selected':''}>Price: low to high</option>
            <option value="high" ${sort==='high'?'selected':''}>Price: high to low</option></select></label>
        <button type="submit" class="btn btn-primary">Search</button>
      </form>
      <div class="sp-count"><strong>${list.length}</strong> coach${list.length === 1 ? '' : 'es'} found
        ${filtered ? `<a href="#/search" class="inline-link">Clear filters</a>` : ''}</div>
      ${list.length ? `<div class="tgrid">${list.map(trainerCard).join('')}</div>` : `
        <div class="dash-empty"><p class="muted">No coaches match those filters yet. Try a different specialism or a wider budget.</p>
        <a href="#/search" class="btn btn-primary">Show all coaches</a></div>`}
    </div>
  </section>
  ${renderFooter()}`;
}

function renderHome(){
  return `
  ${renderNav("")}

  <section class="hero">
    <div class="hero-media">
      <video
        src="assets/headervid.mp4"
        poster="assets/hero-poster.jpg"
        autoplay muted loop playsinline
        preload="auto"
        aria-hidden="true"></video>
    </div>
    <div class="wrap hero-inner">
      <span class="hero-eyebrow">Personal training, on your terms</span>
      <h1>PT<span class="accent">YOUR WAY</span></h1>
      <p>Find the right coach for your goals, your lifestyle, your way.</p>
    </div>
  </section>

  <div class="wrap search-card">
    <form class="search-bar" onsubmit="event.preventDefault(); runSearch(this, true);">
      <label class="search-field">
        <span class="field-icon">${icon('search')}</span>
        <input type="text" name="q" placeholder="What are you looking for?" aria-label="Search coaches">
      </label>
      <div class="search-filters-row">
        <label class="search-field divider">
          <select name="goal" aria-label="Goal"><option value="">Goal</option>${SPECIALISMS.slice(0,8).map(s=>`<option>${s}</option>`).join('')}</select>
        </label>
        <label class="search-field divider">
          <select name="spec" aria-label="Specialism"><option value="">Specialism</option>${SPECIALISMS.map(s=>`<option>${s}</option>`).join('')}</select>
        </label>
        <label class="search-field divider">
          <select name="budget" aria-label="Budget"><option value="">Budget</option><option>Up to £40</option><option>£40 – £60</option><option>£60 – £80</option><option>£80+</option></select>
        </label>
      </div>
      <button type="submit" class="btn btn-primary">
        <span class="search-submit-icon">${icon('search')}</span>
        <span class="search-submit-text">Search</span>
      </button>
    </form>
  </div>

  ${renderValueStrip()}

  <section class="section-tight">
    <div class="wrap">
      <div class="section-head">
        <div>
          <span class="eyebrow">Find your perfect coach</span>
          <h2>Browse top online personal trainers</h2>
        </div>
        <a href="#/search" class="link-arrow">View all coaches ${icon('arrow')}</a>
      </div>
      <div class="tgrid">
        ${ALL_TRAINERS.slice(0,8).map(trainerCard).join('')}
      </div>
      <div class="view-all-wrap">
        <a href="#/search" class="btn btn-outline btn-lg">View all coaches</a>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="wrap feat-grid">
      <div class="feat">
        <span class="feat-icon">${icon('users')}</span>
        <h4>Qualified & verified</h4>
        <p>All coaches are vetted and verified for your peace of mind.</p>
      </div>
      <div class="feat">
        <span class="feat-icon">${icon('target')}</span>
        <h4>Specialists in you</h4>
        <p>Find a coach who specialises in your goals and needs.</p>
      </div>
      <div class="feat">
        <span class="feat-icon">${icon('chat')}</span>
        <h4>Your way</h4>
        <p>Train online, on your terms, with the right support.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="cta-band">
        <div>
          <h3>Are you a personal trainer? Grow your business with PT Your Way.</h3>
          <p>List your services, reach new clients and manage bookings — all in one place.</p>
        </div>
        <div class="cta-actions">
          <a href="#/for-pts" class="btn btn-outline">Learn more</a>
          <a href="#/signup-pt" class="btn btn-primary">Join as a PT</a>
        </div>
      </div>
    </div>
  </section>

  ${renderFooter()}
  `;
}

/* ============================================================
   PAGE: generic placeholder (for routes not yet built out)
   ============================================================ */

function renderPlaceholder(title, blurb, activeLink){
  return `
  ${renderNav(activeLink || "")}
  <section class="placeholder-page wrap">
    <h2>${title}</h2>
    <p>${blurb}</p>
    <a href="#/" class="btn btn-primary">Back to home</a>
  </section>
  ${renderFooter()}
  `;
}

function renderTrainerProfile(id){
  const t = ALL_TRAINERS.find(x => x.id === id);
  if(!t) return renderPlaceholder("Coach not found", "We couldn't find that trainer profile.", "Find a PT");
  const isFav = state.favorites.has(t.id);
  const hasPrice = t.price != null && t.price !== '';
  return `
  ${renderNav("Find a PT")}
  <section class="tp">
    <div class="wrap">
      <a href="#/search" class="tp-back">← Back to coaches</a>
      <div class="tp-grid">
        <div class="tp-main">
          <div class="profile-card tp-head">
            <div class="tp-photo">${t.photo ? `<img src="${esc(t.photo)}" alt="${esc(t.name)}">` : `<div class="tcard-ph">${esc(t.name.trim().charAt(0).toUpperCase())}</div>`}</div>
            <div>
              <h1>${esc(t.name)}</h1>
              <p class="muted">${esc(t.specialism)}</p>
              <div class="tcard-badges">
                <span class="badge online">${t.online ? 'Online' : 'In Person'}</span>
                ${t.city ? `<span class="badge">${icon('location')} ${esc(t.city)}</span>` : ''}
                ${t.verified ? `<span class="badge online">${icon('shield')} Verified</span>` : ''}
              </div>
              ${starRow(t.rating, t.reviews)}
            </div>
          </div>
          <div class="profile-card">
            <div class="profile-card-head"><h3>About ${esc(t.name.split(' ')[0])}</h3></div>
            <p class="tp-bio">${t.bio ? esc(t.bio) : 'This coach is still completing their profile.'}</p>
          </div>
        </div>
        <aside class="profile-card tp-side">
          <div class="tp-price">${hasPrice ? `£${esc(t.price)} <small>/ session</small>` : 'Rates on request'}</div>
          <button class="btn btn-primary btn-block btn-lg" onclick="requestContact('book')">Book consultation</button>
          <button class="btn btn-outline btn-block" onclick="requestContact('message')">${icon('chat')} Message</button>
          <button class="btn btn-outline btn-block" onclick="toggleFavorite('${esc(t.id)}')">${isFav ? icon('heartFill') + ' Saved' : icon('heart') + ' Save coach'}</button>
        </aside>
      </div>
    </div>
  </section>
  ${renderFooter()}`;
}

/* ============================================================
   PAGE: SIGN UP
   ============================================================ */

function renderSignup(role){
  role = role === 'pt' ? 'pt' : 'client';
  return `
  ${renderNav("")}
  <section class="auth-section">
    <div class="wrap auth-wrap">
      <div class="auth-card">
        <div class="auth-head">
          <h2>Create your account</h2>
          <p class="muted">Join PT Your Way ${role === 'pt' ? 'as a personal trainer' : 'to find your coach'}.</p>
        </div>

        <div class="role-toggle" role="tablist">
          <a href="#/signup" class="role-tab ${role==='client'?'active':''}">I'm a client</a>
          <a href="#/signup-pt" class="role-tab ${role==='pt'?'active':''}">I'm a personal trainer</a>
        </div>

        <form id="signup-form" class="auth-form" onsubmit="handleSignup(event, '${role}')">
          <div id="signup-error" class="form-error" hidden></div>
          <label class="form-field">
            <span>Full name</span>
            <input type="text" name="name" placeholder="Jordan Smith" required>
          </label>
          <label class="form-field">
            <span>Email address</span>
            <input type="email" name="email" placeholder="you@example.com" required>
          </label>
          <label class="form-field">
            <span>Password</span>
            <input type="password" name="password" placeholder="At least 6 characters" minlength="6" required>
          </label>
          ${role === 'pt' ? `
          <label class="form-field">
            <span>Specialism</span>
            <select name="specialism" required>
              <option value="">Select your specialism</option>
              ${SPECIALISMS.map(s => `<option>${s}</option>`).join('')}
            </select>
          </label>` : ''}
          <label class="form-check">
            <input type="checkbox" required>
            <span>I agree to the <a href="#/">Terms</a> and <a href="#/">Privacy Policy</a></span>
          </label>
          <button type="submit" class="btn btn-primary btn-block btn-lg">
            ${role === 'pt' ? 'Create trainer account' : 'Create account'}
          </button>
        </form>

        <p class="auth-switch">Already have an account? <a href="#/login">Log in</a></p>
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

async function handleSignup(event, role){
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account…";

  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    role,
    specialism: form.specialism ? form.specialism.value : "",
  };
  const result = await AUTH.signup(data);

  if(!result.ok){
    const errorBox = document.getElementById('signup-error');
    errorBox.textContent = result.error;
    errorBox.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
    return;
  }
  // Email confirmation is on — tell them to check their inbox
  if(result.needsConfirmation){
    document.getElementById('app').innerHTML = renderCheckInbox(result.email);
    window.scrollTo(0,0);
    return;
  }

  state.currentUser = normUser(result.user);
  navigateTo(role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard');
  render();
}

/* Shown right after signup when the person needs to confirm their email */
function renderCheckInbox(email){
  return `
  ${renderNav("")}
  <section class="auth-section">
    <div class="wrap auth-wrap">
      <div class="auth-card auth-card-center">
        <div class="inbox-icon">${icon('mail')}</div>
        <h2>Check your inbox</h2>
        <p class="muted">We've sent a confirmation link to <strong>${esc(email)}</strong>. Click it to activate your account and get started.</p>
        <div class="inbox-note">
          <p class="muted">Can't find it? Check your spam or junk folder — confirmation emails sometimes land there.</p>
        </div>
        <a href="#/login" class="btn btn-primary btn-block btn-lg">Go to log in</a>
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

/* Where the confirmation link lands them */
function renderWelcome(){
  const user = state.currentUser;
  return `
  ${renderNav("")}
  <section class="auth-section">
    <div class="wrap auth-wrap">
      <div class="auth-card auth-card-center">
        <div class="inbox-icon inbox-icon-success">${icon('check')}</div>
        <h2>Welcome to PT Your Way${user ? ', ' + esc(user.name.split(' ')[0]) : ''}!</h2>
        <p class="muted">Your email is confirmed and your account is ready to go.</p>
        <div class="welcome-steps">
          <div class="welcome-step">
            <span class="welcome-step-num">1</span>
            <div>
              <strong>Complete your profile</strong>
              <p class="muted">Add a photo, bio and your details.</p>
            </div>
          </div>
          <div class="welcome-step">
            <span class="welcome-step-num">2</span>
            <div>
              <strong>${user && user.role === 'pt' ? 'Set your rates' : 'Find your coach'}</strong>
              <p class="muted">${user && user.role === 'pt'
                ? 'Tell clients what you charge and what you specialise in.'
                : 'Browse trainers and save the ones you like.'}</p>
            </div>
          </div>
        </div>
        ${user
          ? `<a href="#/profile" class="btn btn-primary btn-block btn-lg">Complete your profile</a>`
          : `<a href="#/login" class="btn btn-primary btn-block btn-lg">Log in to get started</a>`}
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

/* ============================================================
   PAGE: LOG IN
   ============================================================ */

function renderLogin(){
  return `
  ${renderNav("")}
  <section class="auth-section">
    <div class="wrap auth-wrap">
      <div class="auth-card">
        <div class="auth-head">
          <h2>Welcome back</h2>
          <p class="muted">Log in to your PT Your Way account.</p>
        </div>

        <form id="login-form" class="auth-form" onsubmit="handleLogin(event)">
          <div id="login-error" class="form-error" hidden></div>
          <label class="form-field">
            <span>Email address</span>
            <input type="email" name="email" placeholder="you@example.com" required>
          </label>
          <label class="form-field">
            <span>Password</span>
            <input type="password" name="password" placeholder="Your password" required>
          </label>
          <button type="submit" class="btn btn-primary btn-block btn-lg">Log in</button>
        </form>

        <p class="auth-switch">New to PT Your Way? <a href="#/signup">Sign up as a client</a> · <a href="#/signup-pt">Sign up as a PT</a></p>
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

async function handleLogin(event){
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in…";

  const result = await AUTH.login({ email: form.email.value, password: form.password.value });

  if(!result.ok){
    const errorBox = document.getElementById('login-error');
    errorBox.textContent = result.error;
    errorBox.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
    return;
  }
  state.currentUser = normUser(result.user);
  navigateTo(result.user.role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard');
  render();
}

/* ============================================================
   PAGE: CLIENT DASHBOARD
   ============================================================ */

function renderClientDashboard(){
  const user = state.currentUser;
  const favTrainers = ALL_TRAINERS.filter(t => state.favorites.has(t.id));
  return `
  ${renderNav("")}
  <section class="dash">
    <div class="wrap dash-wrap">
      ${renderDashSidebar('client')}
      <div class="dash-main">
        <div class="dash-welcome">
          <h2>Welcome back, ${esc(user.name.split(' ')[0])}</h2>
          <p class="muted">Pick up where you left off, or find a new coach. <a href="#/profile" class="inline-link">View your profile</a></p>
        </div>

        <div class="dash-cards">
          <div class="dash-stat">
            <span class="dash-stat-num">${favTrainers.length}</span>
            <span class="dash-stat-label">Saved trainers</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num">0</span>
            <span class="dash-stat-label">Active bookings</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num">0</span>
            <span class="dash-stat-label">Messages</span>
          </div>
        </div>

        <div class="dash-section-head">
          <h3>Your saved trainers</h3>
          <a href="#/search" class="link-arrow">Find more coaches ${icon('arrow')}</a>
        </div>
        ${favTrainers.length ? `
          <div class="tgrid dash-tgrid">
            ${favTrainers.map(trainerCard).join('')}
          </div>` : `
          <div class="dash-empty">
            <p class="muted">You haven't saved any trainers yet. Browse coaches and tap the heart icon to save them here.</p>
            <a href="#/search" class="btn btn-primary">Browse coaches</a>
          </div>`}
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

/* ============================================================
   PAGE: PT DASHBOARD
   ============================================================ */

function renderPTDashboard(){
  const user = state.currentUser;
  return `
  ${renderNav("")}
  <section class="dash">
    <div class="wrap dash-wrap">
      ${renderDashSidebar('pt')}
      <div class="dash-main">
        <div class="dash-welcome">
          <h2>Welcome back, ${esc(user.name.split(' ')[0])}</h2>
          <p class="muted">${esc(user.specialism) || 'Manage your profile and bookings.'}</p>
        </div>

        <div class="dash-cards">
          <div class="dash-stat">
            <span class="dash-stat-num">0</span>
            <span class="dash-stat-label">Active clients</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num">0</span>
            <span class="dash-stat-label">Upcoming sessions</span>
          </div>
          <div class="dash-stat">
            <span class="dash-stat-num">0</span>
            <span class="dash-stat-label">Profile views</span>
          </div>
        </div>

        <div class="dash-section-head">
          <h3>Your profile</h3>
          <a href="#/profile" class="link-arrow">Edit profile ${icon('arrow')}</a>
        </div>
        <div class="dash-empty">
          <p class="muted">Add your photo, bio, rates and contact details so clients can find you and know what you offer.</p>
          <a href="#/profile" class="btn btn-primary">Edit your profile</a>
        </div>
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

/* ============================================================
   PAGE: MY PROFILE  (clients and PTs both use this)
   ============================================================ */

function renderProfile(){
  const user = state.currentUser;
  const isPT = user.role === 'pt';
  const favTrainers = ALL_TRAINERS.filter(t => state.favorites.has(t.id));
  const initial = esc(user.name.trim().charAt(0).toUpperCase());
  const v = esc;

  return `
  ${renderNav("")}
  <section class="dash">
    <div class="wrap dash-wrap">
      ${renderDashSidebar(user.role)}
      <div class="dash-main">

        <!-- profile banner -->
        <div class="profile-banner">
          <div class="profile-banner-bg"></div>
          <div class="profile-banner-body">
            <div class="profile-avatar-wrap">
              <div class="profile-avatar" id="profile-avatar">
                ${user.photo_url
                  ? `<img src="${esc(user.photo_url)}" alt="${esc(user.name)}">`
                  : `<span class="profile-avatar-initial">${initial}</span>`}
              </div>
              <button class="profile-avatar-btn" onclick="document.getElementById('avatar-input').click()" title="Change photo">
                ${icon('camera')}
              </button>
              <input type="file" id="avatar-input" accept="image/*" hidden onchange="handleAvatarUpload(event)">
            </div>
            <div class="profile-banner-text">
              <h2>${esc(user.name)}</h2>
              <div class="profile-meta">
                <span class="profile-role-pill">${isPT ? 'Personal trainer' : 'Client'}</span>
                ${user.specialism ? `<span class="profile-meta-item">${esc(user.specialism)}</span>` : ''}
                ${user.city ? `<span class="profile-meta-item">${icon('location')} ${esc(user.city)}</span>` : ''}
              </div>
            </div>
          </div>
          <div id="avatar-status" class="profile-avatar-status" hidden></div>
        </div>

        <!-- editable details -->
        <form class="profile-form" onsubmit="handleProfileSave(event)">
          <div id="profile-message" class="form-success" hidden></div>

          <div class="profile-card">
            <div class="profile-card-head">
              <h3>Your details</h3>
              <p class="muted">This is how you appear ${isPT ? 'to clients browsing for a coach' : 'to trainers you contact'}.</p>
            </div>
            <div class="profile-grid">
              <label class="form-field">
                <span>Full name</span>
                <input type="text" name="name" value="${v(user.name)}" required>
              </label>
              <label class="form-field">
                <span>Email address</span>
                <input type="email" value="${v(user.email)}" disabled>
                <small class="field-note">Contact support to change your login email</small>
              </label>
              <label class="form-field">
                <span>Phone number</span>
                <input type="tel" name="phone" value="${v(user.phone)}" placeholder="07700 900123">
              </label>
              ${isPT ? `
              <label class="form-field">
                <span>Specialism</span>
                <select name="specialism">
                  <option value="">Select your specialism</option>
                  ${SPECIALISMS.map(s => `<option ${user.specialism===s?'selected':''}>${s}</option>`).join('')}
                </select>
              </label>` : `
              <label class="form-field">
                <span>Main goal</span>
                <input type="text" name="goals" value="${v(user.goals)}" placeholder="e.g. Build strength, lose weight">
              </label>`}
            </div>
          </div>

          <div class="profile-card">
            <div class="profile-card-head">
              <h3>Address</h3>
              <p class="muted">Used to match you with ${isPT ? 'clients' : 'trainers'} nearby. Only your city is shown publicly.</p>
            </div>
            <div class="profile-grid">
              <label class="form-field profile-field-wide">
                <span>Address line</span>
                <input type="text" name="address_line" value="${v(user.address_line)}" placeholder="12 Example Street">
              </label>
              <label class="form-field">
                <span>Town / city</span>
                <input type="text" name="city" value="${v(user.city)}" placeholder="Nottingham">
              </label>
              <label class="form-field">
                <span>Postcode</span>
                <input type="text" name="postcode" value="${v(user.postcode)}" placeholder="NG9 8AB">
              </label>
            </div>
          </div>

          <div class="profile-card">
            <div class="profile-card-head">
              <h3>${isPT ? 'About you' : 'Your bio'}</h3>
              <p class="muted">${isPT
                ? 'Tell clients about your experience, qualifications and training style.'
                : 'A short intro helps trainers understand what you\'re looking for.'}</p>
            </div>
            <label class="form-field">
              <span>Bio</span>
              <textarea name="bio" rows="5" maxlength="600" placeholder="${isPT
                ? 'I\'m a Level 3 qualified PT with 6 years\' experience helping people...'
                : 'I\'m looking to get back into training after a few years off...'}">${esc(user.bio)}</textarea>
              <small class="field-note">Up to 600 characters</small>
            </label>
          </div>

          ${isPT ? `
          <div class="profile-card">
            <div class="profile-card-head">
              <h3>Rates</h3>
              <p class="muted">What you charge per session. You can add packages later.</p>
            </div>
            <div class="profile-grid">
              <label class="form-field">
                <span>Price per session (£)</span>
                <input type="number" name="price" min="0" step="1" value="${v(user.price)}" placeholder="35">
              </label>
            </div>
          </div>` : ''}

          <div class="profile-actions">
            <button type="submit" class="btn btn-primary btn-lg">Save changes</button>
          </div>
        </form>

        <!-- saved trainers (kept from the dashboard) -->
        <div class="dash-section-head profile-saved-head">
          <h3>${isPT ? 'Trainers you follow' : 'Your saved trainers'}</h3>
          <a href="#/search" class="link-arrow">Find more coaches ${icon('arrow')}</a>
        </div>
        ${favTrainers.length ? `
          <div class="tgrid dash-tgrid">
            ${favTrainers.map(trainerCard).join('')}
          </div>` : `
          <div class="dash-empty">
            <p class="muted">You haven't saved any trainers yet. Browse coaches and tap the heart icon to save them here.</p>
            <a href="#/search" class="btn btn-primary">Browse coaches</a>
          </div>`}

      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

async function handleProfileSave(event){
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";

  const fields = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim() || null,
    address_line: form.address_line.value.trim() || null,
    city: form.city.value.trim() || null,
    postcode: form.postcode.value.trim() || null,
    bio: form.bio.value.trim() || null,
  };
  if(form.specialism) fields.specialism = form.specialism.value || null;
  if(form.goals) fields.goals = form.goals.value.trim() || null;
  if(form.price) fields.price = form.price.value ? Number(form.price.value) : null;

  const result = await AUTH.updateProfile(state.currentUser.id, fields);
  const msg = document.getElementById('profile-message');

  if(!result.ok){
    msg.textContent = result.error;
    msg.className = 'form-error';
    msg.hidden = false;
    btn.disabled = false;
    btn.textContent = original;
    return;
  }

  // keep local state in sync so the nav/sidebar update straight away
  state.currentUser = { ...state.currentUser, ...fields };
  render();

  const newMsg = document.getElementById('profile-message');
  if(newMsg){
    newMsg.textContent = "Profile saved.";
    newMsg.className = 'form-success';
    newMsg.hidden = false;
    setTimeout(() => { if(newMsg) newMsg.hidden = true; }, 3000);
  }
}

async function handleAvatarUpload(event){
  const file = event.target.files[0];
  if(!file) return;
  const status = document.getElementById('avatar-status');
  status.textContent = "Uploading photo…";
  status.className = 'profile-avatar-status';
  status.hidden = false;

  const result = await AUTH.uploadAvatar(state.currentUser.id, file);

  if(!result.ok){
    status.textContent = result.error;
    status.className = 'profile-avatar-status error';
    return;
  }

  state.currentUser = { ...state.currentUser, photo_url: result.photoUrl };
  render();
}

function renderDashSidebar(role){
  const user = state.currentUser;
  const currentHash = window.location.hash || "#/";
  const clientLinks = [
    ["#/client-dashboard","Overview"], ["#/profile","My profile"], ["#/search","Find a PT"],
  ];
  const ptLinks = [
    ["#/pt-dashboard","Overview"], ["#/profile","My profile"],
  ];
  const links = role === 'pt' ? ptLinks : clientLinks;
  return `
  <aside class="dash-sidebar">
    <div class="dash-user">
      <span class="dash-user-avatar">
        ${user.photo_url
          ? `<img src="${esc(user.photo_url)}" alt="${esc(user.name)}">`
          : esc(user.name.trim().charAt(0).toUpperCase())}
      </span>
      <div>
        <div class="dash-user-name">${esc(user.name)}</div>
        <div class="dash-user-role">${role === 'pt' ? 'Personal trainer' : 'Client'}</div>
      </div>
    </div>
    <nav class="dash-nav">
      ${links.map(([href,label],i) => {
        // highlight the profile link on the profile page, otherwise the first item
        const isActive = href === currentHash.split('?')[0];
        return `<a href="${href}" class="${isActive?'active':''}">${label}</a>`;
      }).join('')}
    </nav>
    <button class="btn btn-outline btn-block" onclick="handleLogout()">Log out</button>
  </aside>`;
}

/* ============================================================
   ROUTER
   ============================================================ */

function render(){
  const app = document.getElementById('app');
  const [hash, query] = (window.location.hash || "#/").split('?');
  const params = new URLSearchParams(query || '');

  if(hash === "#/" || hash === ""){
    app.innerHTML = renderHome();
  } else if(hash === "#/search"){
    app.innerHTML = renderSearch(params);
  } else if(hash === "#/how-it-works"){
    app.innerHTML = renderPlaceholder("How it works", "A step-by-step guide to finding, booking and training with your coach.", "How It Works");
  } else if(hash === "#/for-pts"){
    app.innerHTML = renderPlaceholder("For personal trainers", "List your services, manage bookings and grow your client base.", "For PTs");
  } else if(hash === "#/about"){
    app.innerHTML = renderPlaceholder("About PT Your Way", "We connect clients with qualified, verified personal trainers — online or in person.", "About");
  } else if(hash === "#/login"){
    if(state.currentUser){ navigateTo(state.currentUser.role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard'); return render(); }
    app.innerHTML = renderLogin();
  } else if(hash === "#/signup"){
    if(state.currentUser){ navigateTo(state.currentUser.role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard'); return render(); }
    app.innerHTML = renderSignup('client');
  } else if(hash === "#/signup-pt"){
    if(state.currentUser){ navigateTo(state.currentUser.role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard'); return render(); }
    app.innerHTML = renderSignup('pt');
  } else if(hash === "#/logout"){
    handleLogout();
    return;
  } else if(hash === "#/dashboard"){
    if(!state.currentUser){ navigateTo('#/login'); return render(); }
    navigateTo(state.currentUser.role === 'pt' ? '#/pt-dashboard' : '#/client-dashboard');
    return render();
  } else if(hash === "#/client-dashboard"){
    if(!state.currentUser){ navigateTo('#/login'); return render(); }
    if(state.currentUser.role !== 'client'){ navigateTo('#/pt-dashboard'); return render(); }
    app.innerHTML = renderClientDashboard();
  } else if(hash === "#/pt-dashboard"){
    if(!state.currentUser){ navigateTo('#/login'); return render(); }
    if(state.currentUser.role !== 'pt'){ navigateTo('#/client-dashboard'); return render(); }
    app.innerHTML = renderPTDashboard();
  } else if(hash === "#/profile"){
    if(!state.currentUser){ navigateTo('#/login'); return render(); }
    app.innerHTML = renderProfile();
  } else if(hash === "#/welcome"){
    app.innerHTML = renderWelcome();
  } else if(hash.startsWith("#/trainer/")){
    app.innerHTML = renderTrainerProfile(hash.replace("#/trainer/",""));
  } else {
    app.innerHTML = renderPlaceholder("Page not found", "That page doesn't exist yet.");
  }
}

async function initApp(){
  // restore an existing session (if the person is already logged in) before
  // the first render, so the nav/dashboard shows the right state immediately
  state.currentUser = normUser(await AUTH.getSession());
  // load real trainers first (max 2.5s) so profile links open straight away
  await Promise.race([loadTrainers(), new Promise(r => setTimeout(r, 2500))]);
  render();
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', initApp);