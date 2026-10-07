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
          if (r.ok) this.data = await r.json();
        } catch (e) {
          console.warn('Live Google Sheet data could not be loaded. Using local data.', e);
        }
      }
    } catch (e) {
      console.error('Website data could not be loaded.', e);
      this.data = { settings: {}, categories: [], sizes: [], finishes: [], applications: [], products: [], variants: [], productApplications: [], prices: [], blogs: [] };
    }

    this.normalizeData();
    this.buildHeader();
    this.buildFooter();
    this.bindWA();
    this.buildMega();
    this.applySettings();
    this.route();
    this.orgSchema();
  },

  normalizeData() {
    const d = this.data || {};
    d.settings = d.settings || {};
    d.categories = d.categories || [];
    d.sizes = d.sizes || [];
    d.finishes = d.finishes || [];
    d.applications = d.applications || [];
    d.products = d.products || [];
    d.variants = d.variants || [];
    d.productApplications = d.productApplications || [];
    d.prices = d.prices || [];
    d.blogs = (d.blogs || []).filter(b => String(b.status || 'published').toLowerCase() === 'published');

    const sizesById = Object.fromEntries(d.sizes.map(x => [x.id, x]));
    const finishesById = Object.fromEntries(d.finishes.map(x => [x.id, x]));
    const appsById = Object.fromEntries(d.applications.map(x => [x.id, x]));
    const variantsByProduct = {};
    d.variants.forEach(v => {
      if (!v.productId) return;
      (variantsByProduct[v.productId] ||= []).push(v);
    });
    const appsByProduct = {};
    d.productApplications.forEach(m => {
      if (!m.productId) return;
      (appsByProduct[m.productId] ||= []).push(m.applicationId);
    });

    d.products = d.products.map(p => {
      const vars = variantsByProduct[p.id] || [];
      const sizeObjects = vars.map(v => sizesById[v.sizeId]).filter(Boolean);
      const finishObjects = vars.map(v => finishesById[v.finishId]).filter(Boolean);
      const appObjects = (appsByProduct[p.id] || []).map(id => appsById[id]).filter(Boolean);
      const sizeNames = [...new Set(sizeObjects.map(x => x.name).filter(Boolean))];
      const finishNames = [...new Set(finishObjects.map(x => x.name).filter(Boolean))];
      const applicationNames = [...new Set(appObjects.map(x => x.name).filter(Boolean))];
      const priceIds = [...new Set(vars.map(v => v.priceId).filter(Boolean))];
      return {
        ...p,
        variants: vars,
        sizes: sizeObjects,
        finishes: finishObjects,
        applications: appObjects,
        priceIds,
        size: p.size || sizeNames.join(', '),
        finish: p.finish || finishNames.join(', '),
        application: p.application || applicationNames.join(', ')
      };
    });
    this.data = d;
  },

  esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  },

  cat(id) { return (this.data.categories || []).find(x => x.id === id) || {}; },
  price(id) { return (this.data.prices || []).find(x => x.id === id) || null; },

  wa(msg) {
    const n = String(this.data.settings.whatsapp || '917567796973').replace(/\D/g, '');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(msg || 'Hello N V CERAMIC');
  },

  imgUrl(url) {
    if (!url) return '';
    const m = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]+)/);
    return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600` : url;
  },

  buildHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    const st = this.data.settings || {};
    el.innerHTML = `<header class="site-header">
      <div class="topline"><div class="wrap top-inner"><span>${this.esc(st.address || `${st.city || 'Morbi'}, ${st.state || 'Gujarat'}, ${st.country || 'India'}`)}</span><span>${this.esc(st.tagline || '')}</span></div></div>
      <div class="wrap nav-row">
        <a class="logo" href="index.html" aria-label="N V CERAMIC Home"><img src="assets/logo.png" alt="${this.esc(st.businessName || 'N V CERAMIC')} logo"></a>
        <button class="menu-btn" aria-label="Open menu" aria-expanded="false">☰</button>
        <nav class="main-nav" aria-label="Main navigation">
          <a href="index.html">Home</a>
          <div class="nav-dd"><button type="button">Products <span>⌄</span></button><div class="mega" id="mega-menu"></div></div>
          <div class="nav-dd"><button type="button">Applications <span>⌄</span></button><div class="dropdown simple">
            <a href="category.html?application=living-room">Living Room</a><a href="category.html?application=bathroom">Bathroom</a><a href="category.html?application=kitchen">Kitchen</a><a href="category.html?application=bedroom">Bedroom</a><a href="category.html?application=parking">Parking & Outdoor</a><a href="category.html?application=hotel">Hotels & Projects</a><a href="category.html?application=commercial">Commercial</a>
          </div></div>
          <a href="projects.html">Projects</a><a href="dealer.html">Dealer</a><a href="catalogue.html">Catalogue</a><a href="blog.html">Blog</a><a href="about.html">About Us</a><a href="contact.html">Contact</a>
        </nav>
        <a class="header-wa" data-wa="Hello N V CERAMIC, I want product details." target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </header>`;
    const b = document.querySelector('.menu-btn');
    b?.addEventListener('click', () => {
      const n = document.querySelector('.main-nav');
      n.classList.toggle('open');
      b.setAttribute('aria-expanded', String(n.classList.contains('open')));
    });
    document.querySelectorAll('.nav-dd > button').forEach(x => x.addEventListener('click', () => x.parentElement.classList.toggle('open')));
  },

  buildFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const st = this.data.settings || {};
    const phone = st.phoneDisplay || st.phone || '';
    el.innerHTML = `<footer><div class="wrap footer-grid">
      <div><img src="assets/logo.png" alt="${this.esc(st.businessName || 'N V CERAMIC')} logo"><p>${this.esc(st.tagline || '')}</p></div>
      <div><b>Products</b><a href="products.html?category=CAT-001">Ceramic Tiles</a><a href="products.html?category=CAT-003">GVT Tiles</a><a href="products.html?category=CAT-007">Parking Tiles</a><a href="products.html?category=CAT-011">Table Top Basins</a></div>
      <div><b>Business</b><a href="dealer.html">Dealer</a><a href="projects.html">Projects</a><a href="catalogue.html">Catalogue</a><a href="blog.html">Blog / Knowledge Center</a></div>
      <div><b>Contact</b><span>${this.esc(st.address || `${st.city || 'Morbi'}, ${st.state || 'Gujarat'}, ${st.country || 'India'}`)}</span>${phone ? `<a href="tel:+${String(st.phone || phone).replace(/\D/g, '')}">${this.esc(phone)}</a>` : ''}${st.email ? `<a href="mailto:${this.esc(st.email)}">${this.esc(st.email)}</a>` : ''}<a data-wa="Hello N V CERAMIC">WhatsApp</a></div>
    </div><div class="copyright">© ${this.esc(st.copyrightYear || '2026')} ${this.esc(st.businessName || 'N V CERAMIC')}. All rights reserved.</div></footer>`;
  },

  buildMega() {
    const el = document.getElementById('mega-menu');
    if (!el) return;
    const tiles = this.data.categories.filter(x => x.group === 'Tiles');
    const san = this.data.categories.filter(x => x.group === 'Sanitaryware');
    const col = (title, items) => `<div class="mega-col"><h4>${this.esc(title)}</h4>${items.map(x => `<a href="products.html?category=${encodeURIComponent(x.id)}">${this.esc(x.name)}</a>`).join('')}</div>`;
    el.innerHTML = col('Tiles', tiles.slice(0, 6)) + col('Tiles — More', tiles.slice(6)) + col('Sanitaryware', san) + col('Shop by', ['Living Room','Bathroom','Kitchen','Parking & Outdoor','Hotels & Projects'].map((name, i) => ({ id:['living-room','bathroom','kitchen','parking','hotel'][i], name })));
  },

  bindWA() {
    document.querySelectorAll('[data-wa]').forEach(a => {
      a.href = this.wa(a.getAttribute('data-wa'));
    });
  },

  productImage(p, c) {
    return p.image ? `<img src="${this.esc(this.imgUrl(p.image))}" alt="${this.esc(p.name)} - ${this.esc(c.name)}" loading="lazy">` : `<div class="placeholder">Product Photo<br>will be added here</div>`;
  },

  card(p) {
    const c = this.cat(p.categoryId);
    const firstPrice = this.price(p.priceId) || this.price((p.priceIds || [])[0]);
    let price = '';
    if (this.data.settings.showPrices && firstPrice) price = `<p><b>${this.esc(firstPrice.currency || '₹')} ${Number(firstPrice.price).toLocaleString('en-IN')}</b> ${this.esc(firstPrice.unit || '')}</p>`;
    const sizeText = p.size || (p.sizes || []).map(x => x.name).filter(Boolean).join(', ');
    const finishText = p.finish || (p.finishes || []).map(x => x.name).filter(Boolean).join(', ');
    return `<article class="product-card"><a href="product.html?id=${encodeURIComponent(p.id)}"><div class="product-image">${p.new ? '<span class="badge">NEW</span>' : ''}${this.productImage(p,c)}</div></a><div class="product-body"><h3>${this.esc(p.name)}</h3><div class="meta">${this.esc(c.name || '')}${sizeText ? ' • ' + this.esc(sizeText) : ''}</div>${finishText ? `<div class="meta">Finish: ${this.esc(finishText)}</div>` : ''}${price}<p>${this.esc(p.description || '')}</p><div class="product-actions"><a href="product.html?id=${encodeURIComponent(p.id)}">View Details</a><a class="secondary" href="${this.esc(this.wa('Hello N V CERAMIC, I want details for: ' + p.name + (sizeText ? ' | Size: ' + sizeText : '')))}" target="_blank" rel="noopener">WhatsApp</a></div></div></article>`;
  },

  applySettings() {
    const st = this.data.settings || {};
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.getAttribute('data-setting');
      if (st[key] !== undefined) el.textContent = st[key];
    });
    document.querySelectorAll('[data-setting-href]').forEach(el => {
      const key = el.getAttribute('data-setting-href');
      if (key === 'phone') {
        const n = String(st.phone || '').replace(/\D/g, '');
        if (n) el.href = 'tel:+' + n;
      }
      if (key === 'email' && st.email) el.href = 'mailto:' + st.email;
    });
  },

  route() {
    const path = location.pathname.split('/').pop();
    if (path === 'index.html' || path === '') this.home();
    if (path === 'products.html') this.products();
    if (path === 'category.html') this.category();
    if (path === 'product.html') this.product();
    if (path === 'blog.html') { if (location.search) renderSingleBlog(); else renderBlogPage(); }
  },

  home() {
    const cg = document.getElementById('home-categories');
    if (cg) cg.innerHTML = this.data.categories.slice(0, 10).map(c => `<a class="category-card" href="products.html?category=${encodeURIComponent(c.id)}"><small>${this.esc(c.group)}</small><h3>${this.esc(c.name)}</h3><p>${this.esc(c.desc)}</p></a>`).join('');
    const fp = document.getElementById('featured-products');
    if (fp) {
      const arr = this.data.products.filter(p => p.active && p.featured).slice(0, 6);
      fp.innerHTML = arr.length ? arr.map(p => this.card(p)).join('') : '<div class="empty">Add your real products in the Google Sheet master to show them here.</div>';
    }
    const hb = document.getElementById('home-blogs');
    if (hb) {
      const blogs = (this.data.blogs || []).slice(0, 3);
      hb.innerHTML = blogs.length ? blogs.map(b => `<article class="blog-card"><div class="blog-card-body"><div class="eyebrow">${this.esc(b.category || 'Guide')}</div><h3>${this.esc(b.title || '')}</h3><p>${this.esc(b.shortDescription || '')}</p><a class="btn btn-outline" href="blog.html?slug=${encodeURIComponent(b.slug)}">Read Guide</a></div></article>`).join('') : '<div class="empty">Useful buying guides will appear here.</div>';
    }
    const s = document.getElementById('home-search'), b = document.getElementById('home-search-btn');
    b?.addEventListener('click', () => { if (s.value.trim()) location.href = 'products.html?q=' + encodeURIComponent(s.value.trim()); });
    s?.addEventListener('keydown', e => { if (e.key === 'Enter') b.click(); });
  },

  products() {
    const cats = this.data.categories, prods = this.data.products.filter(p => p.active);
    const cf = document.getElementById('category-filter'), ff = document.getElementById('finish-filter'), sf = document.getElementById('size-filter');
    if (cf) cf.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${this.esc(c.id)}">${this.esc(c.name)}</option>`).join('');
    const finishes = [...new Set(prods.flatMap(p => (p.finishes || []).map(x => x.name)).concat(prods.map(p => p.finish || '')).filter(Boolean))].sort();
    const sizes = [...new Set(prods.flatMap(p => (p.sizes || []).map(x => x.name)).concat(prods.map(p => p.size || '')).filter(Boolean))].sort();
    if (ff) ff.innerHTML = '<option value="">All Finishes</option>' + finishes.map(x => `<option>${this.esc(x)}</option>`).join('');
    if (sf) sf.innerHTML = '<option value="">All Sizes</option>' + sizes.map(x => `<option>${this.esc(x)}</option>`).join('');
    const params = new URLSearchParams(location.search);
    if (cf) cf.value = params.get('category') || '';
    if (document.getElementById('product-search')) document.getElementById('product-search').value = params.get('q') || '';
    const render = () => {
      let a = prods;
      const q = (document.getElementById('product-search')?.value || '').toLowerCase().trim();
      const cat = cf?.value || '', fin = ff?.value || '', size = sf?.value || '';
      a = a.filter(p => !q || [p.name,p.size,p.finish,p.application,p.description,this.cat(p.categoryId).name,(p.sizes||[]).map(x=>x.name).join(' '),(p.finishes||[]).map(x=>x.name).join(' ')].join(' ').toLowerCase().includes(q))
        .filter(p => !cat || p.categoryId === cat)
        .filter(p => !fin || [p.finish,...(p.finishes||[]).map(x=>x.name)].includes(fin))
        .filter(p => !size || [p.size,...(p.sizes||[]).map(x=>x.name)].includes(size));
      document.getElementById('results-meta').textContent = a.length + ' product' + (a.length === 1 ? '' : 's') + ' found';
      document.getElementById('all-products').innerHTML = a.length ? a.map(p => this.card(p)).join('') : '<div class="empty">No matching products yet. Try another search or ask us on WhatsApp.</div>';
    };
    [document.getElementById('product-search'), cf, ff, sf].forEach(x => x?.addEventListener('input', render));
    render();
  },

  category() {
    const params = new URLSearchParams(location.search), cid = params.get('category'), app = params.get('application');
    let title = '', desc = '', arr = this.data.products.filter(p => p.active);
    if (cid) { const c = this.cat(cid); title = c.name; desc = c.desc; arr = arr.filter(p => p.categoryId === cid); }
    else if (app) { title = app.replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase()) + ' Products'; desc = 'Explore products suitable for ' + title.toLowerCase() + '.'; arr = arr.filter(p => (p.application || '').toLowerCase().includes(app.replace(/-/g,' '))); }
    document.title = (title || 'Products') + ' | N V CERAMIC';
    document.getElementById('cat-title').textContent = title || 'Products';
    document.getElementById('cat-desc').textContent = desc;
    document.getElementById('cat-products').innerHTML = arr.length ? arr.map(p => this.card(p)).join('') : '<div class="empty">No products have been added for this category yet.</div>';
    document.getElementById('cat-content').textContent = 'Choose a product to view its size, finish, application, description and WhatsApp enquiry option.';
  },

  product() {
    const id = new URLSearchParams(location.search).get('id');
    const p = this.data.products.find(x => x.id === id);
    const el = document.getElementById('product-detail');
    if (!el) return;
    if (!p) { el.innerHTML = '<div class="empty">Product not found. Please return to Products.</div>'; return; }
    const c = this.cat(p.categoryId), pr = this.price(p.priceId) || this.price((p.priceIds || [])[0]);
    document.title = p.name + ' | N V CERAMIC';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', (p.description || p.name) + ' N V CERAMIC, Morbi, Gujarat.');
    const image = this.productImage(p,c);
    const price = this.data.settings.showPrices && pr ? `<div class="price-box"><b>${this.esc(pr.currency || '₹')} ${Number(pr.price).toLocaleString('en-IN')}</b> ${this.esc(pr.unit || '')}</div>` : '<div class="price-box"><b>Get Latest Price</b></div>';
    const sizeRows = (p.sizes || []).map(s => `<tr><td>${this.esc(s.name || '')}</td><td>${this.esc(s.inch || '')}</td><td>${this.esc(s.cm || '')}</td><td>${this.esc(s.pcsBox || '')}</td><td>${this.esc(s.sqftBox || '')}</td><td>${this.esc(s.sqmtrBox || '')}</td></tr>`).join('');
    const finishText = (p.finishes || []).map(x => x.name).filter(Boolean).join(', ') || p.finish || 'As per model';
    const appText = (p.applications || []).map(x => x.name).filter(Boolean).join(', ') || p.application || 'Residential & Commercial';
    const sizeText = (p.sizes || []).map(x => x.name).filter(Boolean).join(', ') || p.size || 'As per model';
    el.innerHTML = `<div class="detail-grid"><div class="detail-image">${image}</div><div><span class="eyebrow">${this.esc(c.name || 'PRODUCT')}</span><h1 class="detail-title">${this.esc(p.name)}</h1><p>${this.esc(p.description || '')}</p>${price}<div class="spec-list"><div class="spec"><small>Size</small><b>${this.esc(sizeText)}</b></div><div class="spec"><small>Finish</small><b>${this.esc(finishText)}</b></div><div class="spec"><small>Application</small><b>${this.esc(appText)}</b></div><div class="spec"><small>Category</small><b>${this.esc(c.name || '')}</b></div></div><a class="btn primary" href="${this.esc(this.wa('Hello N V CERAMIC, I want details for: ' + p.name + (sizeText ? ' | Size: ' + sizeText : '')))}" target="_blank" rel="noopener">WhatsApp Enquiry</a></div></div>${sizeRows ? `<section class="variant-section"><h2>Available Sizes & Packing</h2><div class="table-wrap"><table><thead><tr><th>Size</th><th>Inch</th><th>CM</th><th>Pcs/Box</th><th>Sqft/Box</th><th>Sqmtr/Box</th></tr></thead><tbody>${sizeRows}</tbody></table></div></section>` : ''}`;
    const related = this.data.products.filter(x => x.active && x.categoryId === p.categoryId && x.id !== p.id).slice(0, 3);
    const rp = document.getElementById('related-products');
    if (rp) rp.innerHTML = related.length ? related.map(x => this.card(x)).join('') : '<div class="empty">More products can be added to this category from the master sheet.</div>';
    const schema = { '@context':'https://schema.org', '@type':'Product', name:p.name, description:p.description || '', category:c.name || '', image:p.image ? [this.imgUrl(p.image)] : [] };
    if (this.data.settings.showPrices && pr) schema.offers = { '@type':'Offer', priceCurrency:pr.currency || 'INR', price:String(pr.price), availability:'https://schema.org/InStock' };
    const s = document.createElement('script'); s.type='application/ld+json'; s.textContent=JSON.stringify(schema); document.head.appendChild(s);
  },

  orgSchema() {
    const s = document.getElementById('org-schema');
    if (!s) return;
    const st = this.data.settings || {};
    s.textContent = JSON.stringify({ '@context':'https://schema.org', '@type':'Organization', name:st.businessName || 'N V CERAMIC', description:st.tagline || '', url:location.origin, logo:location.origin+'/assets/logo.png', address:{ '@type':'PostalAddress', addressLocality:st.city || 'Morbi', addressRegion:st.state || 'Gujarat', addressCountry:'IN' }, telephone:st.phone ? '+91 '+String(st.phone).replace(/\D/g,'').slice(-10) : undefined });
  }
};

