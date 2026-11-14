import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification,
  signInWithEmailAndPassword, signOut, reload, updateProfile
} from 'firebase/auth';
import {
  addDoc, collection, getDoc, getDocs, onSnapshot, query, where, doc, serverTimestamp
} from 'firebase/firestore';
import { ArrowLeft, LogOut, MailCheck, Store, ShieldCheck } from 'lucide-react';
import { auth, db } from './firebase.js';
import './seller.css';

const clean = value => String(value || '').trim();

export default function SellerPortal() {
  const [user,setUser] = useState(null);
  const [authReady,setAuthReady] = useState(false);
  const [mode,setMode] = useState('register');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [businesses,setBusinesses] = useState([]);
  const [selectedBusiness,setSelectedBusiness] = useState('');
  const [requests,setRequests] = useState([]);
  const [ownedBusinesses,setOwnedBusinesses] = useState([]);
  const [sendingRequest,setSendingRequest] = useState(false);

  useEffect(() => onAuthStateChanged(auth,current => {
    setUser(current);
    setAuthReady(true);
    setError('');
  }),[]);

  useEffect(() => {
    if (!user?.emailVerified) { setBusinesses([]); setRequests([]); setOwnedBusinesses([]); return; }
    const stopBusinesses = onSnapshot(query(collection(db,'businesses'),where('status','==','approved')),snap => {
      setBusinesses(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>clean(a.name).localeCompare(clean(b.name))));
    },err => setError('Could not load approved listings. Please refresh and try again.'));
    const stopRequests = onSnapshot(query(collection(db,'sellerAccessRequests'),where('sellerUid','==',user.uid)),snap => {
      setRequests(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)));
    },err => setError('Could not load your access requests.'));
    const stopLinks = onSnapshot(query(collection(db,'businessOwnership'),where('ownerUid','==',user.uid)),async snap => {
      try {
        const rows = await Promise.all(snap.docs.map(async item => {
          const businessSnap = await getDoc(doc(db,'businesses',item.id));
          return businessSnap.exists() ? {id:item.id,...businessSnap.data()} : null;
        }));
        setOwnedBusinesses(rows.filter(Boolean).filter(item=>item.status==='approved'));
      } catch(e) { setError('Could not load your linked business listings.'); }
    },err => setError('Could not load linked business accounts.'));
    return () => { stopBusinesses(); stopRequests(); stopLinks(); };
  },[user?.uid,user?.emailVerified]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (mode==='register') {
        if (clean(name).length<2) throw new Error('Please enter your full name.');
        if (password.length<8) throw new Error('Use a password with at least 8 characters.');
        const result = await createUserWithEmailAndPassword(auth,clean(email).toLowerCase(),password);
        await updateProfile(result.user,{displayName:clean(name)});
        await sendEmailVerification(result.user);
        setNotice('Account created. Check your email and verify your address, then return here and tap “I have verified my email”.');
      } else {
        await signInWithEmailAndPassword(auth,clean(email).toLowerCase(),password);
      }
    } catch(e) {
      const code=e?.code||'';
      setError(code==='auth/email-already-in-use'?'An account already exists with this email. Choose Sign in instead.':code==='auth/weak-password'?'Your password must contain at least 6 characters.':code==='auth/invalid-credential'?'Email or password is incorrect.':e.message||'Could not complete sign in.');
    } finally { setBusy(false); }
  }

  async function checkVerification() {
    if (!auth.currentUser) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await reload(auth.currentUser);
      const fresh = auth.currentUser;
      if (!fresh.emailVerified) {
        setError('Your email is not verified yet. Open the verification email and tap its link first.');
      } else {
        await fresh.getIdToken(true);
        setUser({...fresh});
        setNotice('Email verified. You can now request access to your business listing.');
      }
    } catch(e) { setError('Could not refresh verification status. Please try again.'); }
    finally { setBusy(false); }
  }

  async function resendVerification() {
    setError(''); setNotice('');
    try { await sendEmailVerification(auth.currentUser); setNotice('A new verification email has been sent. Check your inbox and spam folder.'); }
    catch(e) { setError(e.message||'Could not send the verification email.'); }
  }

  async function requestAccess(e) {
    e.preventDefault();
    const business=businesses.find(item=>item.id===selectedBusiness);
    if (!business) { setError('Choose an approved business listing first.'); return; }
    if (requests.some(item=>item.status==='pending'||item.status==='approved')) {
      setError('You already have a pending or approved access request.'); return;
    }
    setSendingRequest(true); setError(''); setNotice('');
    try {
      await addDoc(collection(db,'sellerAccessRequests'),{
        sellerUid:user.uid,
        sellerEmail:user.email,
        sellerName:clean(user.displayName)||clean(name)||clean(user.email?.split('@')[0]),
        businessId:business.id,
        businessName:clean(business.name),
        status:'pending',
        createdAt:serverTimestamp()
      });
      setNotice('Your request has been sent to NaijaShelf for review. We will show its status here.');
      setSelectedBusiness('');
    } catch(e) {
      setError(e.code==='permission-denied'?'Request blocked by Firestore Rules. Confirm the latest rules are published and your email is verified.':e.message||'Could not submit your request.');
    } finally { setSendingRequest(false); }
  }

  if (!authReady) return <main className="seller-page"><p>Loading seller account…</p></main>;

  return <main className="seller-page">
    <a className="seller-back" href="/"><ArrowLeft size={15}/> Back to NaijaShelf</a>
    <section className="seller-card">
      <a href="/" className="seller-brand"><span><Store size={20}/></span><b>naija<span>shelf</span><i>.</i></b></a>
      {!user ? <>
        <div className="seller-kicker"><ShieldCheck size={14}/> SELLER ACCOUNT</div>
        <h1>{mode==='register'?'Create your seller account':'Welcome back'}</h1>
        <p className="seller-intro">Create a secure account to request access to your approved NaijaShelf business listing.</p>
        <form className="seller-form" onSubmit={submitAuth}>
          {mode==='register' && <label>Full name<input required minLength="2" maxLength="80" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name"/></label>}
          <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
          <label>Password<input required type="password" minLength="8" autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          {error && <p className="seller-error" role="alert">{error}</p>}
          {notice && <p className="seller-success" role="status">{notice}</p>}
          <button disabled={busy}>{busy?'Please wait…':mode==='register'?'Create account':'Sign in'}</button>
        </form>
        <p className="seller-switch">{mode==='register'?'Already have an account?':'New to NaijaShelf?'} <button onClick={()=>{setMode(mode==='register'?'login':'register');setError('');setNotice('');}}>{mode==='register'?'Sign in':'Create an account'}</button></p>
      </> : !user.emailVerified ? <>
        <div className="seller-kicker"><MailCheck size={14}/> VERIFY YOUR EMAIL</div>
        <h1>One quick security step</h1>
        <p className="seller-intro">We sent a verification link to <b>{user.email}</b>. Verify your email before requesting access to a business listing.</p>
        {error && <p className="seller-error" role="alert">{error}</p>}
        {notice && <p className="seller-success" role="status">{notice}</p>}
        <button className="seller-primary" onClick={checkVerification} disabled={busy}>{busy?'Checking…':'I have verified my email'}</button>
        <button className="seller-secondary" onClick={resendVerification}>Resend verification email</button>
        <button className="seller-text-button" onClick={()=>signOut(auth)}>Sign out</button>
      </> : <>
        <div className="seller-dashboard-head"><div><div className="seller-kicker"><ShieldCheck size={14}/> SELLER WORKSPACE</div><h1>Hello, {clean(user.displayName)||user.email?.split('@')[0]}</h1><p className="seller-intro">Your account is verified. Access to a business listing requires NaijaShelf approval.</p></div><button className="seller-signout" onClick={()=>signOut(auth)}><LogOut size={14}/> Sign out</button></div>
        {error && <p className="seller-error" role="alert">{error}</p>}
        {notice && <p className="seller-success" role="status">{notice}</p>}
        <section className="seller-overview">
          <div className="seller-overview-heading"><div><span className="seller-kicker">YOUR BUSINESS OVERVIEW</span><h2>Business dashboard</h2><p>Manage your NaijaShelf presence and keep your listing information up to date.</p></div></div>
          <div className="seller-stat-grid">
            <article><span>Linked businesses</span><b>{ownedBusinesses.length}</b><small>Connected to your account</small></article>
            <article><span>Approved listings</span><b>{ownedBusinesses.filter(item=>item.status==='approved').length}</b><small>Visible in the directory</small></article>
            <article><span>Verified businesses</span><b>{ownedBusinesses.filter(item=>item.isVerified===true).length}</b><small>Independently verified by NaijaShelf</small></article>
          </div>
        </section>
        <section className="seller-section"><h2>Your businesses</h2>
          {ownedBusinesses.length ? <div className="seller-business-list">{ownedBusinesses.map(item=><article className="seller-business-card" key={item.id}>
            <div className="seller-business-identity">
              <div className="seller-business-logo">{item.logoUrl?<img src={item.logoUrl} alt=""/>:<Store size={21}/>}</div>
              <div><b>{item.name}</b><span>{item.category||'Business'} · {item.location||item.city||'Location not set'}</span><small className="seller-listing-state"><i/> Approved and published</small></div>
            </div>
            <div className="seller-business-actions"><a href={'/business/'+encodeURIComponent(item.id)}>View public profile</a></div>
          </article>)}</div> : <p className="seller-muted">No business has been linked to this account yet.</p>}
        </section>
        <section className="seller-section"><h2>Request access to a business</h2>
          <p className="seller-muted">Choose your existing approved listing. NaijaShelf will review the request and verify your connection to the business before linking it.</p>
          {requests.map(item=><div className="seller-request" key={item.id}><b>{item.businessName}</b><span className={'seller-status '+item.status}>{item.status}</span><small>Request submitted · {item.createdAt?.toDate?.().toLocaleDateString()||'Just now'}</small></div>)}
          {!requests.some(item=>item.status==='pending'||item.status==='approved') && <form className="seller-form" onSubmit={requestAccess}>
            <label>Choose your approved business
              <select required value={selectedBusiness} onChange={e=>setSelectedBusiness(e.target.value)}>
                <option value="">Select a business listing</option>
                {businesses.map(item=><option key={item.id} value={item.id}>{item.name} · {item.location||item.city||'Location not set'}</option>)}
              </select>
            </label>
            <button disabled={sendingRequest||!businesses.length}>{sendingRequest?'Sending request…':'Request business access'}</button>
            {!businesses.length && <small className="seller-muted">No approved listings are currently available. Submit a business listing first and return after it is approved.</small>}
          </form>}
        </section>
      </>}
    </section>
    <p className="seller-footnote">NaijaShelf will review ownership requests manually. A seller account does not automatically grant access to a business listing.</p>
  </main>;
}
