import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { BadgeCheck, Star } from 'lucide-react';
import { db } from './firebase.js';
import './featured.css';

export default function FeaturedModeration() {
  const [businesses,setBusinesses] = useState([]);
  const [error,setError] = useState('');
  const [busyId,setBusyId] = useState('');

  useEffect(() => {
    return onSnapshot(
      query(collection(db,'businesses'),where('status','==','approved')),
      snapshot => {
        const rows=snapshot.docs.map(item=>({id:item.id,...item.data()}));
        rows.sort((a,b)=>(b.featuredAt?.toMillis?.()||0)-(a.featuredAt?.toMillis?.()||0));
        setBusinesses(rows);
        setError('');
      },
      err => {
        console.error('Featured business list failed:',err);
        setError('Could not load approved businesses. Check your connection and admin permissions.');
      }
    );
  },[]);

  async function toggle(item) {
    setBusyId(item.id); setError('');
    try {
      await updateDoc(doc(db,'businesses',item.id),{
        isFeatured:!item.isFeatured,
        featuredAt:!item.isFeatured ? serverTimestamp() : null,
        featuredUpdatedAt:serverTimestamp()
      });
    } catch(err) {
      console.error('Featured status update failed:',err);
      setError('Could not update featured status. Confirm you are signed in as an administrator.');
    } finally { setBusyId(''); }
  }

  const featuredCount=businesses.filter(item=>item.isFeatured===true).length;
  return <section className="featured-admin">
    <div className="featured-admin-heading">
      <div><span className="admin-eyebrow">HOMEPAGE VISIBILITY</span><h2>Featured businesses</h2><p>Choose approved businesses to highlight separately on the homepage. Featured listings remain in their normal directory position.</p></div>
      <span className="featured-count">{featuredCount} featured</span>
    </div>
    {error&&<div className="admin-alert admin-alert-wide" role="alert">{error}</div>}
    {businesses.length===0?<div className="admin-empty"><Star size={25}/><b>No approved businesses yet</b><span>Approved listings will appear here for selection.</span></div>:
      <div className="featured-admin-list">{businesses.map(item=><article className="featured-admin-row" key={item.id}>
        <div className="featured-admin-business">
          {item.logoUrl?<img src={item.logoUrl} alt="" loading="lazy"/>:<span className="featured-admin-monogram">{(item.name||'NS').slice(0,2).toUpperCase()}</span>}
          <div><b>{item.name}</b><span>{item.category||'Uncategorised'} · {item.location||item.city||'Location not set'}</span>{item.isVerified&&<small><BadgeCheck size={12}/> NaijaShelf verified</small>}</div>
        </div>
        <button type="button" className={item.isFeatured?'featured-admin-remove':'featured-admin-add'} disabled={busyId===item.id} onClick={()=>toggle(item)}>
          {busyId===item.id?'Saving…':item.isFeatured?'Remove feature':'Feature business'}
        </button>
      </article>)}</div>}
    <p className="featured-admin-note">Selection is editorial: review listing completeness, accurate contact details, responsiveness and customer trust before featuring. Featured status is not a paid or verified badge.</p>
  </section>;
}