function renderBlogPage() {
  const root = document.getElementById('app');
  if (!root) return;
  const blogs = (NVC.data.blogs || []).filter(b => String(b.status || 'published').toLowerCase() === 'published');
  const categories = [...new Set(blogs.map(b => b.category).filter(Boolean))];
  root.innerHTML = `<section class="page-hero"><div class="wrap"><span class="eyebrow">KNOWLEDGE CENTER</span><h1>Tile & Sanitaryware Guides</h1><p>Practical buying guides for homeowners, dealers, builders, architects and project buyers.</p></div></section><section class="section"><div class="wrap"><div class="blog-toolbar"><div><b>${blogs.length}</b> published guide${blogs.length === 1 ? '' : 's'}</div><div class="blog-filters"><button class="blog-filter active" data-category="">All</button>${categories.map(c => `<button class="blog-filter" data-category="${NVC.esc(c)}">${NVC.esc(c)}</button>`).join('')}</div></div><div class="blog-grid" id="blog-list"></div></div></section>`;
  const list = document.getElementById('blog-list');
  const render = category => {
    const items = category ? blogs.filter(b => b.category === category) : blogs;
    list.innerHTML = items.length ? items.map(b => `<article class="blog-card"><div class="blog-card-body"><div class="eyebrow">${NVC.esc(b.category || 'Guide')}</div><h2>${NVC.esc(b.title || '')}</h2><p>${NVC.esc(b.shortDescription || '')}</p><div class="blog-meta">${NVC.esc(b.author || 'N V CERAMIC')}${b.publishedDate ? ' • ' + NVC.esc(String(b.publishedDate).slice(0,10)) : ''}</div><a class="btn btn-outline" href="blog.html?slug=${encodeURIComponent(b.slug)}">Read Article →</a></div></article>`).join('') : '<div class="empty">No guides in this category yet.</div>';
  };
  render('');
  root.querySelectorAll('.blog-filter').forEach(btn => btn.addEventListener('click', () => { root.querySelectorAll('.blog-filter').forEach(x => x.classList.remove('active')); btn.classList.add('active'); render(btn.dataset.category || ''); }));
}

