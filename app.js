/* ============================================================
   PT YOUR WAY — shared UI components
   ============================================================ */

const state = {
  favorites: new Set(["sophie-moore"]),
  role: null, // 'client' | 'pt' | 'admin'
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
    chat:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 1 1-3.4-6.6L21 4l-1 4.6A7.9 7.9 0 0 1 21 12z"/></svg>',
    users:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 12.2A5.5 5.5 0 0 1 21.5 17"/></svg>',
    target:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg>',
  };
  return icons[name] || '';
}

function starRow(rating, reviews){
  return `<span class="rating"><span class="star">${icon('star')}</span> ${rating.toFixed(1)} <span class="count">(${reviews})</span></span>`;
}

function renderNav(active){
  const links = [
    ["#/search","Find a PT"], ["#/how-it-works","How It Works"],
    ["#/for-pts","For PTs"], ["#/about","About"]
  ];
  return `
  <header class="topnav">
    <div class="wrap topnav-inner">
      <a href="#/" class="logo">
        <span class="logo-mark">P</span> PT YOUR WAY
      </a>
      <nav class="nav-links">
        ${links.map(([href,label]) => `<a href="${href}" class="${active===label?'active':''}">${label}</a>`).join('')}
      </nav>
      <div class="nav-actions">
        <a href="#/login" class="btn btn-outline">Log in</a>
        <a href="#/signup" class="btn btn-primary">Sign up</a>
        <button class="nav-mobile-toggle" aria-label="Menu">${icon('menu')}</button>
      </div>
    </div>
  </header>`;
}

function renderFooter(){
  return `
  <footer class="footer">
    <div class="wrap">
      <div class="footer-grid">
        <div>
          <div class="logo mb-16"><span class="logo-mark">P</span> PT YOUR WAY</div>
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
  return `
  <article class="tcard" onclick="if(!event.target.closest('.tcard-fav')) navigateTo('#/trainer/${t.id}')">
    <div class="tcard-photo">
      <img src="${t.photo}" alt="${t.name}" loading="lazy">
      <button class="tcard-fav ${isFav?'active':''}" onclick="event.stopPropagation(); toggleFavorite('${t.id}')" aria-label="Save trainer">
        ${isFav ? icon('heartFill') : icon('heart')}
      </button>
      ${t.verified ? `<span class="tcard-verified">${icon('shield')} Verified</span>` : ''}
    </div>
    <div class="tcard-body">
      <div class="tcard-name">${t.name}</div>
      <div class="tcard-spec">${t.specialism}</div>
      <div class="tcard-badges">
        <span class="badge online">${t.online ? 'Online' : 'In Person'}</span>
        <span class="badge">${t.tags[0]}</span>
      </div>
      <div class="tcard-foot">
        ${starRow(t.rating, t.reviews)}
        <span class="price">£${t.price} <small>/ ${t.services && t.services[0] ? t.services[0].unit : 'month'}</small></span>
      </div>
    </div>
  </article>`;
}

function toggleFavorite(id){
  if(state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
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

function renderHome(){
  return `
  ${renderNav("")}

  <section class="hero">
    <div class="hero-media">
      <img src="https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80" alt="Personal trainer outdoors">
    </div>
    <div class="wrap hero-inner">
      <span class="hero-eyebrow">Personal training, on your terms</span>
      <h1>PT<span class="accent">YOUR WAY</span></h1>
      <p>Find the right coach for your goals, your lifestyle, your way.</p>
    </div>
  </section>

  <div class="wrap search-card">
    <form class="search-bar" onsubmit="event.preventDefault(); navigateTo('#/search');">
      <label class="search-field">
        <span class="field-icon">${icon('search')}</span>
        <input type="text" placeholder="What are you looking for?">
      </label>
      <label class="search-field divider">
        <select><option value="">Goal</option>${SPECIALISMS.slice(0,8).map(s=>`<option>${s}</option>`).join('')}</select>
      </label>
      <label class="search-field divider">
        <select><option value="">Specialism</option>${SPECIALISMS.map(s=>`<option>${s}</option>`).join('')}</select>
      </label>
      <label class="search-field divider">
        <select><option value="">Budget</option><option>Up to £40</option><option>£40 – £60</option><option>£60 – £80</option><option>£80+</option></select>
      </label>
      <button type="submit" class="btn btn-primary">Search</button>
    </form>
  </div>

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
        ${TRAINERS.map(trainerCard).join('')}
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
  const t = TRAINERS.find(x => x.id === id);
  if(!t) return renderPlaceholder("Coach not found", "We couldn't find that trainer profile.");
  return `
  ${renderNav("")}
  <section class="placeholder-page wrap" style="text-align:left; padding-top:64px;">
    <div style="display:flex; gap:32px; align-items:flex-start; flex-wrap:wrap;">
      <img src="${t.photo}" alt="${t.name}" style="width:220px; height:220px; object-fit:cover; border-radius:20px;">
      <div>
        <h2 style="margin-bottom:6px;">${t.name}</h2>
        <p class="muted" style="margin-bottom:14px;">${t.specialism}</p>
        ${starRow(t.rating, t.reviews)}
        <p style="margin-top:24px; max-width:520px; color:var(--ink-soft); line-height:1.6;">
          Full profile — bio, qualifications, gallery, pricing packages and booking are coming soon to this page.
        </p>
        <div style="display:flex; gap:12px; margin-top:24px;">
          <button class="btn btn-primary">Book consultation</button>
          <button class="btn btn-outline">Message</button>
        </div>
      </div>
    </div>
  </section>
  ${renderFooter()}
  `;
}

/* ============================================================
   ROUTER
   ============================================================ */

function render(){
  const app = document.getElementById('app');
  const hash = window.location.hash || "#/";

  if(hash === "#/" || hash === ""){
    app.innerHTML = renderHome();
  } else if(hash === "#/search"){
    app.innerHTML = renderPlaceholder("Find a PT", "Full search & filtering is coming soon. In the meantime, browse coaches from the homepage.", "Find a PT");
  } else if(hash === "#/how-it-works"){
    app.innerHTML = renderPlaceholder("How it works", "A step-by-step guide to finding, booking and training with your coach.", "How It Works");
  } else if(hash === "#/for-pts"){
    app.innerHTML = renderPlaceholder("For personal trainers", "List your services, manage bookings and grow your client base.", "For PTs");
  } else if(hash === "#/about"){
    app.innerHTML = renderPlaceholder("About PT Your Way", "We connect clients with qualified, verified personal trainers — online or in person.", "About");
  } else if(hash === "#/login"){
    app.innerHTML = renderPlaceholder("Log in", "Account login is coming soon.");
  } else if(hash === "#/signup" || hash === "#/signup-pt"){
    app.innerHTML = renderPlaceholder("Sign up", "Account creation is coming soon.");
  } else if(hash.startsWith("#/trainer/")){
    app.innerHTML = renderTrainerProfile(hash.replace("#/trainer/",""));
  } else {
    app.innerHTML = renderPlaceholder("Page not found", "That page doesn't exist yet.");
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
