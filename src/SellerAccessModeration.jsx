import { useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, setDoc, writeBatch } from 'firebase/firestore';
import { BadgeCheck, Check, Clock3, XCircle } from 'lucide-react';
import { auth, db } from './firebase.js';

export default function SellerAccessModeration() {
  const [items,setItems]=useState([]);
  const [filter,setFilter]=useState('pending');
  const [busyId,setBusyId]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  useEffect(()=>onSnapshot(query(collection(db,'sellerAccessRequests'),orderBy('createdAt','desc')),snap=>{
    setItems(snap.docs.map(d=>({id:d.id,...d.data()})));
  },err=>{console.error(err);setError('Could not load seller access requests. Check the published Firestore Rules.');}),[]);

  async function review(item,decision) {
    setBusyId(item.id);setError('');setMessage('');
    try {
      const linkRef=doc(db,'businessOwnership',item.businessId);
      const link=await getDoc(linkRef);
      if(decision==='approved' && link.exists() && link.data().ownerUid!==item.sellerUid) {
        throw new Error('This business is already linked to another seller account. Resolve the existing ownership before approving.');
      }
      if(decision==='approved') {
        const batch=writeBatch(db);
        batch.set(linkRef,{
          businessId:item.businessId,
          ownerUid:item.sellerUid,
          sellerEmail:item.sellerEmail,
          sellerName:item.sellerName,
          linkedAt:serverTimestamp(),
          linkedBy:auth.currentUser?.uid||''
        });
        batch.update(doc(db,'sellerAccessRequests',item.id),{
          status:'approved',reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser?.uid||''
        });
        await batch.commit();
      } else {
        await updateDoc(doc(db,'sellerAccessRequests',item.id),{
          status:'rejected',reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser?.uid||''
        });
      }
      setMessage(decision==='approved'?'Seller account linked successfully.':'Access request rejected.');
    } catch(e) {console.error(e);setError(e.message||'Could not update this request.');}
    finally {setBusyId('');}
  }

  const shown=items.filter(item=>filter==='all'||item.status===filter);
  return <section className="seller-access-admin">
    <div className="seller-access-heading"><div><div className="admin-eyebrow"><BadgeCheck size={14}/> SELLER ACCOUNT CONTROL</div><h2>Seller access requests</h2><p>Review the seller's connection to an existing business before granting account access.</p></div></div>
    <div className="seller-access-filters">{['pending','approved','rejected','all'].map(key=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{key[0].toUpperCase()+key.slice(1)} ({items.filter(item=>key==='all'||item.status===key).length})</button>)}</div>
    {error&&<p className="admin-alert" role="alert">{error}</p>}{message&&<p className="editor-success" role="status">{message}</p>}
    {!shown.length?<div className="admin-empty"><Clock3 size={26}/><b>No seller access requests</b><span>Requests from verified seller accounts will appear here.</span></div>:
      <div className="application-list">{shown.map(item=><article className="application-card" key={item.id}>
        <div className="application-info"><div className="application-title-row"><h3>{item.businessName}</h3><span className={'status-pill '+(item.status==='approved'?'approved':item.status==='rejected'?'rejected':'pending')}>{item.status}</span></div>
          <div className="application-meta"><span>Seller: {item.sellerName}</span><span>Email: {item.sellerEmail}</span><span>Submitted: {item.createdAt?.toDate?.().toLocaleString()||'Just received'}</span><span>Business ID: {item.businessId}</span></div>
        </div>
        {item.status==='pending'&&<div className="application-actions">
          <button className="reject-action" disabled={busyId===item.id} onClick={()=>review(item,'rejected')}><XCircle size={15}/> Reject</button>
          <button className="approve-action" disabled={busyId===item.id} onClick={()=>review(item,'approved')}>{busyId===item.id?'Saving…':<><Check size={15}/> Approve & link account</>}</button>
        </div>}
      </article>)}</div>}
  </section>;
}
