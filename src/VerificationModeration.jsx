import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, serverTimestamp } from 'firebase/firestore';
import { BadgeCheck, CheckCircle2, XCircle } from 'lucide-react';
import { auth, db } from './firebase.js';

const stamp=value=>value?.toDate?value.toDate().toLocaleString():'Just received';

export default function VerificationModeration(){
 const [items,setItems]=useState([]),[filter,setFilter]=useState('pending'),[busy,setBusy]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>onSnapshot(query(collection(db,'businessVerificationRequests'),orderBy('createdAt','desc')),snap=>{setItems(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);setError('');},err=>{console.error(err);setError('Could not load verification requests. Publish the latest Firestore Rules.');setLoading(false);}),[]);
 const visible=useMemo(()=>items.filter(x=>filter==='all'||x.status===filter),[items,filter]);
 async function decide(item,approved){
  if(approved&&!window.confirm('Only approve after independently confirming the owner and business details. Mark '+item.businessName+' as verified?'))return;
  setBusy(item.id);setError('');
  try{
   if(approved) await updateDoc(doc(db,'businesses',item.businessId),{isVerified:true,verifiedAt:serverTimestamp(),verifiedBy:auth.currentUser?.uid||''});
   await updateDoc(doc(db,'businessVerificationRequests',item.id),{status:approved?'verified':'rejected',reviewedAt:serverTimestamp(),reviewedBy:auth.currentUser?.uid||''});
  }catch(err){console.error(err);setError('Could not update this request. Confirm admin permissions and Firestore Rules.');}
  finally{setBusy('');}
 }
 if(loading)return <div className="admin-empty">Loading verification requests…</div>;
 return <section className="report-moderation">
  <div className="editor-heading"><div><div className="admin-eyebrow"><BadgeCheck size={14}/> BUSINESS TRUST</div><h2>Ownership verification</h2><p>Contact the business using independently sourced contact details and check the evidence before approving.</p></div><span className="editor-count">{items.filter(x=>x.status==='pending').length} pending</span></div>
  <div className="admin-tabs">{['pending','verified','rejected','all'].map(k=><button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{k==='all'?'All':k[0].toUpperCase()+k.slice(1)}</button>)}</div>
  {error&&<div className="admin-alert" role="alert">{error}</div>}
  {!visible.length?<div className="admin-empty"><BadgeCheck size={26}/><b>No requests in this view</b><span>New ownership verification requests will appear here.</span></div>:
   <div className="report-list">{visible.map(item=><article className="report-card" key={item.id}>
    <div className="report-card-head"><b>{item.businessName}</b><span className={'status-pill '+(item.status==='pending'?'pending':item.status==='verified'?'approved':'rejected')}>{item.status}</span></div>
    <p><strong>Requester:</strong> {item.requesterName} ({item.relationship})</p><p><strong>Contact:</strong> {item.contactPhone}</p><p><strong>Evidence / explanation:</strong> {item.evidence}</p><small>Submitted: {stamp(item.createdAt)}</small>
    {item.status==='pending'&&<div className="application-actions"><button className="reject-action" disabled={busy===item.id} onClick={()=>decide(item,false)}><XCircle size={15}/> Reject</button><button className="approve-action" disabled={busy===item.id} onClick={()=>decide(item,true)}><CheckCircle2 size={15}/> Verify business</button></div>}
   </article>)}</div>}
 </section>;
}
