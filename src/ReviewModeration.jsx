import { useEffect, useState } from 'react';
import { collectionGroup, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Check, Clock3, Star, XCircle } from 'lucide-react';
import { auth, db } from './firebase.js';

export default function ReviewModeration() {
  const [reviews,setReviews] = useState([]);
  const [loading,setLoading] = useState(true);
  const [busyId,setBusyId] = useState('');
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');

  useEffect(()=>onSnapshot(query(collectionGroup(db,'reviews'),where('status','==','pending')),snap=>{
    setReviews(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)));
    setLoading(false);
  },err=>{console.error('NaijaShelf pending-review query failed:',err);setError('Could not load pending reviews. Firestore says: '+(err.code||'unknown error')+' — '+(err.message||'No additional details.'));setLoading(false);}),[]);

  async function moderate(item,status) {
    const action=status==='approved'?'publish':'reject';
    if (!window.confirm('Are you sure you want to '+action+' this review for '+item.businessName+'?')) return;
    setBusyId(item.id);setError('');setMessage('');
    try {
      await updateDoc(doc(db,'businesses',item.businessId,'reviews',item.id),{
        status,reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser?.uid||''
      });
      setMessage('Review '+status+'.');
    } catch(err) {
      console.error(err);setError('Could not update this review. Confirm the latest Firestore Rules are published.');
    } finally {setBusyId('');}
  }

  if(loading)return <div className="admin-empty">Loading customer reviews…</div>;
  return <section className="review-moderation">
    <div className="editor-heading"><div><div className="admin-eyebrow"><Star size={14}/> CUSTOMER TRUST</div><h2>Review moderation</h2><p>Only approved reviews appear on public business profiles.</p></div><span className="editor-count">{reviews.length} pending</span></div>
    {error&&<div className="admin-alert" role="alert">{error}</div>}
    {message&&<div className="editor-success" role="status">{message}</div>}
    {!reviews.length?<div className="admin-empty"><Clock3 size={27}/><b>No pending reviews</b><span>New customer reviews will appear here for moderation.</span></div>:
      <div className="application-list">{reviews.map(item=><article className="application-card" key={item.businessId+'-'+item.id}>
        <div className="application-info"><div className="application-title-row"><h3>{item.businessName||'Business review'}</h3><span className="status-pill pending">Pending review</span></div>
          <p>By {item.reviewerName||'Customer'} · {item.rating}/5 stars</p><p>{item.comment}</p>
          <small className="review-admin-date">{item.createdAt?.toDate?item.createdAt.toDate().toLocaleString():'Recently submitted'}</small>
        </div>
        <div className="application-actions"><button className="reject-action" disabled={busyId===item.id} onClick={()=>moderate(item,'rejected')}><XCircle size={15}/> Reject</button><button className="approve-action" disabled={busyId===item.id} onClick={()=>moderate(item,'approved')}>{busyId===item.id?'Saving…':<><Check size={15}/> Approve review</>}</button></div>
      </article>)}</div>}
  </section>;
}