function renderSingleBlog() {
  const slug = new URLSearchParams(location.search).get('slug');
  const b = (NVC.data.blogs || []).find(x => x.slug === slug);
  const root = document.getElementById('app');
  if (!root) return;
  if (!b) { root.innerHTML = '<section class="section"><div class="wrap"><div class="empty"><h1>Article not found</h1><a class="btn primary" href="blog.html">Back to Blog</a></div></div></section>'; return; }
  const related = (b.relatedProductIds || []).map(id => (NVC.data.products || []).find(p => p.id === id)).filter(Boolean);
  document.title = b.seoTitle || b.title || 'Blog | N V CERAMIC';
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', b.metaDescription || b.shortDescription || 'N V CERAMIC buying guide.');
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = new URL('blog.html?slug=' + encodeURIComponent(b.slug), location.href).href;
  const articleSchema = { '@context':'https://schema.org', '@type':'Article', headline:b.title, description:b.metaDescription || b.shortDescription || '', datePublished:b.publishedDate || undefined, author:{ '@type':'Organization', name:b.author || 'N V CERAMIC' }, publisher:{ '@type':'Organization', name:'N V CERAMIC' }, mainEntityOfPage:location.href };
  const old = document.getElementById('blog-schema'); if (old) old.remove();
  const schema = document.createElement('script'); schema.id='blog-schema'; schema.type='application/ld+json'; schema.textContent=JSON.stringify(articleSchema); document.head.appendChild(schema);
  root.innerHTML = `<section class="section"><div class="wrap article"><a class="back-link" href="blog.html">← All Guides</a><div class="eyebrow">${NVC.esc(b.category || 'Guide')}</div><h1>${NVC.esc(b.title)}</h1><p class="lead">${NVC.esc(b.shortDescription || '')}</p><div class="blog-meta">${NVC.esc(b.author || 'N V CERAMIC')}${b.publishedDate ? ' • ' + NVC.esc(String(b.publishedDate).slice(0,10)) : ''}</div>${b.image ? `<img class="article-hero" src="${NVC.esc(NVC.imgUrl(b.image))}" alt="${NVC.esc(b.title)}" loading="lazy">` : ''}<div class="article-content">${formatBlogContent(b.content || '')}</div>${related.length ? `<h2>Related Products</h2><div class="product-grid">${related.map(p => NVC.card(p)).join('')}</div>` : ''}<div class="article-cta"><h3>Need help selecting the right product?</h3><p>Send your size, application, quantity or project requirement.</p><a class="btn primary" href="${NVC.esc(NVC.wa('Hello N V CERAMIC, I read your guide: ' + b.title + '. Please help me with product selection.'))}" target="_blank" rel="noopener">Ask on WhatsApp</a></div></div></section>`;
}

function formatBlogContent(s) {
  return NVC.esc(s).split(/\n\s*\n/).filter(Boolean).map(x => `<p>${x.replace(/\n/g,'<br>')}</p>`).join('');
}

NVC.init().then(() => document.dispatchEvent(new Event('nvc-ready')));
