import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, BadgeCheck, Check, Clock3, LogOut, RefreshCw, Search, ShieldCheck, Store, XCircle } from 'lucide-react';
import { auth, db } from './firebase.js';
import './admin.css';
import BusinessProfileEditor from './BusinessProfileEditor.jsx';
import ReviewModeration from './ReviewModeration.jsx';
import ReportModeration from './ReportModeration.jsx';
import VerificationModeration from './VerificationModeration.jsx';

const clean = value => String(value || '').trim();
const dateLabel = value => value && value.toDate ? value.toDate().toLocaleString() : 'Just received';

export default function Admin() {
  const [user,setUser] = useState(null), [ready,setReady] = useState(false);
  const [email,setEmail] = useState(''), [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false), [busyId,setBusyId] = useState('');
  const [error,setError] = useState(''), [items,setItems] = useState([]);
  const [filter,setFilter] = useState('pending'), [search,setSearch] = useState('');
  const [workspaceTab,setWorkspaceTab] = useState('applications');

  useEffect(() => onAuthStateChanged(auth, async current => {
    if (current) {
      try {
        const token = await current.getIdTokenResult(true);
        if (token.claims.admin === true) { setUser(current); setError(''); }
        else { await signOut(auth); setUser(null); setError('This account is not authorised as a NaijaShelf administrator.'); }
      } catch (e) { setUser(null); setError('Could not verify administrator access. Please sign in again.'); }
    } else setUser(null);
    setReady(true);
  }), []);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    const q = query(collection(db,'sellerSubmissions'),orderBy('createdAt','desc'));
    return onSnapshot(q, snap => setItems(snap.docs.map(d => ({id:d.id,...d.data()}))), err => {
      console.error(err); setError('Could not load applications. Check the published Firestore Rules and admin permission.');
    });
  }, [user]);

  const counts = useMemo(() => ({
    all:items.length,
    pending:items.filter(x=>x.status==='pending').length,
    approved:items.filter(x=>x.status==='approved').length,
    rejected:items.filter(x=>x.status==='rejected').length
  }),[items]);
  const shown = useMemo(() => items.filter(x =>
    (filter==='all' || x.status===filter) &&
    [x.businessName,x.ownerName,x.category,x.city,x.whatsapp].some(v=>clean(v).toLowerCase().includes(search.toLowerCase()))
  ),[items,filter,search]);

  async function login(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await signInWithEmailAndPassword(auth,email.trim(),password);
      const token = await result.user.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        await signOut(auth);
        setError('This account has no administrator permission. Ask the project owner to grant admin access.');
      }
    } catch (e) {
      setError(e.code==='auth/invalid-credential' ? 'Incorrect email or password.' :
        'Sign-in failed. Enable Email/Password in Firebase Authentication and check your credentials.');
    } finally { setBusy(false); }
  }

  async function approve(item) {
    if (!window.confirm('Approve "'+item.businessName+'" and publish it in the public directory?')) return;
    setBusyId(item.id); setError('');
    try {
      await setDoc(doc(db,'businesses',item.id),{
        name:clean(item.businessName), ownerName:clean(item.ownerName),
        category:clean(item.category), location:clean(item.city), city:clean(item.city),
        whatsapp:clean(item.whatsapp),
        description:clean(item.description) || 'Contact this business on NaijaShelf to learn more about its products and services.',
        products:[],status:'approved',sourceSubmissionId:item.id,
        createdAt:serverTimestamp(),publishedAt:serverTimestamp(),publishedBy:user.uid
      });
      await updateDoc(doc(db,'sellerSubmissions',item.id),{
        status:'approved',reviewedAt:serverTimestamp(),reviewedBy:user.uid
      });
    } catch(e) {
      console.error(e); setError('Approval failed. Publish the latest Firestore Rules and verify this account has the admin claim.');
    } finally { setBusyId(''); }
  }

  async function reject(item) {
    const reason = window.prompt('Optional rejection reason for '+item.businessName+':');
    if (reason===null) return;
    setBusyId(item.id); setError('');
    try {
      await updateDoc(doc(db,'sellerSubmissions',item.id),{
        status:'rejected',rejectionReason:reason.trim(),reviewedAt:serverTimestamp(),reviewedBy:user.uid
      });
    } catch(e) {
      console.error(e); setError('Rejection failed. Check Firestore Rules and administrator permissions.');
    } finally { setBusyId(''); }
  }

  if (!ready) return <main className="admin-loading">Loading secure admin area…</main>;
  if (!user) return <main className="admin-login-page">
    <a href="/" className="admin-back"><ArrowLeft size={16}/> Back to NaijaShelf</a>
    <section className="admin-login-card">
      <div className="admin-brand"><span><Store size={21}/></span><b>naija<span>shelf</span><i>.</i></b></div>
      <div className="admin-eyebrow"><ShieldCheck size={15}/> SECURE ADMINISTRATION</div>
      <h1>Welcome <em>back.</em></h1>
      <p>Sign in with your authorised NaijaShelf administrator account to manage seller applications.</p>
      <form onSubmit={login}>
        <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>
        {error && <div className="admin-alert" role="alert">{error}</div>}
        <button className="admin-primary" disabled={busy}>{busy?'Checking access…':'Sign in securely'}</button>
      </form>
      <small>Administrator access is restricted to accounts with the NaijaShelf admin permission.</small>
    </section>
  </main>;

  return <main className="admin-page">
    <header className="admin-header">
      <a href="/" className="admin-brand"><span><Store size={20}/></span><b>naija<span>shelf</span><i>.</i></b></a>
      <div className="admin-header-right"><span className="admin-secure"><ShieldCheck size={14}/> Admin workspace</span><span className="admin-user">{user.email}</span><button className="admin-logout" onClick={()=>signOut(auth)}><LogOut size={15}/> Sign out</button></div>
    </header>
    <section className="admin-content">
      <div className="admin-heading"><div><div className="admin-eyebrow">SELLER OPERATIONS</div><h1>Good to see you.</h1><p>Review applications and decide which businesses join the NaijaShelf directory.</p></div><button className="admin-refresh" onClick={()=>window.location.reload()}><RefreshCw size={15}/> Refresh</button></div>
      <div className="admin-workspace-tabs"><button className={workspaceTab==='applications'?'active':''} onClick={()=>setWorkspaceTab('applications')}>Seller applications</button><button className={workspaceTab==='profiles'?'active':''} onClick={()=>setWorkspaceTab('profiles')}>Business profile editor</button><button className={workspaceTab==='reviews'?'active':''} onClick={()=>setWorkspaceTab('reviews')}>Customer reviews</button><button className={workspaceTab==='reports'?'active':''} onClick={()=>setWorkspaceTab('reports')}>Listing reports</button><button className={workspaceTab==='verification'?'active':''} onClick={()=>setWorkspaceTab('verification')}>Verification</button></div>
      {workspaceTab==='profiles' ? <BusinessProfileEditor/> : workspaceTab==='reviews' ? <ReviewModeration/> : workspaceTab==='reports' ? <ReportModeration/> : workspaceTab==='verification' ? <VerificationModeration/> : <>
      <div className="admin-stats">
        {['all','pending','approved','rejected'].map(key=><button key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}><span>{key==='all'?'Total applications':key==='pending'?'Awaiting review':key[0].toUpperCase()+key.slice(1)}</span><b>{counts[key]}</b></button>)}
      </div>
      {error && <div className="admin-alert admin-alert-wide" role="alert">{error}</div>}
      <div className="admin-list-head"><div><h2>Seller applications</h2><p>New submissions appear here automatically.</p></div><div className="admin-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sellers…"/></div></div>
      <div className="admin-tabs">{['pending','approved','rejected','all'].map(key=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{key==='all'?'All':key[0].toUpperCase()+key.slice(1)}</button>)}</div>
      {shown.length===0 ? <div className="admin-empty"><Clock3 size={28}/><b>No applications found</b><span>There are no matching applications in this view.</span></div> :
      <div className="application-list">{shown.map(item=><article className="application-card" key={item.id}>
        <div className="application-main"><div className="application-avatar">{clean(item.businessName).slice(0,2).toUpperCase()||'NS'}</div><div className="application-info">
          <div className="application-title-row"><h3>{item.businessName}</h3><span className={'status-pill '+item.status}>{item.status}</span></div>
          <p>{item.category} <span>·</span> {item.city}</p>
          <div className="application-meta"><span>Owner: {item.ownerName}</span><span>WhatsApp: {item.whatsapp}</span><span>Received: {dateLabel(item.createdAt)}</span></div>
          {item.rejectionReason && <p className="rejection-note">Reason: {item.rejectionReason}</p>}
        </div></div>
        {item.status==='pending' && <div className="application-actions">
          <a href={'https://wa.me/'+clean(item.whatsapp).replace(/\D/g,'').replace(/^0/,'234')} target="_blank" rel="noreferrer">Contact seller</a>
          <button className="reject-action" disabled={busyId===item.id} onClick={()=>reject(item)}><XCircle size={15}/> Reject</button>
          <button className="approve-action" disabled={busyId===item.id} onClick={()=>approve(item)}>{busyId===item.id?'Saving…':<><Check size={15}/> Approve & publish</>}</button>
        </div>}
      </article>)}</div>}
      <footer className="admin-footer"><BadgeCheck size={15}/> Only approved businesses appear in the public directory.</footer>
      </>}
    </section>
  </main>;
}
