import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase.js';
import './profile.css';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Globe, Instagram, MapPin, MessageCircle, Phone, Share2, ShieldCheck, ShoppingBag, Store, Star, Clock3 } from 'lucide-react';

const dayNames = [
  ['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],
  ['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']
];
const timeLabel = value => {
  if (!value) return '';
  const parts = value.split(':');
  const hour = Number(parts[0]);
  const minute = parts[1] || '00';
  return (hour % 12 || 12) + ':' + minute + (hour >= 12 ? ' PM' : ' AM');
};

function CustomerReviews({ business }) {
  const [reviews,setReviews] = useState([]);
  const [rating,setRating] = useState(5);
  const [name,setName] = useState('');
  const [comment,setComment] = useState('');
  const [sending,setSending] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  useEffect(() => onSnapshot(
    query(collection(db,'businesses',business.id,'reviews'),where('status','==','approved')),
    snap => setReviews(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{
      const at=a.createdAt?.toMillis?.()||0, bt=b.createdAt?.toMillis?.()||0; return bt-at;
    })),
    err => { console.error('Review load failed:',err); setError('Reviews could not be loaded right now.'); }
  ),[business.id]);

  const average = useMemo(()=>reviews.length ? reviews.reduce((sum,item)=>sum+Number(item.rating||0),0)/reviews.length : 0,[reviews]);

  async function submitReview(e) {
    e.preventDefault();
    const reviewerName = name.trim();
    const reviewComment = comment.trim();

    if (reviewerName.length < 2 || reviewerName.length > 60) {
      setError('Please enter a name between 2 and 60 characters.');
      return;
    }
    if (reviewComment.length < 10 || reviewComment.length > 700) {
      setError('Your review must be between 10 and 700 characters after removing extra spaces.');
      return;
    }
    if (!/[a-z0-9]/i.test(reviewComment)) {
      setError('Please write a meaningful review before submitting.');
      return;
    }

    setSending(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser || (await signInAnonymously(auth)).user;
      const reviewRef = doc(db,'businesses',business.id,'reviews',user.uid);
      await setDoc(reviewRef,{
        uid:user.uid,
        businessId:business.id,
        businessName:business.name,
        reviewerName,
        rating:Number(rating),
        comment:reviewComment,
        status:'pending',
        createdAt:serverTimestamp()
      });
      setMessage('Thank you! Your review has been submitted and will appear after moderation.');
      setName(''); setComment(''); setRating(5);
    } catch(err) {
      console.error('Review submission failed:',err);
      if (err.code==='auth/operation-not-allowed') setError('Customer reviews are not enabled yet. The NaijaShelf administrator must enable Anonymous sign-in in Firebase Authentication.');
      else if (err.code==='permission-denied') setError('Your review could not be submitted. You may already have reviewed this business, or the review security rules need to be published.');
      else setError(err.message || 'Could not submit your review. Please try again.');
    } finally { setSending(false); }
  }

  return <article className="profile-panel reviews-panel">
    <span className="profile-kicker">CUSTOMER FEEDBACK</span>
    <h2>Reviews & ratings</h2>
    <div className="review-summary">
      <strong>{reviews.length ? average.toFixed(1) : '—'}</strong>
      <div><div className="review-stars" aria-label={reviews.length ? average.toFixed(1)+' out of 5 stars' : 'No ratings yet'}>{[1,2,3,4,5].map(n=><Star key={n} size={17} fill={n<=Math.round(average)?'currentColor':'none'}/>)}</div><span>{reviews.length} {reviews.length===1?'published review':'published reviews'}</span></div>
    </div>
    {reviews.length ? <div className="review-list">{reviews.map(review=><div className="review-item" key={review.id}>
      <div className="review-item-top"><b>{review.reviewerName}</b><span className="review-stars">{[1,2,3,4,5].map(n=><Star key={n} size={12} fill={n<=Number(review.rating)?'currentColor':'none'}/>)}</span></div>
      <p>{review.comment}</p>
      <small>{review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Recently submitted'}</small>
    </div>)}</div> : <p className="review-empty">No published reviews yet. Be the first to share your experience.</p>}
    <form className="review-form" onSubmit={submitReview}>
      <h3>Share your experience</h3>
      <label>Your name<input required minLength="2" maxLength="60" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/></label>
      <label>Your rating
        <select value={rating} onChange={e=>setRating(Number(e.target.value))}>
          <option value="5">5 stars — Excellent</option><option value="4">4 stars — Very good</option><option value="3">3 stars — Good</option><option value="2">2 stars — Fair</option><option value="1">1 star — Poor</option>
        </select>
      </label>
      <label>Your review<textarea required minLength="10" maxLength="700" rows="4" value={comment} onChange={e=>setComment(e.target.value)} placeholder="What was your experience with this business?"/></label>
      {error && <p className="review-error" role="alert">{error}</p>}
      {message && <p className="review-success" role="status">{message}</p>}
      <button className="review-submit" disabled={sending}>{sending?'Submitting…':'Submit review'}</button>
      <small className="review-moderation-note">Reviews are checked by NaijaShelf before they appear publicly. One review is allowed per anonymous browser session.</small>
    </form>
  </article>;
}

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

  useEffect(() => {
    if (!business) return;

    const previousTitle = document.title;
    const location = business.location || business.city || 'Nigeria';
    const category = business.category || 'Local business';
    const title = `${business.name} | ${category} in ${location} | NaijaShelf`;
    const description = (
      business.description ||
      `Discover ${business.name}, a ${category.toLowerCase()} business in ${location}, Nigeria. Contact the business directly through NaijaShelf.`
    ).replace(/\s+/g, ' ').slice(0, 160);
    const pageUrl = `${window.location.origin}/business/${encodeURIComponent(business.id)}`;
    const imageUrl = business.coverImage || business.logoUrl || 'https://naijashelf.vercel.app/';

    const previousMeta = [];
    const setMeta = (selector, attribute, value, createTag = 'meta', createAttribute = 'name') => {
      let element = document.head.querySelector(selector);
      const created = !element;
      if (!element) {
        element = document.createElement(createTag);
        element.setAttribute(createAttribute, selector.match(/(?:name|property)="([^"]+)"/)?.[1] || '');
        document.head.appendChild(element);
      }
      previousMeta.push({ element, attribute, value: element.getAttribute(attribute), created });
      element.setAttribute(attribute, value);
    };

    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:type"]', 'content', 'business.business', 'meta', 'property');
    setMeta('meta[property="og:title"]', 'content', title, 'meta', 'property');
    setMeta('meta[property="og:description"]', 'content', description, 'meta', 'property');
    setMeta('meta[property="og:url"]', 'content', pageUrl, 'meta', 'property');
    setMeta('meta[property="og:image"]', 'content', imageUrl, 'meta', 'property');
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);
    setMeta('meta[name="twitter:image"]', 'content', imageUrl);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    const canonicalCreated = !canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const previousCanonical = canonical.getAttribute('href');
    canonical.href = pageUrl;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: business.name,
      description,
      url: pageUrl,
      image: imageUrl,
      telephone: business.phone || business.whatsapp || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: business.address || undefined,
        addressLocality: location,
        addressCountry: 'NG'
      },
      areaServed: { '@type': 'Country', name: 'Nigeria' },
      sameAs: [
        business.website,
        business.instagram
      ].filter(Boolean)
    };
    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.id = 'naijashelf-business-jsonld';
    jsonLd.textContent = JSON.stringify(structuredData);
    document.head.appendChild(jsonLd);

    return () => {
      document.title = previousTitle;
      previousMeta.forEach(({ element, attribute, value, created }) => {
        if (created) element.remove();
        else if (value === null) element.removeAttribute(attribute);
        else element.setAttribute(attribute, value);
      });
      if (canonicalCreated) canonical.remove();
      else if (previousCanonical === null) canonical.removeAttribute('href');
      else canonical.setAttribute('href', previousCanonical);
      jsonLd.remove();
    };
  }, [business]);

  if (loading) return <main className="profile-state"><div className="profile-spinner"/>Loading business profile…</main>;
  if (!business) return <main className="profile-state"><Store size={30}/><h1>Business not found</h1><p>This listing may have been removed or is not currently approved.</p><button className="btn btn-dark" onClick={onBack}><ArrowLeft size={16}/> Back to directory</button></main>;

  const phone = String(business.whatsapp || business.phone || '').replace(/\D/g, '').replace(/^0/, '234');
  const contactUrl = phone ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent('Hello ' + business.name + ', I found your business on NaijaShelf and would like to make an enquiry.') : '';
  const shareProfile = async () => {
    const url = window.location.origin + '/business/' + encodeURIComponent(business.id);
    const data = { title: business.name + ' | NaijaShelf', text: 'Discover ' + business.name + ' on NaijaShelf.', url };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(url); alert('Profile link copied. You can now share it.'); }
    } catch (error) { if (error.name !== 'AbortError') { try { await navigator.clipboard.writeText(url); alert('Profile link copied.'); } catch { alert('Copy this link: ' + url); } } }
  };
  const website = business.website ? (/^https?:\/\//i.test(business.website) ? business.website : 'https://' + business.website) : '';
  const instagram = business.instagram ? (business.instagram.startsWith('http') ? business.instagram : 'https://instagram.com/' + business.instagram.replace(/^@/, '')) : '';
  const hours = business.hours && typeof business.hours === 'object' ? business.hours : null;

  return <main className="business-profile-page">
    <header className="profile-header">
      <button className="profile-back" onClick={onBack}><ArrowLeft size={17}/> Back to directory</button>
      <a className="brand" href="/" onClick={e=>{e.preventDefault();onBack()}}><span className="brand-mark"><Store size={19}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a>
      <button className="profile-share" onClick={shareProfile}><Share2 size={16}/> Share</button>
    </header>
    <section className="profile-cover">
      {business.coverImage ? <img src={business.coverImage} alt={business.name + ' cover'} decoding="async"/> : <div className="profile-cover-art"><span>{(business.name || 'NS').slice(0,2).toUpperCase()}</span></div>}
      <div className="profile-identity">
        <div className="profile-logo">{business.logoUrl ? <img src={business.logoUrl} alt={business.name + ' logo'} decoding="async"/> : (business.name || 'NS').slice(0,2).toUpperCase()}</div>
        <div className="profile-title">
          <div className="profile-badges"><span className="profile-approved"><BadgeCheck size={13}/> APPROVED LISTING</span>{business.isVerified === true && <span className="profile-verified"><ShieldCheck size={13}/> VERIFIED BUSINESS</span>}</div>
          <h1>{business.name}</h1><p>{business.category || 'Local business'}{(business.location || business.city) ? ' · ' + (business.location || business.city) : ''}</p>
        </div>
      </div>
    </section>
    <div className="profile-layout">
      <section className="profile-main-content">
        <article className="profile-panel"><span className="profile-kicker">ABOUT THE BUSINESS</span><h2>Get to know {business.name}</h2><p>{business.description || 'Discover this local business on NaijaShelf. Contact the seller directly to learn more about its products and services.'}</p></article>
        <article className="profile-panel"><span className="profile-kicker">WHAT THEY OFFER</span><h2>Products & services</h2>
          {Array.isArray(business.products) && business.products.length ? <div className="profile-products">{business.products.map((product,index)=><span key={index}><ShoppingBag size={15}/>{typeof product === 'string' ? product : product.name || product.title || 'Offering'}</span>)}</div> : <p>Contact the business to ask about available products and services.</p>}
        </article>
        <article className="profile-panel"><span className="profile-kicker">FIND THE BUSINESS</span><h2>Location</h2><p className="profile-location"><MapPin size={17}/>{business.address || business.location || business.city || 'Location not provided'}</p></article>
        {hours && <article className="profile-panel"><span className="profile-kicker">WHEN TO VISIT</span><h2><Clock3 size={19}/> Opening hours</h2><div className="business-hours-list">{dayNames.map(([key,label])=>{const day=hours[key]||{};return <div className="business-hours-row" key={key}><b>{label}</b><span>{day.closed?'Closed':day.open&&day.close?timeLabel(day.open)+' – '+timeLabel(day.close):'Hours not set'}</span></div>})}</div></article>}
        <CustomerReviews business={business}/>
      </section>
      <aside className="profile-sidebar"><div className="profile-contact-card"><span className="profile-kicker">CONNECT WITH THE SELLER</span><h2>Ready to make an enquiry?</h2><p>Contact the business directly to ask questions, check availability or learn more.</p>
        {contactUrl ? <a className="profile-whatsapp" href={contactUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Chat on WhatsApp <ArrowUpRight size={16}/></a> : <p className="profile-muted">WhatsApp contact has not been provided.</p>}
        {business.phone && <a className="profile-secondary-contact" href={'tel:' + String(business.phone).replace(/[^\d+]/g,'')}><Phone size={16}/> Call business</a>}
        {website && <a className="profile-secondary-contact" href={website} target="_blank" rel="noopener noreferrer"><Globe size={16}/> Visit website</a>}
        {instagram && <a className="profile-secondary-contact" href={instagram} target="_blank" rel="noopener noreferrer"><Instagram size={16}/> Instagram</a>}
        <button className="profile-share-wide" onClick={shareProfile}><Share2 size={16}/> Share this business</button>
      </div><p className="profile-trust"><ShieldCheck size={15}/> {business.isVerified === true ? 'NaijaShelf has verified this business.' : 'This business has been approved for the NaijaShelf directory. Approval does not mean identity verification.'}</p></aside>
    </div>
    <footer className="profile-footer"><a className="brand" href="/" onClick={e=>{e.preventDefault();onBack()}}><span className="brand-mark"><Store size={17}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a><span>Helping great local businesses get discovered.</span></footer>
  </main>;
}
