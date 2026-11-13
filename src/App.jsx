import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, onSnapshot, query as firestoreQuery, where, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import BusinessProfile from './BusinessProfile.jsx';
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, CircleHelp, Compass, Menu, Search, ShieldCheck, ShoppingBag, Store, X, Zap, MessageCircle, MapPin } from 'lucide-react';

const categories = ['All businesses', 'Fashion', 'Food & groceries', 'Beauty', 'Home & living', 'Services'];
const listings = [
  { id:1, name:'The Everyday Edit', category:'Fashion', location:'Lagos', tag:'Everyday fashion', description:'Easy-to-style pieces for work, weekends and everything between.', initials:'EE', color:'peach', products:['Ready-to-wear','Bags & accessories'], demo:true },
  { id:2, name:'Oven & Crumb', category:'Food & groceries', location:'Abuja', tag:'Freshly baked', description:'Small-batch treats, celebration cakes and thoughtful dessert boxes.', initials:'OC', color:'cream', products:['Celebration cakes','Pastries'], demo:true },
  { id:3, name:'Naya Skin Studio', category:'Beauty', location:'Port Harcourt', tag:'Beauty & care', description:'A considered edit of everyday skincare and self-care essentials.', initials:'NS', color:'lilac', products:['Skin essentials','Self-care sets'], demo:true },
  { id:4, name:'Form & Function', category:'Home & living', location:'Ibadan', tag:'Made for home', description:'Useful, beautiful pieces that make everyday spaces feel considered.', initials:'FF', color:'sage', products:['Home accessories','Soft furnishings'], demo:true },
  { id:5, name:'PixelCraft Studio', category:'Services', location:'Lagos', tag:'Creative services', description:'Brand identity, social content and simple digital experiences for growing teams.', initials:'PC', color:'blue', products:['Brand design','Web design'], demo:true },
  { id:6, name:'Thread Theory', category:'Fashion', location:'Enugu', tag:'Made with detail', description:'Modern staples and custom pieces with a personal touch.', initials:'TT', color:'yellow', products:['Custom outfits','Ready-to-wear'], demo:true }
];

