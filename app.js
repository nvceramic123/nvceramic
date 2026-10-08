const NVC = {
  data: null,
  apiUrl: (window.NVC_CONFIG && window.NVC_CONFIG.apiUrl) || '',

  async init() {
    try {
      const local = await fetch('data.json', { cache: 'no-store' });
      this.data = await local.json();
      if (this.apiUrl) {
        try {
          const r = await fetch(this.apiUrl, { cache: 'no-store' });
          if (r.ok) {
            const remote = await r.json();
            const localData = this.data || {};
            const mergeMaster = (key) => {
              const localArr = Array.isArray(localData[key]) ? localData[key] : [];
              const remoteArr = Array.isArray(remote[key]) ? remote[key] : [];
              const byId = {};
              localArr.concat(remoteArr).forEach(x => {
                const id = x && (x.id || x.name);
                if (id) byId[id] = x;
              });
              return Object.keys(byId).map(k => byId[k]);
            };
            this.data = { ...localData, ...remote };
            ['categories','sizes','finishes','applications','features'].forEach(k => {
              this.data[k] = mergeMaster(k);
            });
          }
        } catch (e) { console.warn('Live Google Sheet data unavailable. Using local data.', e); }
      }
    } catch (e) {
      console.warn('Local data.json could not be fetched. Using bundled local fallback.', e);
      this.data = window.NVC_LOCAL_DATA || { settings:{}, categories:[], products:[], prices:[], blogs:[], applications:[], sizes:[], finishes:[], features:[] };
    }
    this.normalizeData();
    this.buildHeader(); this.buildFooter(); this.bindWA(); this.buildMega(); this.applySettings(); this.route(); this.orgSchema(); this.updateCartCount(); this.bindCartButtons(); if(!this._cartDelegated){document.addEventListener('click',e=>{const b=e.target.closest('[data-add-cart]');if(!b)return;const p=this.data.products.find(x=>x.id===b.dataset.addCart);if(p)this.addToCart(p);});this._cartDelegated=true;}
  },

  normalizeData() {
    const d = this.data || {};
    d.settings=d.settings||{}; d.categories=d.categories||[]; d.products=d.products||[]; d.prices=d.prices||[];
    d.applications=d.applications||[]; d.sizes=d.sizes||[]; d.finishes=d.finishes||[]; d.features=d.features||[];
    d.blogs=(d.blogs||[]).filter(b=>String(b.status||'published').toLowerCase()==='published');
    d.products=d.products.map(p=>{
      const apps=Array.isArray(p.applications)?p.applications: this.splitNames(p.application);
      const feats=Array.isArray(p.features)?p.features: this.splitNames(p.feature || p.featuresText);
      const images=[];
      for(let i=1;i<=8;i++){ const v=p['image'+i] || (i===1?p.image:''); if(v && !images.includes(v)) images.push(v); }
      return {...p, applications:apps, application:apps.map(x=>x.name||x).join(', '), features:feats, feature:feats.map(x=>x.name||x).join(', '), imageUrls:images, active:p.active!==false};
    });
    this.data=d;
  },

  splitNames(value){ return String(value||'').split(',').map(x=>x.trim()).filter(Boolean).map(name=>({name})); },
  esc(value){ return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); },
  cat(id){ return (this.data.categories||[]).find(x=>x.id===id || x.name===id) || {}; },
  price(id){ return (this.data.prices||[]).find(x=>x.id===id || x.name===id) || null; },
  wa(msg){ const n=String(this.data.settings.whatsapp||'917567796973').replace(/\D/g,''); return 'https://wa.me/'+n+'?text='+encodeURIComponent(msg||'Hello N V CERAMIC'); },
  getCart(){ try{return JSON.parse(localStorage.getItem('nvcInquiryCart')||'[]')}catch(e){return []} },
  saveCart(cart){ localStorage.setItem('nvcInquiryCart',JSON.stringify(cart)); this.updateCartCount(); },
  addToCart(p){ const cart=this.getCart(); const found=cart.find(x=>x.id===p.id); if(found){found.qty=(found.qty||1)+1;} else {cart.push({id:p.id,name:p.name,qty:1,size:p.size||'',category:p.category||'',image:(p.imageUrls||[])[0]||''});} this.saveCart(cart); this.showCartNotice('Product added to Inquiry Cart'); },
  removeFromCart(id){ this.saveCart(this.getCart().filter(x=>x.id!==id)); this.renderCart(); },
  setCartQty(id,qty){ const cart=this.getCart(); const item=cart.find(x=>x.id===id); if(item)item.qty=Math.max(1,parseInt(qty||1,10)); this.saveCart(cart); this.renderCart(); },
  clearCart(){this.saveCart([]);this.renderCart();},
  updateCartCount(){const count=this.getCart().reduce((n,x)=>n+(x.qty||1),0);const el=document.getElementById('cart-count');if(el)el.textContent=count;const em=document.getElementById('cart-count-mobile');if(em)em.textContent=count;},
  showCartNotice(msg){let n=document.getElementById('cart-notice');if(!n){n=document.createElement('div');n.id='cart-notice';n.className='cart-notice';document.body.appendChild(n);}n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),1600);},
  cartWhatsApp(){const cart=this.getCart();if(!cart.length)return this.wa('Hello N V CERAMIC, I want product details.');let msg='Hello N V CERAMIC, I want to enquire about these products:\n\n';cart.forEach((x,i)=>{msg+=(i+1)+'. '+x.name+' | Qty: '+(x.qty||1)+(x.size?' | Size: '+x.size:'')+'\n';});msg+='\nPlease share price, availability and details.';return this.wa(msg);},
  renderCart(){const root=document.getElementById('cart-content');if(!root)return;const cart=this.getCart();this.updateCartCount();if(!cart.length){root.innerHTML='<div class="empty"><h2>Your Inquiry Cart is empty</h2><p>Select products from the website and add them here. You can send the complete product list to N V CERAMIC on WhatsApp.</p><a class="btn primary" href="products.html">Browse Products</a></div>';return;}const rows=cart.map(x=>`<div class="cart-item"><div class="cart-item-info"><b>${this.esc(x.name)}</b><span>${this.esc(x.size||x.category||'Product')}</span></div><div class="cart-qty"><label>Qty</label><input type="number" min="1" value="${x.qty||1}" data-cart-qty="${this.esc(x.id)}"></div><button class="cart-remove" type="button" data-cart-remove="${this.esc(x.id)}">Remove</button></div>`).join('');root.innerHTML=`<div class="cart-box"><div class="cart-list">${rows}</div><div class="cart-summary"><h3>Selected Products</h3><p>${cart.length} product${cart.length===1?'':'s'} selected</p><a class="btn primary" href="${this.esc(this.cartWhatsApp())}" target="_blank" rel="noopener">Send Inquiry on WhatsApp</a><button class="btn light" id="clear-cart" type="button">Clear Cart</button></div></div>`;root.querySelectorAll('[data-cart-remove]').forEach(b=>b.addEventListener('click',()=>this.removeFromCart(b.dataset.cartRemove)));root.querySelectorAll('[data-cart-qty]').forEach(i=>i.addEventListener('change',()=>this.setCartQty(i.dataset.cartQty,i.value)));document.getElementById('clear-cart')?.addEventListener('click',()=>this.clearCart());},

  imgUrl(url){
    if(!url) return '';
    const s=String(url); const m=s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : s;
  },

  buildHeader(){
    const el=document.getElementById('site-header'); if(!el)return; const st=this.data.settings||{};
    el.innerHTML=`<header class="site-header"><div class="wrap nav-row"><a class="logo" href="index.html"><img src="assets/logo.png" alt="${this.esc(st.businessName||'N V CERAMIC')} logo"></a><button class="menu-btn" aria-label="Open menu" aria-expanded="false">☰</button><nav class="main-nav"><a href="index.html">Home</a><a href="about.html">About Us</a><a href="calculator.html">Tile Calculator</a><a href="blog.html">Blog</a><a href="contact.html">Contact Us</a></nav><div class="header-meta">${(st.phoneDisplay||st.phone)?`<a class="header-phone" href="tel:+${String(st.phone||st.phoneDisplay||'').replace(/\D/g,'')}">${this.esc(st.phoneDisplay||st.phone||'')}</a>`:''}${st.email?`<a class="header-email" href="mailto:${this.esc(st.email)}">${this.esc(st.email)}</a>`:''}<a class="header-search" href="products.html" aria-label="Search products"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="M16 16l5 5"></path></svg></a><a class="cart-link cart-icon" href="cart.html" aria-label="Inquiry Cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"></path><circle cx="9" cy="20" r="1.2"></circle><circle cx="18" cy="20" r="1.2"></circle></svg><span id="cart-count">0</span></a></div><div class="mobile-actions"><a class="cart-link" href="cart.html">Cart <span id="cart-count-mobile">0</span></a></div></div><div class="product-nav"><div class="wrap product-nav-inner"><a class="product-nav-all" href="products.html">ALL TILES</a><div class="product-tabs" id="product-tabs"></div></div><div class="mega-stage" id="mega-stage"></div></div></header>`;
    const b=document.querySelector('.menu-btn'); if(b)b.addEventListener('click',()=>{const n=document.querySelector('.main-nav'); n.classList.toggle('open'); b.setAttribute('aria-expanded',String(n.classList.contains('open')));});
    document.querySelectorAll('.nav-dd>button').forEach(x=>x.addEventListener('click',()=>x.parentElement.classList.toggle('open')));
  },

  buildFooter(){
    const el=document.getElementById('site-footer'); if(!el)return; const st=this.data.settings||{}; const phone=st.phoneDisplay||st.phone||'';
    el.innerHTML=`<footer><div class="wrap footer-grid"><div><img src="assets/logo.png" alt="${this.esc(st.businessName||'N V CERAMIC')} logo"><p>${this.esc(st.tagline||'')}</p></div><div><b>Products</b>${(this.data.categories||[]).filter(c=>c.group==='Tiles').slice(0,4).map(c=>`<a href="products.html?category=${encodeURIComponent(c.id)}">${this.esc(c.name)}</a>`).join('')}</div><div><b>Business</b><a href="dealer.html">Dealer</a><a href="projects.html">Projects</a><a href="catalogue.html">Catalogue</a><a href="blog.html">Blog / Knowledge Center</a></div><div><b>Contact</b><span>${this.esc(st.address||`${st.city||'Morbi'}, ${st.state||'Gujarat'}, ${st.country||'India'}`)}</span>${phone?`<a href="tel:+${String(st.phone||phone).replace(/\D/g,'')}">${this.esc(phone)}</a>`:''}${st.email?`<a href="mailto:${this.esc(st.email)}">${this.esc(st.email)}</a>`:''}<a data-wa="Hello N V CERAMIC">WhatsApp</a></div></div><div class="copyright">© ${this.esc(st.copyrightYear||'2026')} ${this.esc(st.businessName||'N V CERAMIC')}. All rights reserved.</div></footer>`;
  },

  buildMega(){
    const categories=this.data.categories||[], tiles=categories.filter(x=>x.group==='Tiles'), san=categories.filter(x=>x.group==='Sanitaryware');
    const sizes=(this.data.sizes||[]).slice(0,8), finishes=(this.data.finishes||[]).slice(0,8), apps=(this.data.applications||[]).slice(0,8);
    const designs=['Marble','Stone','Wood','Cement','Terrazzo','Geometric','Pattern','Plain'];
    const colours=['Beige','Brown','Grey','White','Black','Cream','Charcoal','Dark Grey'];
    const typeMap={
      'Ceramic Tiles':['Digital Ceramic Tiles','Glazed Ceramic Tiles','Wall Ceramic Tiles','Kitchen Ceramic Tiles','Bathroom Ceramic Tiles','Decorative Ceramic Tiles'],
      'Vitrified Tiles':['GVT Tiles','PGVT Tiles','Double Charge Tiles','Polished Vitrified Tiles','Digital Vitrified Tiles','Matt Vitrified Tiles'],
      'GVT Tiles':['Digital Glazed Vitrified Tiles','Marble Look GVT','Stone Look GVT','High Gloss GVT','Matt GVT','600x1200 GVT'],
      'PGVT Tiles':['Polished Glazed Vitrified Tiles','Marble PGVT','Book Match PGVT','High Gloss PGVT','600x1200 PGVT'],
      'Full Body Tiles':['Full Body Vitrified Tiles','Colour Body Tiles','Germ Free Tiles','Scratch Free Tiles','Stain Resistant Tiles','Heavy Duty Tiles'],
      'Porcelain Tiles':['Marble Porcelain','Stone Porcelain','Matt Porcelain','Polished Porcelain','Outdoor Porcelain','Large Format Porcelain'],
      'Parking Tiles':['Anti Skid Parking Tiles','Heavy Duty Parking Tiles','Outdoor Parking Tiles','24x24 Parking Tiles','Factory Parking Tiles','Villa Parking Tiles'],
      'Wall Tiles':['Bathroom Wall Tiles','Kitchen Wall Tiles','Elevation Wall Tiles','Decorative Wall Tiles','Glossy Wall Tiles','Matt Wall Tiles'],
      'Floor Tiles':['Living Room Floor Tiles','Bedroom Floor Tiles','Commercial Floor Tiles','Matt Floor Tiles','Polished Floor Tiles','Heavy Duty Floor Tiles'],
      'Table Top Basin':['Marble Look Table Top Basin','Designer Table Top Basin','Round Table Top Basin','Rectangular Table Top Basin','Glossy Basin','Premium Basin'],
      'Wash Basin':['Counter Basin','Wall Hung Basin','Pedestal Basin','Corner Basin','Designer Wash Basin'],
      'One Piece WC':['Wall Hug One Piece WC','Floor Mounted WC','Rimless WC','Soft Close WC'],
      'Wall Hung WC':['Rimless Wall Hung WC','Soft Close Wall Hung WC','Modern Wall Hung WC'],
      'Urinal':['Wall Urinal','Designer Urinal','Commercial Urinal'],
      'Accessories':['Bathroom Accessories','Flush Accessories','Installation Accessories']
    };
    const link=(label,url)=>`<a href="${url}">${this.esc(label)}</a>`;
    const queryLinks=(items,key)=>items.map(x=>link(x,`products.html?q=${encodeURIComponent(x)}`)).join('');
    const catLink=(name)=>{const c=categories.find(x=>x.name===name);return c?`products.html?category=${encodeURIComponent(c.id)}`:'products.html?q='+encodeURIComponent(name);};
    const col=(title,items,urls)=>`<div class="mega-col"><h4>${this.esc(title)}</h4>${items.map((x,i)=>link(x,urls?urls[i]:`products.html?q=${encodeURIComponent(x)}`)).join('')}</div>`;
    const panel=(cat)=>{
      const isSan=cat.group==='Sanitaryware';
      const types=typeMap[cat.name]||[cat.name, ...(isSan?san:tiles).filter(x=>x.name!==cat.name).slice(0,5).map(x=>x.name)];
      const area=apps.map(x=>x.name);
      return col(isSan?'SANITARYWARE BY TYPE':'TILES BY TYPE',types,types.map(x=>`products.html?q=${encodeURIComponent(x)}`))
        +col(isSan?'BY APPLICATION':'BY AREA',area,area.map(x=>`category.html?application=${encodeURIComponent(x)}`))
        +col('BY SIZE',sizes.map(x=>x.name),sizes.map(x=>`products.html?q=${encodeURIComponent(x.name)}`))
        +col('BY DESIGN',designs,designs.map(x=>`products.html?q=${encodeURIComponent(x)}`))
        +col('BY FINISH',finishes.map(x=>x.name),finishes.map(x=>`products.html?q=${encodeURIComponent(x.name)}`))
        +col('BY COLOUR',colours,colours.map(x=>`products.html?q=${encodeURIComponent(x)}`));
    };
    const tabs=document.getElementById('product-tabs'),stage=document.getElementById('mega-stage'),inline=document.getElementById('mega-menu');
    if(tabs){const order=['Ceramic Tiles','Vitrified Tiles','Full Body Tiles','Porcelain Tiles','Parking Tiles','Wall Tiles','Floor Tiles','Sanitaryware']; const ordered=order.map(n=>categories.find(c=>c.name===n)).filter(Boolean); const rest=categories.filter(c=>!order.includes(c.name)); const all=ordered.concat(rest); tabs.innerHTML=all.map((c,i)=>`<a class="product-tab ${i===0?'active':''}" data-cat-id="${this.esc(c.id)}" href="products.html?category=${encodeURIComponent(c.id)}">${this.esc(c.name)}</a>`).join('');}
    if(stage){const first=tiles[0]||categories[0]; stage.innerHTML=`<div class="mega-panel"><div class="mega-panel-top"><div><span class="mega-kicker">EXPLORE COLLECTION</span><strong id="mega-title">${this.esc(first?first.name:'Products')}</strong></div><a id="mega-view-all" href="${first?catLink(first.name):'products.html'}">View All →</a></div><div class="mega-grid" id="mega-grid">${first?panel(first):''}</div><div class="mega-quick"><span>QUICK LINKS</span><a href="category.html">Applications</a><a href="projects.html">Projects</a><a href="dealer.html">Dealer</a><a href="catalogue.html">Catalogue</a><a href="products.html">All Products →</a></div></div>`;
      const show=(cat)=>{stage.classList.add('show');const t=document.getElementById('mega-title'),v=document.getElementById('mega-view-all'),g=document.getElementById('mega-grid');if(t)t.textContent=cat.name;if(v){v.href=catLink(cat.name);}if(g)g.innerHTML=panel(cat);tabs.querySelectorAll('.product-tab').forEach(x=>x.classList.toggle('active',x.dataset.catId===cat.id));};
      tabs?.querySelectorAll('.product-tab').forEach(a=>{const c=categories.find(x=>x.id===a.dataset.catId);a.addEventListener('mouseenter',()=>show(c));a.addEventListener('focus',()=>show(c));});
      document.querySelector('.product-nav')?.addEventListener('mouseleave',()=>stage.classList.remove('show'));
      stage.addEventListener('mouseenter',()=>stage.classList.add('show')); stage.addEventListener('mouseleave',()=>stage.classList.remove('show'));
      document.querySelector('.product-nav-all')?.addEventListener('mouseenter',()=>stage.classList.remove('show'));
    }
    if(inline){inline.innerHTML=col('TILES',tiles.slice(0,6).map(x=>x.name),tiles.slice(0,6).map(x=>`products.html?category=${encodeURIComponent(x.id)}`))+col('TILES — MORE',tiles.slice(6).map(x=>x.name),tiles.slice(6).map(x=>`products.html?category=${encodeURIComponent(x.id)}`))+col('SANITARYWARE',san.slice(0,6).map(x=>x.name),san.slice(0,6).map(x=>`products.html?category=${encodeURIComponent(x.id)}`))+col('SHOP BY',apps.slice(0,6).map(x=>x.name),apps.slice(0,6).map(x=>`category.html?application=${encodeURIComponent(x.name)}`));}
    const am=document.getElementById('application-menu'); if(am) am.innerHTML=this.data.applications.slice(0,18).map(a=>`<a href="category.html?application=${encodeURIComponent(a.name)}">${this.esc(a.name)}</a>`).join('');
  },

  bindWA(){ document.querySelectorAll('[data-wa]').forEach(a=>a.href=this.wa(a.getAttribute('data-wa'))); },
  applySettings(){ const st=this.data.settings||{}; document.querySelectorAll('[data-setting]').forEach(el=>{const k=el.getAttribute('data-setting');if(st[k]!==undefined)el.textContent=st[k];}); document.querySelectorAll('[data-setting-href]').forEach(el=>{const k=el.getAttribute('data-setting-href'); if(k==='phone'){const n=String(st.phone||'').replace(/\D/g,'');if(n)el.href='tel:+'+n;} if(k==='email'&&st.email)el.href='mailto:'+st.email;}); },

  productImages(p){ return (p.imageUrls||[]).map(x=>this.imgUrl(x)).filter(Boolean); },
  productImage(p,c){ const imgs=this.productImages(p); return imgs.length?`<img src="${this.esc(imgs[0])}" alt="${this.esc(p.name)} - ${this.esc(c.name||'Product')}" loading="lazy">`:`<div class="placeholder">Product Photo<br>will be added here</div>`; },
  card(p){
    const c=this.cat(p.categoryId||p.category), pr=this.price(p.priceId||p.priceSelection); const size=p.size||''; const finish=p.finish||''; const app=p.application||''; const price=this.data.settings.showPrices&&pr&&pr.price?`<p><b>${this.esc(pr.currency||'₹')} ${this.esc(String(pr.price).replace(/^₹\s*/,''))}</b> ${this.esc(pr.unit||'')}</p>`:'';
    return `<article class="product-card"><a href="product.html?id=${encodeURIComponent(p.id)}"><div class="product-image">${p.new?'<span class="badge">NEW</span>':''}${this.productImage(p,c)}</div></a><div class="product-body"><h3>${this.esc(p.name)}</h3><div class="meta">${this.esc(c.name||p.category||'')}${size?' • '+this.esc(size):''}</div>${finish?`<div class="meta">Finish: ${this.esc(finish)}</div>`:''}${app?`<div class="meta">Application: ${this.esc(app)}</div>`:''}${price}<p>${this.esc(p.description||'')}</p><div class="product-actions"><a href="product.html?id=${encodeURIComponent(p.id)}">View Details</a><button class="secondary cart-add" type="button" data-add-cart="${this.esc(p.id)}">Add to Inquiry</button></div></div></article>`;
  },

  bindCartButtons(){document.querySelectorAll('[data-add-cart]').forEach(b=>b.addEventListener('click',()=>{const p=this.data.products.find(x=>x.id===b.dataset.addCart);if(p)this.addToCart(p);}));},

  route(){ const path=location.pathname.split('/').pop(); if(path==='index.html'||path==='')this.home(); if(path==='products.html')this.products(); if(path==='category.html')this.category(); if(path==='product.html')this.product(); if(path==='cart.html')this.cart(); if(path==='blog.html'){if(location.search)renderSingleBlog();else renderBlogPage();} },
  home(){
    const cg=document.getElementById('home-categories');
    if(cg)cg.innerHTML=this.data.categories.filter(c=>c.group==='Tiles'||c.group==='Sanitaryware').slice(0,10).map(c=>`<a class="category-card" href="products.html?category=${encodeURIComponent(c.id)}"><small>${this.esc(c.group)}</small><h3>${this.esc(c.name)}</h3><p>${this.esc(c.desc||'Explore this product category.')}</p><span class="category-arrow">Explore →</span></a>`).join('');
    const fp=document.getElementById('featured-products');
    if(fp){let arr=this.data.products.filter(p=>p.active&&p.featured); if(!arr.length)arr=this.data.products.filter(p=>p.active&&p.new); if(!arr.length)arr=this.data.products.filter(p=>p.active); arr=arr.slice(0,6); fp.innerHTML=arr.length?arr.map(p=>this.card(p)).join(''):'<div class="empty">Add products in the Google Sheet master to show them here.</div>';}
    const hs=document.getElementById('home-sizes'); if(hs){const sizes=(this.data.sizes||[]).slice(0,10);hs.innerHTML=sizes.map(x=>`<a href="products.html?q=${encodeURIComponent(x.name)}"><b>${this.esc(x.name)}</b><span>View products →</span></a>`).join('');}
    const hb=document.getElementById('home-blogs'); if(hb){const blogs=(this.data.blogs||[]).slice(0,3);hb.innerHTML=blogs.length?blogs.map(b=>`<article class="blog-card"><div class="blog-card-body"><div class="eyebrow">${this.esc(b.category||'Guide')}</div><h3>${this.esc(b.title||'')}</h3><p>${this.esc(b.shortDescription||'')}</p><a class="btn btn-outline" href="blog.html?slug=${encodeURIComponent(b.slug)}">Read Guide →</a></div></article>`).join(''):'<div class="empty">Useful buying guides will appear here.</div>';}
    const s=document.getElementById('home-search'),b=document.getElementById('home-search-btn'); if(b)b.addEventListener('click',()=>{if(s.value.trim())location.href='products.html?q='+encodeURIComponent(s.value.trim());}); if(s)s.addEventListener('keydown',e=>{if(e.key==='Enter')b.click();});
  },

  products(){
    const prods=this.data.products.filter(p=>p.active), cf=document.getElementById('category-filter'), ff=document.getElementById('finish-filter'), sf=document.getElementById('size-filter'), af=document.getElementById('application-filter'), df=document.getElementById('design-filter'), clf=document.getElementById('colour-filter'), sort=document.getElementById('sort-filter');
    if(cf)cf.innerHTML='<option value="">All Categories</option>'+this.data.categories.map(c=>`<option value="${this.esc(c.id)}">${this.esc(c.name)}</option>`).join('');
    const unique=(arr)=>[...new Set(arr.flatMap(x=>String(x||'').split(',').map(s=>s.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
    const finishes=unique(prods.map(p=>p.finish)),sizes=unique(prods.map(p=>p.size)),apps=unique(prods.map(p=>p.application)),designs=unique(prods.map(p=>p.design||p.designLook||p['design / look'])),colours=unique(prods.map(p=>p.colour||p.color));
    if(ff)ff.innerHTML='<option value="">All Finishes</option>'+finishes.map(x=>`<option>${this.esc(x)}</option>`).join('');
    if(sf)sf.innerHTML='<option value="">All Sizes</option>'+sizes.map(x=>`<option>${this.esc(x)}</option>`).join('');
    if(af)af.innerHTML='<option value="">All Applications</option>'+apps.map(x=>`<option>${this.esc(x)}</option>`).join('');
    if(df)df.innerHTML='<option value="">All Designs</option>'+designs.map(x=>`<option>${this.esc(x)}</option>`).join('');
    if(clf)clf.innerHTML='<option value="">All Colours</option>'+colours.map(x=>`<option>${this.esc(x)}</option>`).join('');
    const params=new URLSearchParams(location.search); if(cf)cf.value=params.get('category')||''; if(document.getElementById('product-search'))document.getElementById('product-search').value=params.get('q')||'';
    const render=()=>{
      let a=prods.slice(); const q=(document.getElementById('product-search')?.value||'').toLowerCase().trim(),cat=cf?.value||'',fin=ff?.value||'',size=sf?.value||'',app=af?.value||'',design=df?.value||'',colour=clf?.value||'',sortVal=sort?.value||'relevance';
      const has=(v,needle)=>String(v||'').split(',').map(x=>x.trim()).some(x=>x.toLowerCase()===String(needle).toLowerCase());
      a=a.filter(p=>!q||[p.name,p.size,p.finish,p.application,p.feature,p.description,p.design,p.designLook,p.colour,p.color,this.cat(p.categoryId||p.category).name,p.category].join(' ').toLowerCase().includes(q))
       .filter(p=>!cat||(p.categoryId===cat||p.category===this.cat(cat).name)).filter(p=>!fin||has(p.finish,fin)).filter(p=>!size||has(p.size,size)).filter(p=>!app||has(p.application,app)).filter(p=>!design||has(p.design||p.designLook,design)).filter(p=>!colour||has(p.colour||p.color,colour));
      if(sortVal==='name')a.sort((x,y)=>String(x.name).localeCompare(String(y.name))); else if(sortVal==='new')a.sort((x,y)=>(y.new?1:0)-(x.new?1:0));
      const meta=document.getElementById('results-meta');if(meta)meta.textContent=a.length+' product'+(a.length===1?'':'s')+' found';
      const note=document.getElementById('active-filter-note');if(note){const labels=[];if(q)labels.push('Search: '+q);if(cat)labels.push(this.cat(cat).name);if(fin)labels.push(fin);if(size)labels.push(size);if(app)labels.push(app);if(design)labels.push(design);if(colour)labels.push(colour);note.textContent=labels.length?labels.join(' • '):'Showing all available products';}
      const grid=document.getElementById('all-products');if(grid)grid.innerHTML=a.length?a.map(p=>this.card(p)).join(''):'<div class="empty">No matching products yet. Try changing filters or send your requirement on WhatsApp.</div>'; this.bindCartButtons();
    };
    [document.getElementById('product-search'),cf,ff,sf,af,df,clf,sort].forEach(x=>x?.addEventListener('input',render));
    document.getElementById('clear-filters')?.addEventListener('click',()=>{[cf,ff,sf,af,df,clf].forEach(x=>{if(x)x.value=''});if(sort)sort.value='relevance';const q=document.getElementById('product-search');if(q)q.value='';render();});
    render();
  },

  category(){
    const params=new URLSearchParams(location.search),cid=params.get('category'),app=params.get('application');let title='',desc='',arr=this.data.products.filter(p=>p.active);
    if(cid){const c=this.cat(cid);title=c.name;desc=c.desc||'';arr=arr.filter(p=>p.categoryId===cid||p.category===title);} else if(app){title=app.replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())+' Products';desc='Explore products suitable for '+title.toLowerCase()+'.';arr=arr.filter(p=>String(p.application||'').toLowerCase().split(',').map(s=>s.trim()).includes(String(app).toLowerCase()));}
    document.title=(title||'Products')+' | N V CERAMIC'; const t=document.getElementById('cat-title'),d=document.getElementById('cat-desc'),g=document.getElementById('cat-products');if(t)t.textContent=title||'Products';if(d)d.textContent=desc;if(g)g.innerHTML=arr.length?arr.map(p=>this.card(p)).join(''):'<div class="empty">No products have been added for this category yet.</div>';const c=document.getElementById('cat-content');if(c)c.textContent='View product details, images, size, finish, application, features and WhatsApp enquiry options.';
  },

  product(){
    const id=new URLSearchParams(location.search).get('id'),p=this.data.products.find(x=>x.id===id),el=document.getElementById('product-detail');if(!el)return;if(!p){el.innerHTML='<div class="empty">Product not found. Please return to Products.</div>';return;}
    const c=this.cat(p.categoryId||p.category),pr=this.price(p.priceId||p.priceSelection),imgs=this.productImages(p),sizeText=p.size||'As per model',finishText=p.finish||'As per model',appText=p.application||'Residential & Commercial',featureText=p.feature||'As per model';document.title=p.name+' | N V CERAMIC';const meta=document.querySelector('meta[name="description"]');if(meta)meta.setAttribute('content',(p.metaDescription||p.description||p.name)+' N V CERAMIC, Morbi, Gujarat.');
    const gallery=imgs.length?`<div class="product-gallery"><div class="gallery-main"><img id="gallery-main-img" src="${this.esc(imgs[0])}" alt="${this.esc(p.name)}"></div><div class="gallery-thumbs">${imgs.map((u,i)=>`<button type="button" class="gallery-thumb ${i===0?'active':''}" data-img="${this.esc(u)}"><img src="${this.esc(u)}" alt="${this.esc(p.name)} view ${i+1}"></button>`).join('')}</div></div>`:`<div class="detail-image"><div class="placeholder">Product Photo<br>will be added here</div></div>`;
    const price=this.data.settings.showPrices&&pr&&pr.price?`<div class="price-box"><b>${this.esc(pr.currency||'₹')} ${this.esc(String(pr.price).replace(/^₹\s*/,''))}</b> ${this.esc(pr.unit||'')}</div>`:'<div class="price-box"><b>Get Latest Price</b></div>';
    el.innerHTML=`<div class="detail-grid"><div>${gallery}</div><div><span class="eyebrow">${this.esc(c.name||p.category||'PRODUCT')}</span><h1 class="detail-title">${this.esc(p.name)}</h1><p>${this.esc(p.description||'')}</p>${price}<div class="spec-list"><div class="spec"><small>Size</small><b>${this.esc(sizeText)}</b></div><div class="spec"><small>Finish</small><b>${this.esc(finishText)}</b></div><div class="spec"><small>Application</small><b>${this.esc(appText)}</b></div><div class="spec"><small>Features</small><b>${this.esc(featureText)}</b></div></div><div class="detail-actions"><button class="btn light cart-add" type="button" data-add-cart="${this.esc(p.id)}">Add to Inquiry Cart</button><a class="btn primary" href="${this.esc(this.wa('Hello N V CERAMIC, I want details for: '+p.name+' | Size: '+sizeText))}" target="_blank" rel="noopener">WhatsApp Enquiry</a></div></div></div>`;
    document.querySelectorAll('.gallery-thumb').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById('gallery-main-img').src=btn.dataset.img;document.querySelectorAll('.gallery-thumb').forEach(x=>x.classList.remove('active'));btn.classList.add('active');}));
    const related=this.data.products.filter(x=>x.active&&(x.categoryId===p.categoryId||x.category===p.category)&&x.id!==p.id).slice(0,3),rp=document.getElementById('related-products');if(rp)rp.innerHTML=related.length?related.map(x=>this.card(x)).join(''):'<div class="empty">More products can be added from the master sheet.</div>';
    const schema={'@context':'https://schema.org','@type':'Product',name:p.name,description:p.description||'',category:c.name||p.category||'',image:imgs};if(this.data.settings.showPrices&&pr&&pr.price)schema.offers={'@type':'Offer',priceCurrency:pr.currency||'INR',price:String(pr.price).replace(/[^0-9.]/g,''),availability:'https://schema.org/InStock'};const s=document.createElement('script');s.type='application/ld+json';s.textContent=JSON.stringify(schema);document.head.appendChild(s);
  },

  cart(){this.renderCart();},

  orgSchema(){const s=document.getElementById('org-schema');if(!s)return;const st=this.data.settings||{};s.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Organization',name:st.businessName||'N V CERAMIC',description:st.tagline||'',url:location.href,logo:new URL('assets/logo.png',location.href).href,address:{'@type':'PostalAddress',addressLocality:st.city||'Morbi',addressRegion:st.state||'Gujarat',addressCountry:'IN'},telephone:st.phone?'+91 '+String(st.phone).replace(/\D/g,'').slice(-10):undefined});}
};

