import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { BadgeCheck, ImagePlus, Save, Store, UploadCloud } from 'lucide-react';
import { auth, db } from './firebase.js';

const CLOUDINARY_CLOUD_NAME = 'f3sptoih';
const CLOUDINARY_UPLOAD_PRESET = 'NaijaShelf';
const blank = { name:'', category:'', location:'', address:'', description:'', whatsapp:'', phone:'', website:'', instagram:'', logoUrl:'', coverImage:'', productsText:'' };
const clean = value => String(value || '').trim();

export default function BusinessProfileEditor() {
  const [businesses,setBusinesses] = useState([]);
  const [selectedId,setSelectedId] = useState('');
  const [form,setForm] = useState(blank);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [uploading,setUploading] = useState('');
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');

  useEffect(() => onSnapshot(query(collection(db,'businesses'),where('status','==','approved')), snap => {
    const approved = snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.status==='approved').sort((a,b)=>clean(a.name).localeCompare(clean(b.name)));
    setBusinesses(approved);
    setSelectedId(current => approved.some(x=>x.id===current) ? current : (approved[0]?.id || ''));
    setLoading(false);
  }, err => { console.error(err); setError('Could not load published businesses. Check Firestore Rules and admin access.'); setLoading(false); }), []);

  const selected = useMemo(()=>businesses.find(x=>x.id===selectedId),[businesses,selectedId]);
  useEffect(() => {
    if (!selected) { setForm(blank); return; }
    setForm({
      name:selected.name || '', category:selected.category || '', location:selected.location || selected.city || '',
      address:selected.address || '', description:selected.description || '', whatsapp:selected.whatsapp || '',
      phone:selected.phone || '', website:selected.website || '', instagram:selected.instagram || '',
      logoUrl:selected.logoUrl || '', coverImage:selected.coverImage || '',
      productsText:Array.isArray(selected.products) ? selected.products.map(p=>typeof p==='string'?p:(p.name||p.title||'')).join('\n') : ''
    });
    setMessage(''); setError('');
  },[selectedId,selected?.updatedAt]);

  const change = key => e => setForm(current=>({...current,[key]:e.target.value}));

  async function uploadImage(kind,file) {
    if (!selectedId || !file) return;
    setError(''); setMessage('');
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('Please choose a JPG, PNG or WebP image.'); return; }
    if (file.size > 5*1024*1024) { setError('Image must be 5 MB or smaller.'); return; }
    setUploading(kind);
    try {
      const body = new FormData();
      body.append('file',file);
      body.append('upload_preset',CLOUDINARY_UPLOAD_PRESET);
      body.append('folder','naijashelf/businesses/'+selectedId);
      body.append('public_id',kind+'-'+Date.now());
      const response = await fetch('https://api.cloudinary.com/v1_1/'+CLOUDINARY_CLOUD_NAME+'/image/upload',{method:'POST',body});
      const result = await response.json();
      if (!response.ok || !result.secure_url) {
        console.error('Cloudinary upload error:',result);
        throw new Error(result?.error?.message || 'Cloudinary rejected the upload. Check the unsigned preset name and settings.');
      }
      setForm(current=>({...current,[kind==='logo'?'logoUrl':'coverImage']:result.secure_url}));
      setMessage((kind==='logo'?'Logo':'Cover image')+' uploaded to Cloudinary. Save changes to publish it.');
    } catch(e) {
      console.error(e);
      setError(e.message || 'Image upload failed. Check your internet connection and Cloudinary upload preset.');
    } finally { setUploading(''); }
  }

  async function save(e) {
    e.preventDefault();
    if (!selectedId) return;
    if (clean(form.name).length < 2) { setError('Business name must contain at least 2 characters.'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      await updateDoc(doc(db,'businesses',selectedId),{
        name:clean(form.name), category:clean(form.category), location:clean(form.location), city:clean(form.location),
        address:clean(form.address), description:clean(form.description), whatsapp:clean(form.whatsapp),
        phone:clean(form.phone), website:clean(form.website), instagram:clean(form.instagram),
        logoUrl:clean(form.logoUrl), coverImage:clean(form.coverImage),
        products:form.productsText.split('\n').map(clean).filter(Boolean).slice(0,30),
        updatedAt:serverTimestamp(), updatedBy:auth.currentUser?.uid || ''
      });
      setMessage('Business profile saved. The public profile will show the updated details.');
    } catch(e) {
      console.error(e);
      setError('Could not save changes. Confirm the admin claim and publish the latest Firestore Rules.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="admin-empty">Loading published businesses…</div>;
  if (!businesses.length) return <div className="editor-empty"><Store size={28}/><b>No approved businesses yet</b><span>Approve a seller application first. Published businesses will appear here for editing.</span></div>;

  return <section className="business-editor">
    <div className="editor-heading"><div><div className="admin-eyebrow"><BadgeCheck size={14}/> PUBLISHED DIRECTORY</div><h2>Business profile editor</h2><p>Update the information customers see on each public business page.</p></div><span className="editor-count">{businesses.length} approved</span></div>
    <label className="editor-select-label">Choose a business
      <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{businesses.map(b=><option key={b.id} value={b.id}>{b.name} · {b.location || b.city || 'No location'}</option>)}</select>
    </label>
    {selected && <form className="editor-form" onSubmit={save}>
      <div className="editor-media-grid">
        <div className="editor-media-card"><div className="editor-image-preview">{form.logoUrl?<img src={form.logoUrl} alt="Business logo preview"/>:<Store size={28}/>}</div><div><b>Business logo</b><small>Square image recommended · max 5 MB</small><label className="editor-upload"><UploadCloud size={14}/>{uploading==='logo'?'Uploading…':'Upload logo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e=>uploadImage('logo',e.target.files?.[0])}/></label></div></div>
        <div className="editor-media-card editor-cover-card"><div className="editor-image-preview">{form.coverImage?<img src={form.coverImage} alt="Cover preview"/>:<ImagePlus size={28}/>}</div><div><b>Cover photo</b><small>Wide image recommended · max 5 MB</small><label className="editor-upload"><UploadCloud size={14}/>{uploading==='cover'?'Uploading…':'Upload cover'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e=>uploadImage('cover',e.target.files?.[0])}/></label></div></div>
      </div>
      <div className="editor-fields">
        <label>Business name<input required minLength="2" maxLength="100" value={form.name} onChange={change('name')}/></label>
        <label>Category<input value={form.category} onChange={change('category')}/></label>
        <label>City / area<input value={form.location} onChange={change('location')}/></label>
        <label>Full address<input value={form.address} onChange={change('address')} placeholder="Street, area, city"/></label>
        <label className="editor-full">Business description<textarea rows="5" maxLength="1200" value={form.description} onChange={change('description')} placeholder="Tell customers what makes this business special…"/></label>
        <label className="editor-full">Products & services <span className="editor-hint">One item per line, up to 30 items.</span><textarea rows="5" value={form.productsText} onChange={change('productsText')} placeholder={'Ready-to-wear clothing\nCustom tailoring\nAccessories'}/></label>
        <label>WhatsApp number<input value={form.whatsapp} onChange={change('whatsapp')} placeholder="080… or 234…"/></label>
        <label>Phone number<input value={form.phone} onChange={change('phone')}/></label>
        <label>Website<input value={form.website} onChange={change('website')} placeholder="https://example.com"/></label>
        <label>Instagram username / link<input value={form.instagram} onChange={change('instagram')} placeholder="@yourbusiness"/></label>
      </div>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      {message && <div className="editor-success" role="status">{message}</div>}
      <div className="editor-save-row"><span>Changes update the existing approved listing.</span><button className="approve-action" disabled={saving || !!uploading}><Save size={15}/>{saving?'Saving…':'Save profile changes'}</button></div>
    </form>}
  </section>;
}
