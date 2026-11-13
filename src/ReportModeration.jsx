import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, Flag, RefreshCw, XCircle } from 'lucide-react';
import { db, auth } from './firebase.js';

const label = value => value?.toDate ? value.toDate().toLocaleString() : 'Just received';

export default function ReportModeration() {
  const [reports,setReports] = useState([]);
  const [loading,setLoading] = useState(true);
  const [filter,setFilter] = useState('pending');
  const [busyId,setBusyId] = useState('');
  const [error,setError] = useState('');

  useEffect(() => onSnapshot(query(collection(db,'listingReports'),orderBy('createdAt','desc')), snap => {
    setReports(snap.docs.map(item=>({id:item.id,...item.data()})));
    setLoading(false);
    setError('');
  }, err => {
    console.error('Listing reports failed:',err);
    setError('Could not load reports. Check that the latest Firestore Rules have been published.');
    setLoading(false);
  }), []);

  const visible = useMemo(()=>reports.filter(item=>filter==='all'||item.status===filter),[reports,filter]);

  async function moderate(item,status) {
    setBusyId(item.id); setError('');
    try {
      await updateDoc(doc(db,'listingReports',item.id),{
        status, reviewedAt:serverTimestamp(), reviewedBy:auth.currentUser?.uid || ''
      });
    } catch(err) {
      console.error(err);
      setError('Could not update this report. Check administrator access and Firestore Rules.');
    } finally { setBusyId(''); }
  }

  if (loading) return <div className="admin-empty">Loading customer reports…</div>;
  return <section className="report-moderation">
    <div className="editor-heading"><div><div className="admin-eyebrow"><Flag size={14}/> CUSTOMER SAFETY</div><h2>Listing reports</h2><p>Review reports about incorrect, closed, misleading or suspicious business listings.</p></div><span className="editor-count">{reports.filter(x=>x.status==='pending').length} pending</span></div>
    <div className="admin-tabs">{['pending','reviewed','dismissed','all'].map(key=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{key==='all'?'All':key[0].toUpperCase()+key.slice(1)}</button>)}</div>
    {error && <div className="admin-alert" role="alert">{error}</div>}
    {!visible.length ? <div className="admin-empty"><Flag size={26}/><b>No reports in this view</b><span>New customer reports will appear here.</span></div> :
      <div className="report-list">{visible.map(item=><article className="report-card" key={item.id}>
        <div className="report-card-head"><b>{item.businessName || 'Business listing'}</b><span className={'status-pill '+(item.status==='pending'?'pending':item.status==='reviewed'?'approved':'rejected')}>{item.status}</span></div>
        <p><strong>Reason:</strong> {item.reason}</p>
        <p>{item.details}</p>
        <small>Submitted: {label(item.createdAt)}</small>
        {item.status==='pending' && <div className="application-actions"><button className="reject-action" disabled={busyId===item.id} onClick={()=>moderate(item,'dismissed')}><XCircle size={15}/> Dismiss</button><button className="approve-action" disabled={busyId===item.id} onClick={()=>moderate(item,'reviewed')}><CheckCircle2 size={15}/> Mark reviewed</button></div>}
      </article>)}</div>}
  </section>;
}
