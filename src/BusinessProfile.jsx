import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import './profile.css';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Globe, Instagram, MapPin, MessageCircle, Phone, Share2, ShieldCheck, ShoppingBag, Store } from 'lucide-react';

export default function BusinessProfile({ id, onBack }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDoc(doc(db, 'businesses', id)).then(snap => {
      if (alive) setBusiness(snap.exists() && snap.data().status === 'approved' ? { id:snap.id, ...snap.data() } : null);
    }).catch(error => {
      console.error('Could not load business profile:', error);
      if (alive) setBusiness(null);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) return <main className="profile-state"><div className="profile-spinner"/>Loading business profile…</main>;
  if (!business) return <main className="profile-state"><Store size={30}/><h1>Business not found</h1><p>This listing may have been removed or is not currently approved.</p><button className="btn btn-dark" onClick={onBack}><ArrowLeft size={16}/> Back to directory</button></main>;

  const phone = String(business.whatsapp || '').replace(/\D/g, '').replace(/^0/, '234');
  const contactUrl = phone ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent('Hello ' + business.name + ', I found your business on NaijaShelf and would like to make an enquiry.') : '';
  const shareProfile = async () => {
    const data = { title: business.name + ' | NaijaShelf', text: 'Discover ' + business.name + ' on NaijaShelf.', url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(window.location.href); alert('Profile link copied.'); }
    } catch (error) { if (error.name !== 'AbortError') alert('Could not share this profile on this device.'); }
  };
  const website = business.website ? (/^https?:\/\//i.test(business.website) ? business.website : 'https://' + business.website) : '';
  const instagram = business.instagram ? (business.instagram.startsWith('http') ? business.instagram : 'https://instagram.com/' + business.instagram.replace(/^@/, '')) : '';

  return <main className="business-profile-page">
    <header className="profile-header">
      <button className="profile-back" onClick={onBack}><ArrowLeft size={17}/> Back to directory</button>
      <a className="brand" href="/" onClick={e=>{e.preventDefault();onBack()}}><span className="brand-mark"><Store size={19}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a>
      <button className="profile-share" onClick={shareProfile}><Share2 size={16}/> Share</button>
    </header>
    <section className="profile-cover">
      {business.coverImage ? <img src={business.coverImage} alt={business.name + ' cover'}/> : <div className="profile-cover-art"><span>{(business.name || 'NS').slice(0,2).toUpperCase()}</span></div>}
      <div className="profile-identity">
        <div className="profile-logo">{business.logoUrl ? <img src={business.logoUrl} alt={business.name + ' logo'}/> : (business.name || 'NS').slice(0,2).toUpperCase()}</div>
        <div className="profile-title"><span className="profile-approved"><BadgeCheck size={13}/> APPROVED LISTING</span><h1>{business.name}</h1><p>{business.category || 'Local business'}{(business.location || business.city) ? ' · ' + (business.location || business.city) : ''}</p></div>
      </div>
    </section>
    <div className="profile-layout">
      <section className="profile-main-content">
        <article className="profile-panel"><span className="profile-kicker">ABOUT THE BUSINESS</span><h2>Get to know {business.name}</h2><p>{business.description || 'Discover this local business on NaijaShelf. Contact the seller directly to learn more about its products and services.'}</p></article>
        <article className="profile-panel"><span className="profile-kicker">WHAT THEY OFFER</span><h2>Products & services</h2>
          {Array.isArray(business.products) && business.products.length ? <div className="profile-products">{business.products.map((product,index)=><span key={index}><ShoppingBag size={15}/>{typeof product === 'string' ? product : product.name || product.title || 'Offering'}</span>)}</div> : <p>Contact the business to ask about available products and services.</p>}
        </article>
        <article className="profile-panel"><span className="profile-kicker">FIND THE BUSINESS</span><h2>Location</h2><p className="profile-location"><MapPin size={17}/>{business.address || business.location || business.city || 'Location not provided'}</p></article>
      </section>
      <aside className="profile-sidebar"><div className="profile-contact-card"><span className="profile-kicker">CONNECT WITH THE SELLER</span><h2>Ready to make an enquiry?</h2><p>Contact the business directly to ask questions, check availability or learn more.</p>
        {contactUrl ? <a className="profile-whatsapp" href={contactUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Chat on WhatsApp <ArrowUpRight size={16}/></a> : <p className="profile-muted">WhatsApp contact has not been provided.</p>}
        {business.phone && <a className="profile-secondary-contact" href={'tel:' + business.phone}><Phone size={16}/> Call business</a>}
        {website && <a className="profile-secondary-contact" href={website} target="_blank" rel="noopener noreferrer"><Globe size={16}/> Visit website</a>}
        {instagram && <a className="profile-secondary-contact" href={instagram} target="_blank" rel="noopener noreferrer"><Instagram size={16}/> Instagram</a>}
        <button className="profile-share-wide" onClick={shareProfile}><Share2 size={16}/> Share this business</button>
      </div><p className="profile-trust"><ShieldCheck size={15}/> This business has been approved for the NaijaShelf directory.</p></aside>
    </div>
    <footer className="profile-footer"><a className="brand" href="/" onClick={e=>{e.preventDefault();onBack()}}><span className="brand-mark"><Store size={17}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a><span>Helping great local businesses get discovered.</span></footer>
  </main>;
}
