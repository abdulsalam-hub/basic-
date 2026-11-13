import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, onSnapshot, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase.js';
import './profile.css';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Flag, Globe, Instagram, MapPin, MessageCircle, Phone, Share2, ShieldCheck, ShoppingBag, Store, Star, Clock3 } from 'lucide-react';

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



function OwnershipVerification({business}) {
 const [requesterName,setRequesterName]=useState('');
 const [relationship,setRelationship]=useState('Business owner');
 const [contactPhone,setContactPhone]=useState('');
 const [evidence,setEvidence]=useState('');
 const [sending,setSending]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 async function submit(e){
  e.preventDefault();
  const name=requesterName.trim(),phone=contactPhone.trim(),proof=evidence.trim();
  if(name.length<2||name.length>80){setError('Enter a name between 2 and 80 characters.');return;}
  if(phone.replace(/\D/g,'').length<7||phone.length>25){setError('Enter a valid phone or WhatsApp number.');return;}
  if(proof.length<20||proof.length>500){setError('Please explain how you are connected to this business in 20–500 characters.');return;}
  setSending(true);setError('');setMessage('');
  try{
   const user=auth.currentUser||(await signInAnonymously(auth)).user;
   await addDoc(collection(db,'businessVerificationRequests'),{
    reporterUid:user.uid,businessId:business.id,businessName:business.name,
    requesterName:name,relationship,contactPhone:phone,evidence:proof,
    status:'pending',createdAt:serverTimestamp()
   });
   setRequesterName('');setContactPhone('');setEvidence('');
   setMessage('Your verification request has been received. NaijaShelf will contact you after reviewing it.');
  }catch(err){console.error(err);setError(err.code==='permission-denied'?'The request could not be saved. The latest Firestore Rules may not be published yet.':'Could not submit your request. Please try again.');}
  finally{setSending(false);}
 }
 return <article className="profile-panel ownership-request">
  <span className="profile-kicker">BUSINESS TRUST</span><h2><BadgeCheck size={18}/> Request ownership verification</h2>
  <p>Are you the owner or an authorised representative? Request a verified badge. NaijaShelf will independently contact the business before approving it.</p>
  {business.isVerified===true?<p className="review-success" role="status">This business has already been verified by NaijaShelf.</p>:<form onSubmit={submit}>
   <label>Your full name<input required minLength="2" maxLength="80" value={requesterName} onChange={e=>setRequesterName(e.target.value)} placeholder="Name of requester"/></label>
   <label>Your relationship to the business<select value={relationship} onChange={e=>setRelationship(e.target.value)}><option>Business owner</option><option>Director / partner</option><option>Authorised employee</option><option>Family representative</option></select></label>
   <label>Your phone / WhatsApp<input required maxLength="25" value={contactPhone} onChange={e=>setContactPhone(e.target.value)} placeholder="Phone number we can reach you on"/></label>
   <label>How can we confirm your authority?<textarea required minLength="20" maxLength="500" rows="3" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Explain your connection and what evidence you can provide when contacted."/></label>
   <small>Do not submit passwords, bank details or identity-document numbers here. We will contact you to arrange a safe verification check.</small>
   {error&&<p className="review-error" role="alert">{error}</p>}{message&&<p className="review-success" role="status">{message}</p>}
   <button className="profile-report-submit" disabled={sending}>{sending?'Submitting…':'Send verification request'}</button>
  </form>}
 </article>;
}