const BUSINESS_WHATSAPP = '2348021289677';
const waLink = (message) => `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`;
const sellerWaLink = (phone, businessName) => {
  const number = String(phone || '').replace(/\D/g, '').replace(/^0/, '234');
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(`Hello ${businessName || 'there'}, I found your business on NaijaShelf and would like to make an enquiry.`)}` : '';
};

function App() {
const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get('query') || '');
const [selectedLocation, setSelectedLocation] = useState('All locations');
const [sortBy, setSortBy] = useState('newest');
  const [active, setActive] = useState('All businesses');
 
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({business:'', owner:'', category:'Fashion', city:'', description:'', phone:''});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [published, setPublished] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [directoryRetry, setDirectoryRetry] = useState(0);
  const [profileId, setProfileId] = useState(() => window.location.pathname.match(/^\/business\/([^/]+)\/?$/)?.[1] || '');
  useEffect(() => { const sync = () => setProfileId(window.location.pathname.match(/^\/business\/([^/]+)\/?$/)?.[1] || ''); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  const openProfile = (id) => { window.history.pushState({}, '', '/business/' + encodeURIComponent(id)); setProfileId(id); window.scrollTo({top:0,behavior:'smooth'}); };
  const goHome = () => { window.history.pushState({}, '', '/'); setProfileId(''); window.scrollTo({top:0,behavior:'smooth'}); };
  useEffect(() => {
    setDirectoryLoading(true);
    setDirectoryError('');

    const unsubscribe = onSnapshot(
      firestoreQuery(
        collection(db, 'businesses'),
        where('status', '==', 'approved')
      ),
      snapshot => {
        setPublished(snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
        setDirectoryError('');
        setDirectoryLoading(false);
      },
      error => {
        console.error('Directory load failed:', error);
        setDirectoryError(
          'We could not load live business listings. Please check your connection and try again.'
        );
        setDirectoryLoading(false);
      }
    );

    return unsubscribe;
  }, [directoryRetry]);
  const liveListings = useMemo(() => published.map((item, index) => ({ id:item.id, name:item.name, ownerName:item.ownerName, whatsapp:item.whatsapp, logoUrl:item.logoUrl || '', isVerified:item.isVerified===true, category:item.category, location:item.location || item.city, tag:'Approved listing', description:item.description || 'Discover this local business and contact the seller directly.', initials:(item.name || 'NS').slice(0,2).toUpperCase(), color:['peach','cream','lilac','sage','blue','yellow'][index % 6], products:item.products || [],
createdAt:item.createdAt,
demo:false })), [published]);

 const locations = useMemo(() => [
  'All locations',
  ...new Set(
    [...liveListings, ...listings]
      .map(item => item.location?.trim())
      .filter(Boolean)
  )
].sort((a, b) =>
  a === 'All locations' ? -1 :
  b === 'All locations' ? 1 :
  a.localeCompare(b)
), [liveListings]);

const filtered = useMemo(() => {
  let results = [...liveListings, ...listings].filter(item => {
    const matchesCategory =
      active === 'All businesses' || item.category === active;

    const matchesSearch =
      (item.name + item.category + item.location + item.description)
        .toLowerCase()
        .includes(query.toLowerCase());

    const matchesLocation =
      selectedLocation === 'All locations' ||
      (item.location || '').toLowerCase() === selectedLocation.toLowerCase();

    return matchesCategory && matchesSearch && matchesLocation;
  });

  results.sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'newest') {
      return (b.createdAt?.toMillis?.() || 0) -
        (a.createdAt?.toMillis?.() || 0);
    }

    return 0;
  });

  return results;
}, [active, query, liveListings, selectedLocation, sortBy]);


  const submit = async (e) => {
    e.preventDefault();
    const businessName = form.business.trim();
    const ownerName = form.owner.trim();
    const city = form.city.trim();
    const description = form.description.trim();
    const phoneDigits = form.phone.replace(/\D/g, '');

    if (businessName.length < 2 || ownerName.length < 2 || city.length < 2) {
      setSubmitError('Please enter a valid business name, your name and city (at least 2 characters each).');
      return;
    }
    if (businessName.length > 100 || ownerName.length > 100 || city.length > 80) {
      setSubmitError('One or more fields are too long. Please shorten your details and try again.');
      return;
    }
    if (description.length < 20 || description.length > 600) {
      setSubmitError('Please describe your business in 20 to 600 characters so customers understand what you offer.');
      return;
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setSubmitError('Enter a valid WhatsApp number with 10 to 15 digits, including the country code when needed.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await addDoc(collection(db, 'sellerSubmissions'), {
        businessName,
        ownerName,
        category: form.category,
        city,
        description,
        whatsapp: form.phone.trim(),
        status: 'pending',
        source: 'website',
        createdAt: serverTimestamp()
      });
      const message = `Hello NaijaShelf! I've submitted my listing request. Business: ${businessName}. Owner: ${ownerName}. Category: ${form.category}. City: ${city}. Description: ${description}. WhatsApp: ${form.phone.trim()}. Please share the next steps and pricing.`;
      window.open(waLink(message), '_blank', 'noopener,noreferrer');
      setSent(true);
    } catch (error) {
      console.error('Seller submission failed:', error);
      setSubmitError('We could not save your request. Please check your connection and try again, or contact us on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  if (profileId) return <BusinessProfile id={profileId} onBack={goHome}/>;

  return <div className="site-shell">
    <div className="announcement"><span className="announce-dot" /> Founding seller programme is open <a href="#pricing">See how it works <ArrowUpRight size={13}/></a></div>
    <header className="header">
      <a className="brand" href="#" aria-label="NaijaShelf home"><span className="brand-mark"><Store size={19}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a>
      <nav id="primary-navigation" aria-label="Main navigation" className={menuOpen ? 'nav nav-open' : 'nav'}>
        <a href="#discover" onClick={()=>setMenuOpen(false)}>Explore businesses</a>
        <a href="#how" onClick={()=>setMenuOpen(false)}>How it works</a>
        <a href="#pricing" onClick={()=>setMenuOpen(false)}>For sellers</a>
        <a href="#faq" onClick={()=>setMenuOpen(false)}>FAQs</a>
      </nav>
      <div className="header-actions"><a className="login-link" href="#pricing">For business owners</a><button className="btn btn-dark btn-small" onClick={()=>setModal(true)}>List your business <ArrowUpRight size={15}/></button></div>
      <button className="mobile-menu" type="button" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-controls="primary-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line"/> THE HOME OF LOCAL FINDS</div>
          <h1>Good businesses<br/>deserve to be <em>found.</em></h1>
          <p className="hero-sub">Discover independent Nigerian businesses, find something you love and connect directly with the people behind it.</p>
          <div className="hero-search">
            <Search size={19}/><input value={query} onChange={e=>{setQuery(e.target.value);document.getElementById('discover')?.scrollIntoView({behavior:'smooth'});}} placeholder="What are you looking for today?" aria-label="Search businesses"/><button onClick={()=>document.getElementById('discover')?.scrollIntoView({behavior:'smooth'})}>Explore <ArrowRight size={16}/></button>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><span>✦</span><span>✿</span><span>◈</span></div><span>Built for the people building Nigeria.</span><span className="proof-sep">·</span><span className="proof-muted">Made for mobile</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of a local shop and shopping bag">
          <div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/>
          <div className="art-note note-top"><span className="note-icon"><BadgeCheck size={16}/></span><span><b>Local finds</b><small>Worth discovering</small></span></div>

          <div className="shop-illustration">
            <div className="shop-sun"/><div className="shop-roof"><span/><span/><span/><span/><span/></div>
            <div className="shop-body"><div className="shop-sign">YOUR NEXT<br/><b>FAVOURITE</b><br/>IS HERE.</div><div className="shop-window"><div className="window-shelf"/><div className="window-pot"/><div className="window-box"/></div><div className="shop-door"/></div>
            <div className="shop-base"/>
          </div>
          <div className="art-note note-bottom"><span className="bag-icon"><ShoppingBag size={18}/></span><span><b>Shop independent</b><small>Support local makers</small></span></div>
          <span className="art-spark spark-a">✳</span><span className="art-spark spark-b">✦</span>
        </div>

      </section>

      <section className="trust-strip"><div><ShieldCheck size={17}/><span>Connect directly with sellers</span></div><span className="strip-divider"/><div><Zap size={17}/><span>Simple, mobile-first shopping</span></div><span className="strip-divider"/><div><Compass size={17}/><span>Discover businesses near you</span></div></section>

      <section className="discover section" id="discover">
        <div className="section-top"><div><div className="eyebrow">A LITTLE CLOSER TO HOME</div><h2>Find your next <em>favourite.</em></h2><p className="section-sub">Explore the people, products and services making things happen.</p></div><a className="text-link" href="#seller">Own a business? Get discovered <ArrowUpRight size={16}/></a></div>
        <div className="category-row">{categories.map(cat=><button key={cat} className={active===cat?'category active':'category'} onClick={()=>setActive(cat)}>{cat}</button>)}</div>

<div className="discovery-controls">
  <select
    value={selectedLocation}
    onChange={e => setSelectedLocation(e.target.value)}
  >
    {locations.map(location => (
      <option key={location} value={location}>
        {location}
      </option>
    ))}
  </select>

  <select
    value={sortBy}
    onChange={e => setSortBy(e.target.value)}
  >
    <option value="newest">Newest first</option>
    <option value="alphabetical">Alphabetical (A–Z)</option>
  </select>
</div>
        
{directoryLoading && (
  <p className="directory-status" role="status" aria-live="polite">
    Loading approved business listings…
  </p>
)}

{directoryError && (
  <div className="directory-error" role="alert">
    <span>{directoryError}</span>
    <button
      type="button"
      onClick={() => setDirectoryRetry(value => value + 1)}
    >
      Try again
    </button>
  </div>
)}

<div className="discovery-results" aria-live="polite">
  <span>
    Showing {filtered.length} {filtered.length === 1 ? 'business' : 'businesses'}
    {!directoryLoading && ` · ${published.length} approved listings`}
  </span>

  <button
    className="clear-filters-btn"
    onClick={() => {
      setQuery('');
      setActive('All businesses');
      setSelectedLocation('All locations');
      setSortBy('newest');
    }}
  >
    Clear all filters
  </button>
</div>

        <div className="business-grid">{filtered.map(item=><article className="business-card" key={item.id}>
          <div className={`card-art ${item.color}`}>{item.logoUrl ? <img className="business-card-logo" src={item.logoUrl} alt={item.name + ' logo'} loading="lazy" decoding="async"/> : <span className="card-monogram">{item.initials}</span>}<span className="card-tag">{item.tag}</span>{item.demo ? <span className="card-demo">SAMPLE</span> : <span className="card-demo">APPROVED</span>}</div>
          <div className="card-content">
            <div className="card-meta"><span>{item.category}</span>{item.location && <><span className="meta-dot">·</span><MapPin size={12}/><span>{item.location}</span></>}{item.isVerified && <span className="verified-chip"><BadgeCheck size={12}/> Verified</span>}</div>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            {item.products.length > 0 && <div className="product-tags">{item.products.slice(0,3).map((product,i)=><span key={i}>{product}</span>)}</div>}
            <div className="card-actions">
              {!item.demo && <button className="profile-view-link" onClick={()=>openProfile(item.id)}>View business profile <ArrowUpRight size={15}/></button>}
              {!item.demo && sellerWaLink(item.whatsapp,item.name) ? <a className="seller-contact" href={sellerWaLink(item.whatsapp,item.name)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/> WhatsApp seller</a> : <span className="preview-note">{item.demo ? 'Preview listing' : 'Contact details unavailable'}</span>}
            </div>
          </div>
        </article>)}</div>
        {filtered.length===0 && !directoryLoading && !directoryError && <div className="empty-state"><Search size={25}/><h3>No matches just yet</h3><p>Try another search or category.</p><button className="btn btn-outline" onClick={()=>{setQuery('');setActive('All businesses');setSelectedLocation('All locations');setSortBy('newest')}}>Clear filters</button></div>}
        <div className="directory-note"><CircleHelp size={16}/> Sample cards are illustrative previews. Approved seller applications appear here as real business listings.</div>
      </section>

      <section className="seller-band" id="seller"><div className="seller-copy"><div className="eyebrow eyebrow-light">FOR THE PEOPLE WHO MAKE IT HAPPEN</div><h2>Your business has a story.<br/><em>Let's get it seen.</em></h2><p>Give customers one simple place to discover what you do, browse what you offer and reach you on WhatsApp. No complicated setup. No big-agency price tag.</p><button className="btn btn-cream" onClick={()=>setModal(true)}>Get your business listed <ArrowRight size={17}/></button><span className="seller-caption">Founding seller spots are now open.</span></div><div className="seller-visual"><div className="seller-card"><div className="seller-card-top"><span className="mini-logo">n.</span><span className="live-pill"><i/> YOUR STORE, ONLINE</span></div><div className="seller-card-image"><span>Made with<br/><b>intention.</b></span><div className="seller-shape"/></div><div className="seller-card-bottom"><span><b>Your brand.</b><small>Your products. Your people.</small></span><span className="seller-cart"><ShoppingBag size={18}/></span></div></div><div className="seller-sticker">YOUR LINK.<br/>YOUR STORY.<br/>YOUR SALES.</div></div></section>

      <section className="how section" id="how"><div className="section-top centered"><div className="eyebrow">NO TECH HEADACHES</div><h2>From “I sell on WhatsApp”<br/>to <em>easy to find.</em></h2><p className="section-sub">A simple path from discovery to a real conversation.</p></div><div className="steps"><div className="step"><span className="step-number">01</span><div className="step-icon"><Store/></div><h3>Tell us about your business</h3><p>Share your business name, what you offer and where customers can find you.</p></div><div className="step"><span className="step-number">02</span><div className="step-icon"><ShoppingBag/></div><h3>Get your online shelf</h3><p>We help you put together a clean, shareable business profile with your products or services.</p></div><div className="step"><span className="step-number">03</span><div className="step-icon"><ArrowUpRight/></div><h3>Share it. Get discovered.</h3><p>Put your link on WhatsApp, Instagram and everywhere your customers already are.</p></div></div></section>

      <section className="pricing section" id="pricing"><div className="section-top"><div><div className="eyebrow">STRAIGHTFORWARD BY DESIGN</div><h2>Start simple.<br/><em>Grow from there.</em></h2><p className="section-sub">A fair starting point for businesses at every stage.</p></div><span className="pricing-note">Founding member pricing<br/>for our first sellers</span></div><div className="price-grid">
        <article className="price-card"><span className="plan-name">STARTER</span><h3>Get discovered</h3><div className="price">Free<span> / forever</span></div><p>For small businesses ready to get online.</p><ul><li><Check/> Business profile</li><li><Check/> Contact and WhatsApp link</li><li><Check/> Listed in discovery</li><li><Check/> Basic business details</li></ul><button className="btn btn-outline full" onClick={()=>setModal(true)}>Join the free list <ArrowRight size={16}/></button></article>
        <article className="price-card featured"><span className="popular">MOST POPULAR</span><span className="plan-name">GROW</span><h3>Look the part</h3><div className="price">₦3,500<span> / month*</span></div><p>For businesses ready to build trust and grow.</p><ul><li><Check/> Everything in Starter</li><li><Check/> Featured storefront</li><li><Check/> Up to 30 product or service items</li><li><Check/> Priority discovery placement</li><li><Check/> Monthly profile insights</li></ul><button className="btn btn-dark full" onClick={()=>setModal(true)}>Join the founding programme <ArrowRight size={16}/></button></article>
        <article className="price-card"><span className="plan-name">PRO</span><h3>Make more moves</h3><div className="price">₦8,500<span> / month*</span></div><p>For growing brands that need more room.</p><ul><li><Check/> Everything in Grow</li><li><Check/> More product listings</li><li><Check/> Custom profile styling</li><li><Check/> Campaign and promo slots</li><li><Check/> Priority support</li></ul><button className="btn btn-outline full" onClick={()=>setModal(true)}>Talk about Pro <ArrowRight size={16}/></button></article>
      </div><p className="pricing-footnote">*Proposed introductory pricing, subject to confirmation during the beta. No payment is collected for the first 50 businesses on this website. We'll confirm the plan and payment method with you before activation.</p></section>

      <section className="faq section" id="faq"><div><div className="eyebrow">GOOD TO KNOW</div><h2>A few things<br/><em>you might ask.</em></h2></div><div className="faq-list"><details><summary>How can NaijaShelf grow my business? <ChevronDown/></summary><p>NaijaShelf gives your business a public profile customers can discover and share. People can learn what you offer, see your location and contact you directly. It can create more opportunities for enquiries, although sales are never guaranteed.</p></details><details><summary>How can customers see or find my products or services? <ChevronDown/></summary><p>Your business appears in the directory under its category and location. Add a clear description and list your products or services in your profile so customers can find you through browsing and search. You can also share your profile link on WhatsApp and social media.</p></details><details><summary>Can NaijaShelf boost my online presence? <ChevronDown/></summary><p>Yes. Your approved business gets a public, shareable page with your description, products or services, location and contact links. Share that page wherever you promote your business. Being listed does not guarantee search-engine rankings or customer sales.</p></details><details><summary>Is NaijaShelf a marketplace where I pay online? <ChevronDown/></summary><p>Not yet. The current platform helps customers discover businesses and contact sellers directly, including through WhatsApp or phone. Online checkout is a separate feature and is not currently available on the directory.</p></details><details><summary>Do I need a website to join? <ChevronDown/></summary><p>No. NaijaShelf gives small businesses a simple public online profile without requiring them to build a separate website.</p></details><details><summary>Are the businesses shown here real? <ChevronDown/></summary><p>Cards marked SAMPLE are illustrative previews. Listings marked APPROVED are businesses whose seller applications have been reviewed and approved by NaijaShelf. Approval is not the same as independent identity verification.</p></details><details><summary>How do I get my business listed? <ChevronDown/></summary><p>Complete the listing form with your business details and a description of what you offer. We'll review your request and contact you about the next steps.</p></details></div></section>

      <section className="final-cta"><div className="cta-spark">✳</div><div className="eyebrow eyebrow-light">GOOD THINGS START SOMEWHERE</div><h2>Let's make local<br/><em>the first choice.</em></h2><p>Find the people behind the products. Give great businesses a place to shine.</p><div className="cta-actions"><a className="btn btn-cream" href="#discover">Explore the directory <ArrowRight size={17}/></a><button className="btn btn-ghost" onClick={()=>setModal(true)}>I'm a business owner <ArrowUpRight size={17}/></button></div></section>
    </main>
    <footer className="footer"><a className="brand footer-brand" href="#"><span className="brand-mark"><Store size={17}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a><span className="footer-copy">A little more local, a lot more connected.</span><div className="footer-links"><a href="#discover">Explore</a><a href="#pricing">For sellers</a><a href="#faq">FAQs</a></div><span className="copyright">© {new Date().getFullYear()} NaijaShelf by abdulsalamdevhub</span></footer>

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={()=>{setModal(false);setSent(false)}} aria-label="Close"><X/></button><div className="eyebrow">LET'S GET YOU SEEN</div><h2 id="modal-title">Put your business<br/><em>on the shelf.</em></h2><p className="modal-intro">Tell us a little about your business. We'll open WhatsApp with your details so you can send your listing request.</p><form onSubmit={submit}><label>Business name<input required minLength="2" maxLength="100" value={form.business} onChange={e=>setForm({...form,business:e.target.value})} placeholder="e.g. Ada's Kitchen"/></label><label>Your name<input required minLength="2" maxLength="100" value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})} placeholder="Your full name"/></label><div className="form-row"><label>Business category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>City<input required minLength="2" maxLength="80" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="e.g. Lagos"/></label></div><label className="editor-full">Business description<textarea required minLength="20" maxLength="600" rows="4" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Tell customers what your business offers, who you serve and what makes you different…"/><small>{form.description.length}/600 characters · Minimum 20 characters</small></label><label>Business WhatsApp number<input required maxLength="20" inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+234..."/></label>{submitError && <p className="form-error" role="alert">{submitError}</p>}<button className="btn btn-dark full submit-btn" type="submit" disabled={submitting}>{submitting ? 'Saving your request…' : 'Save request & continue to WhatsApp'} <ArrowUpRight size={17}/></button><small className="privacy-note">Your details are used only to respond to your listing request. By continuing, you choose to send this message through WhatsApp.</small></form></div></div>}
  </div>
}
export default App;