function renderBlogPage(){const root=document.getElementById('app');if(!root)return;const blogs=NVC.data.blogs||[],cats=[...new Set(blogs.map(b=>b.category).filter(Boolean))];root.innerHTML=`<section class="page-hero"><div class="wrap"><span class="eyebrow">KNOWLEDGE CENTER</span><h1>Tile & Sanitaryware Guides</h1><p>Practical buying guides for homeowners, dealers, builders, architects and project buyers.</p></div></section><section class="section"><div class="wrap"><div class="blog-toolbar"><div><b>${blogs.length}</b> published guide${blogs.length===1?'':'s'}</div><div class="blog-filters"><button class="blog-filter active" data-category="">All</button>${cats.map(c=>`<button class="blog-filter" data-category="${NVC.esc(c)}">${NVC.esc(c)}</button>`).join('')}</div></div><div class="blog-grid" id="blog-list"></div></div></section>`;const list=document.getElementById('blog-list');const render=cat=>{const items=cat?blogs.filter(b=>b.category===cat):blogs;list.innerHTML=items.length?items.map(b=>`<article class="blog-card"><div class="blog-card-body"><div class="eyebrow">${NVC.esc(b.category||'Guide')}</div><h2>${NVC.esc(b.title||'')}</h2><p>${NVC.esc(b.shortDescription||'')}</p><div class="blog-meta">${NVC.esc(b.author||'N V CERAMIC')}${b.publishedDate?' • '+NVC.esc(String(b.publishedDate).slice(0,10)):''}</div><a class="btn btn-outline" href="blog.html?slug=${encodeURIComponent(b.slug)}">Read Article →</a></div></article>`).join(''):'<div class="empty">No guides in this category yet.</div>';};render('');root.querySelectorAll('.blog-filter').forEach(btn=>btn.addEventListener('click',()=>{root.querySelectorAll('.blog-filter').forEach(x=>x.classList.remove('active'));btn.classList.add('active');render(btn.dataset.category||'');}));}
function renderSingleBlog(){const slug=new URLSearchParams(location.search).get('slug'),b=(NVC.data.blogs||[]).find(x=>x.slug===slug),root=document.getElementById('app');if(!root)return;if(!b){root.innerHTML='<section class="section"><div class="wrap"><div class="empty"><h1>Article not found</h1><a class="btn primary" href="blog.html">Back to Blog</a></div></div></section>';return;}const related=(b.relatedProductIds||[]).map(id=>NVC.data.products.find(p=>p.id===id)).filter(Boolean);document.title=b.seoTitle||b.title||'Blog | N V CERAMIC';const meta=document.querySelector('meta[name="description"]');if(meta)meta.setAttribute('content',b.metaDescription||b.shortDescription||'N V CERAMIC buying guide.');root.innerHTML=`<section class="section"><div class="wrap article"><a class="back-link" href="blog.html">← All Guides</a><div class="eyebrow">${NVC.esc(b.category||'Guide')}</div><h1>${NVC.esc(b.title)}</h1><p class="lead">${NVC.esc(b.shortDescription||'')}</p><div class="blog-meta">${NVC.esc(b.author||'N V CERAMIC')}${b.publishedDate?' • '+NVC.esc(String(b.publishedDate).slice(0,10)):''}</div>${b.image?`<img class="article-hero" src="${NVC.esc(NVC.imgUrl(b.image))}" alt="${NVC.esc(b.title)}" loading="lazy">`:''}<div class="article-content">${formatBlogContent(b.content||'')}</div>${related.length?`<h2>Related Products</h2><div class="product-grid">${related.map(p=>NVC.card(p)).join('')}</div>`:''}<div class="article-cta"><h3>Need help selecting the right product?</h3><p>Send your size, application, quantity or project requirement.</p><a class="btn primary" href="${NVC.esc(NVC.wa('Hello N V CERAMIC, I read your guide: '+b.title+'. Please help me with product selection.'))}" target="_blank" rel="noopener">Ask on WhatsApp</a></div></div></section>`;}
function formatBlogContent(s){return NVC.esc(s).split(/\n\s*\n/).filter(Boolean).map(x=>`<p>${x.replace(/\n/g,'<br>')}</p>`).join('');}
NVC.init().then(()=>document.dispatchEvent(new Event('nvc-ready')));