function ListingReport({ business }) {
  const [reason,setReason] = useState('Incorrect business information');
  const [details,setDetails] = useState('');
  const [sending,setSending] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    const note=details.trim();
    if (note.length<10 || note.length>700) {
      setError('Please describe the issue in 10–700 characters.');
      return;
    }
    setSending(true); setError(''); setMessage('');
    try {
      const user=auth.currentUser || (await signInAnonymously(auth)).user;
      await addDoc(collection(db,'listingReports'),{
        reporterUid:user.uid,
        businessId:business.id,
        businessName:business.name,
        reason,
        details:note,
        status:'pending',
        createdAt:serverTimestamp()
      });
      setDetails('');
      setMessage('Thank you. Your report has been sent to the NaijaShelf review team.');
    } catch(err) {
      console.error('Listing report failed:',err);
      setError(err.code==='permission-denied'?'The report could not be saved. The administrator may need to publish the latest Firestore Rules.':'Could not send your report right now. Please try again later.');
    } finally { setSending(false); }
  }

  return <div className="profile-report-box">
    <div className="profile-report-intro"><Flag size={14}/> Spotted a problem with this listing?</div>
    <form onSubmit={submit}>
      <label>What is the issue?
        <select value={reason} onChange={e=>setReason(e.target.value)}>
          <option>Incorrect business information</option>
          <option>Business appears to be closed</option>
          <option>Fake or impersonating business</option>
          <option>Misleading products or services</option>
          <option>Inappropriate or suspicious content</option>
          <option>Other concern</option>
        </select>
      </label>
      <label>Tell us more
        <textarea required minLength="10" maxLength="700" rows="3" value={details} onChange={e=>setDetails(e.target.value)} placeholder="Describe what you noticed (10–700 characters)."/>
      </label>
      {error && <p className="review-error" role="alert">{error}</p>}
      {message && <p className="review-success" role="status">{message}</p>}
      <button className="profile-report-submit" disabled={sending}>{sending?'Sending report…':'Submit report'}</button>
    </form>
    <small>Reports are private and reviewed by NaijaShelf. Please do not include passwords or sensitive personal information.</small>
  </div>;
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
  const reportUrl = 'https://wa.me/2348021289677?text=' + encodeURIComponent('Hello NaijaShelf, I would like to report an issue with this business listing.\nBusiness: ' + business.name + '\nProfile: ' + window.location.origin + '/business/' + encodeURIComponent(business.id) + '\nIssue: [Please describe incorrect details, suspected impersonation, closure, or another concern.]');
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
        <article className="profile-panel"><span className="profile-kicker">ABOUT THE BUSINESS</span><h2>Get to know {business.name}</h2><p>{business.description || 'Discover this local business on NaijaShelf. Contact the seller directly to learn more about its products and services.'}</p><small className="profile-freshness">{business.lastConfirmedAt?.toDate ? 'Business details last confirmed on ' + business.lastConfirmedAt.toDate().toLocaleDateString() : 'Business details have not yet been independently reconfirmed by NaijaShelf.'}</small></article>
        <article className="profile-panel"><span className="profile-kicker">WHAT THEY OFFER</span><h2>Products & services</h2>
          {Array.isArray(business.products) && business.products.length ? <div className="profile-products">{business.products.map((product,index)=><span key={index}><ShoppingBag size={15}/>{typeof product === 'string' ? product : product.name || product.title || 'Offering'}</span>)}</div> : <p>Contact the business to ask about available products and services.</p>}
        </article>
        <article className="profile-panel"><span className="profile-kicker">FIND THE BUSINESS</span><h2>Location</h2><p className="profile-location"><MapPin size={17}/>{business.address || business.location || business.city || 'Location not provided'}</p></article>
        {hours && <article className="profile-panel"><span className="profile-kicker">WHEN TO VISIT</span><h2><Clock3 size={19}/> Opening hours</h2><div className="business-hours-list">{dayNames.map(([key,label])=>{const day=hours[key]||{};return <div className="business-hours-row" key={key}><b>{label}</b><span>{day.closed?'Closed':day.open&&day.close?timeLabel(day.open)+' – '+timeLabel(day.close):'Hours not set'}</span></div>})}</div></article>}
        <OwnershipVerification business={business}/>
        <CustomerReviews business={business}/>
      </section>
      <aside className="profile-sidebar"><div className="profile-contact-card"><span className="profile-kicker">CONNECT WITH THE SELLER</span><h2>Ready to make an enquiry?</h2><p>Contact the business directly to ask questions, check availability or learn more.</p>
        {contactUrl ? <a className="profile-whatsapp" href={contactUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Chat on WhatsApp <ArrowUpRight size={16}/></a> : <p className="profile-muted">WhatsApp contact has not been provided.</p>}
        {business.phone && <a className="profile-secondary-contact" href={'tel:' + String(business.phone).replace(/[^\d+]/g,'')}><Phone size={16}/> Call business</a>}
        {website && <a className="profile-secondary-contact" href={website} target="_blank" rel="noopener noreferrer"><Globe size={16}/> Visit website</a>}
        {instagram && <a className="profile-secondary-contact" href={instagram} target="_blank" rel="noopener noreferrer"><Instagram size={16}/> Instagram</a>}
        <button className="profile-share-wide" onClick={shareProfile}><Share2 size={16}/> Share this business</button>
        <ListingReport business={business}/>
      </div><p className="profile-trust"><ShieldCheck size={15}/> {business.isVerified === true ? 'NaijaShelf has verified this business.' : 'This business has been approved for the NaijaShelf directory. Approval does not mean identity verification.'}</p></aside>
    </div>
    <footer className="profile-footer"><a className="brand" href="/" onClick={e=>{e.preventDefault();onBack()}}><span className="brand-mark"><Store size={17}/></span><span>naija<span className="brand-light">shelf</span><i>.</i></span></a><span>Helping great local businesses get discovered.</span></footer>
  </main>;
}
