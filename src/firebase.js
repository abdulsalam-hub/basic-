import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBDYHSU2rzvp_DusU69LATiUhkzhEGHPQ0',
  authDomain: 'naijaself.firebaseapp.com',
  projectId: 'naijaself',
  storageBucket: 'naijaself.firebasestorage.app',
  messagingSenderId: '396253092621',
  appId: '1:396253092621:web:0257aa1cf219f2d3606e44',
  measurementId: 'G-67DPZVNXTN'
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
