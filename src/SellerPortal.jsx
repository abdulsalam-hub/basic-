import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification,
  signInWithEmailAndPassword, signOut, reload, updateProfile
} from 'firebase/auth';
import {
  addDoc, collection, getDoc, getDocs, onSnapshot, query, where, doc, serverTimestamp, updateDoc
} from 'firebase/firestore';
import { ArrowLeft, LogOut, MailCheck, Store, ShieldCheck } from 'lucide-react';
import { auth, db } from './firebase.js';
import './seller.css';

const clean = value => String(value || '').trim();
const sellerDays = [['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']];
const sellerDefaultHours = Object.fromEntries(sellerDays.map(([day])=>[day,{open:'09:00',close:'18:00',closed:false}]));

const analyticsKey = date => {
  const year=date.getFullYear(), month=String(date.getMonth()+1).padStart(2,'0'), day=String(date.getDate()).padStart(2,'0');
  return year+'-'+month+'-'+day;
};
const analyticsDays = () => Array.from({length:7},(_,index)=>{
  const date=new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate()-(6-index));
  return {key:analyticsKey(date),label:date.toLocaleDateString(undefined,{weekday:'short'}),dateLabel:date.toLocaleDateString(undefined,{day:'numeric',month:'short'})};
});


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
  const [editingBusiness,setEditingBusiness] = useState('');
  const [savingProfile,setSavingProfile] = useState(false);
  const [uploadingImage,setUploadingImage] = useState('');
  const [profileForm,setProfileForm] = useState({});
  const [analytics,setAnalytics] = useState({});
  const [analyticsLoading,setAnalyticsLoading] = useState(false);
  const [analyticsError,setAnalyticsError] = useState('');
  const [analyticsRefresh,setAnalyticsRefresh] = useState(0);

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


  useEffect(() => {
    if (!user?.emailVerified || !ownedBusinesses.length) { setAnalytics({}); return; }
    let cancelled=false;
    const days=analyticsDays();
    setAnalyticsLoading(true); setAnalyticsError('');
    Promise.all(ownedBusinesses.map(async business=>{
      const snapshot=await getDocs(query(
        collection(db,'businesses',business.id,'analyticsEvents'),
        where('dateKey','>=',days[0].key)
      ));
      const totals={profile_view:0,whatsapp_click:0,phone_click:0};
      const byDay=Object.fromEntries(days.map(day=>[day.key,{profile_view:0,whatsapp_click:0,phone_click:0}]));
      snapshot.docs.forEach(item=>{
        const event=item.data();
        if(totals[event.type]!==undefined && byDay[event.dateKey]) {
          totals[event.type]+=1; byDay[event.dateKey][event.type]+=1;
        }
      });
      return [business.id,{totals,days:days.map(day=>({...day,...byDay[day.key]}))}];
    })).then(rows=>{if(!cancelled)setAnalytics(Object.fromEntries(rows));})
      .catch(error=>{console.error('Seller analytics load failed:',error);if(!cancelled)setAnalyticsError('Analytics could not be loaded. Check that the latest Firestore Rules are published, then refresh.');})
      .finally(()=>{if(!cancelled)setAnalyticsLoading(false);});
    return ()=>{cancelled=true;};
  },[user?.uid,user?.emailVerified,ownedBusinesses.map(item=>item.id).join('|'),analyticsRefresh]);

  const beginEdit = business => {
    setEditingBusiness(business.id);
    setProfileForm({
      name:business.name||'', category:business.category||'', description:business.description||'',
      location:business.location||business.city||'', address:business.address||'',
      phone:business.phone||'', whatsapp:business.whatsapp||'', website:business.website||'',
      instagram:business.instagram||'', logoUrl:business.logoUrl||'', coverImage:business.coverImage||'',
      productsText:Array.isArray(business.products)?business.products.map(p=>typeof p==='string'?p:(p.name||p.title||'')).join('\\n'):'',
      hours:Object.fromEntries(sellerDays.map(([day])=>[day,{...sellerDefaultHours[day],...(business.hours?.[day]||{})}]))
    });
    setError(''); setNotice('');
  };

  async function uploadSellerImage(kind,file) {
    if (!file || !editingBusiness) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('Choose a JPG, PNG or WebP image.'); return; }
    if (file.size>5*1024*1024) { setError('Image must be 5 MB or smaller.'); return; }
    setUploadingImage(kind); setError(''); setNotice('');
    try {
      const body=new FormData();
      body.append('file',file); body.append('upload_preset','NaijaShelf');
      body.append('folder','naijashelf/businesses/'+editingBusiness);
      body.append('public_id',kind+'-'+Date.now());
      const response=await fetch('https://api.cloudinary.com/v1_1/f3sptoih/image/upload',{method:'POST',body});
      const result=await response.json();
      if(!response.ok||!result.secure_url) throw new Error(result?.error?.message||'Image upload failed.');
      setProfileForm(current=>({...current,[kind==='logo'?'logoUrl':'coverImage']:result.secure_url}));
      setNotice((kind==='logo'?'Logo':'Cover image')+' uploaded. Save your profile to publish it.');
    } catch(e) { setError(e.message||'Image upload failed.'); }
    finally { setUploadingImage(''); }
  }

  async function saveSellerProfile(e) {
    e.preventDefault();
    const business=ownedBusinesses.find(item=>item.id===editingBusiness);
    if(!business) { setError('This business is not linked to your account.'); return; }
    if(clean(profileForm.name).length<2) { setError('Business name must contain at least 2 characters.'); return; }
    if(clean(profileForm.description).length>600) { setError('Description must be 600 characters or fewer.'); return; }
    setSavingProfile(true); setError(''); setNotice('');
    try {
      await updateDoc(doc(db,'businesses',editingBusiness),{
        name:clean(profileForm.name), category:clean(profileForm.category),
        description:clean(profileForm.description), location:clean(profileForm.location),
        city:clean(profileForm.location), address:clean(profileForm.address),
        phone:clean(profileForm.phone), whatsapp:clean(profileForm.whatsapp),
        website:clean(profileForm.website), instagram:clean(profileForm.instagram),
        logoUrl:clean(profileForm.logoUrl), coverImage:clean(profileForm.coverImage),
        products:profileForm.productsText.split('\\n').map(clean).filter(Boolean).slice(0,30),
        hours:profileForm.hours,
        updatedAt:serverTimestamp(), updatedBy:user.uid
      });
      setNotice('Business profile updated successfully.');
      setEditingBusiness('');
    } catch(e) {
      setError(e.code==='permission-denied'?'Permission denied. Confirm the latest seller profile security rules have been published.':e.message||'Could not save your business profile.');
    } finally { setSavingProfile(false); }
  }

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
            <div className="seller-business-actions"><a href={'/business/'+encodeURIComponent(item.id)}>View public profile</a><button type="button" onClick={()=>beginEdit(item)}>Edit profile</button></div>
          </article>)}</div> : <p className="seller-muted">No business has been linked to this account yet.</p>}
        </section>
        <section className="seller-section seller-analytics-section">
          <div className="seller-editor-heading"><div><span className="seller-kicker">BUSINESS INSIGHTS</span><h2>Performance analytics</h2><p className="seller-muted">Daily activity and the last seven days for each linked listing.</p></div><button type="button" className="seller-secondary seller-refresh-analytics" onClick={()=>setAnalyticsRefresh(value=>value+1)}>Refresh</button></div>
          {analyticsLoading&&<p className="seller-muted">Loading your business performance…</p>}
          {analyticsError&&<p className="seller-error" role="alert">{analyticsError}</p>}
          {!analyticsLoading&&!analyticsError&&ownedBusinesses.map(business=>{
            const report=analytics[business.id]||{totals:{profile_view:0,whatsapp_click:0,phone_click:0},days:analyticsDays().map(day=>({...day,profile_view:0,whatsapp_click:0,phone_click:0}))};
            const maxValue=Math.max(1,...report.days.map(day=>day.profile_view+day.whatsapp_click+day.phone_click));
            const total=report.totals.profile_view+report.totals.whatsapp_click+report.totals.phone_click;
            return <article className="seller-analytics-card" key={business.id}>
              <div className="seller-analytics-title"><b>{business.name}</b><span>Last 7 days</span></div>
              <div className="seller-analytics-metrics">
                <div><span>Profile visitors</span><b>{report.totals.profile_view}</b></div>
                <div><span>WhatsApp clickers</span><b>{report.totals.whatsapp_click}</b></div>
                <div><span>Phone clickers</span><b>{report.totals.phone_click}</b></div>
              </div>
              <div className="seller-daily-report"><b>Daily performance</b>
                {report.days.map(day=>{
                  const activity=day.profile_view+day.whatsapp_click+day.phone_click;
                  return <div className="seller-daily-row" key={day.key}>
                    <span><b>{day.label}</b><small>{day.dateLabel}</small></span>
                    <div className="seller-daily-track"><i style={{width:(activity/maxValue*100)+'%'}}/></div>
                    <strong>{activity}</strong>
                  </div>;
                })}
              </div>
              <p className="seller-analytics-note">Total recorded actions: {total}. Visitors and contact clickers are deduplicated per signed-in browser account per day. These figures are activity signals, not confirmed sales or completed conversations.</p>
            </article>;
          })}
          {!ownedBusinesses.length&&<p className="seller-muted">Link an approved business to see its performance.</p>}
        </section>
        {editingBusiness && <section className="seller-section seller-editor-section">
          <div className="seller-editor-heading"><div><span className="seller-kicker">BUSINESS SETTINGS</span><h2>Edit business profile</h2><p className="seller-muted">Changes are published to your approved listing after you save.</p></div><button type="button" className="seller-secondary seller-cancel" onClick={()=>setEditingBusiness('')}>Cancel</button></div>
          <form className="seller-form seller-profile-form" onSubmit={saveSellerProfile}>
            <div className="seller-edit-grid">
              <label>Business name<input required maxLength="100" value={profileForm.name||''} onChange={e=>setProfileForm(s=>({...s,name:e.target.value}))}/></label>
              <label>Category<input maxLength="60" value={profileForm.category||''} onChange={e=>setProfileForm(s=>({...s,category:e.target.value}))}/></label>
              <label>City / location<input maxLength="80" value={profileForm.location||''} onChange={e=>setProfileForm(s=>({...s,location:e.target.value}))}/></label>
              <label>Street address<input maxLength="180" value={profileForm.address||''} onChange={e=>setProfileForm(s=>({...s,address:e.target.value}))}/></label>
              <label>Phone number<input type="tel" maxLength="25" value={profileForm.phone||''} onChange={e=>setProfileForm(s=>({...s,phone:e.target.value}))}/></label>
              <label>WhatsApp number<input type="tel" maxLength="25" value={profileForm.whatsapp||''} onChange={e=>setProfileForm(s=>({...s,whatsapp:e.target.value}))}/></label>
              <label>Website<input type="url" maxLength="200" value={profileForm.website||''} onChange={e=>setProfileForm(s=>({...s,website:e.target.value}))} placeholder="https://example.com"/></label>
              <label>Instagram<input maxLength="100" value={profileForm.instagram||''} onChange={e=>setProfileForm(s=>({...s,instagram:e.target.value}))} placeholder="@yourbusiness"/></label>
            </div>
            <label>Business description<textarea rows="4" maxLength="600" value={profileForm.description||''} onChange={e=>setProfileForm(s=>({...s,description:e.target.value}))} placeholder="Describe your products, services and what makes your business useful."/></label>
            <label>Products or services <span className="seller-muted">(one item per line, up to 30)</span><textarea rows="4" maxLength="1500" value={profileForm.productsText||''} onChange={e=>setProfileForm(s=>({...s,productsText:e.target.value}))} placeholder={'Website design\\nGraphic design\\nPrinting'}/></label>
            <div className="seller-hours-editor"><b>Opening hours</b><p className="seller-muted">Set your regular weekly business hours.</p>{sellerDays.map(([day,label])=><div className="seller-hour-row" key={day}><strong>{label}</strong><label className="seller-closed-toggle"><input type="checkbox" checked={!!profileForm.hours?.[day]?.closed} onChange={e=>setProfileForm(s=>({...s,hours:{...s.hours,[day]:{...s.hours[day],closed:e.target.checked}}}))}/> Closed</label><input aria-label={label+' opening time'} type="time" disabled={!!profileForm.hours?.[day]?.closed} value={profileForm.hours?.[day]?.open||'09:00'} onChange={e=>setProfileForm(s=>({...s,hours:{...s.hours,[day]:{...s.hours[day],open:e.target.value}}}))}/><input aria-label={label+' closing time'} type="time" disabled={!!profileForm.hours?.[day]?.closed} value={profileForm.hours?.[day]?.close||'18:00'} onChange={e=>setProfileForm(s=>({...s,hours:{...s.hours,[day]:{...s.hours[day],close:e.target.value}}}))}/></div>)}</div>
            <div className="seller-upload-grid">
              <label>Business logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>uploadSellerImage('logo',e.target.files?.[0])}/>{profileForm.logoUrl&&<img src={profileForm.logoUrl} alt="Business logo preview"/>}</label>
              <label>Cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>uploadSellerImage('cover',e.target.files?.[0])}/>{profileForm.coverImage&&<img src={profileForm.coverImage} alt="Cover image preview"/>}</label>
            </div>
            <p className="seller-muted">Images: JPG, PNG or WebP, maximum 5 MB each. Uploaded images are not published until you save.</p>
            {error&&<p className="seller-error" role="alert">{error}</p>}
            {notice&&<p className="seller-success" role="status">{notice}</p>}
            <button disabled={savingProfile||!!uploadingImage}>{uploadingImage?'Uploading image…':savingProfile?'Saving…':'Save business profile'}</button>
          </form>
        </section>}
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
