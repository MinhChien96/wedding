// Khởi tạo Firebase một lần, dùng chung cho thiệp (xác nhận tham dự, lời chúc) và tiệc 3D (network.js).
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyCACOtPmdFAb73y0QWaB3wofi385k-s-xA',
  authDomain: 'wedding-f08d3.firebaseapp.com',
  databaseURL: 'https://wedding-f08d3-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'wedding-f08d3',
  storageBucket: 'wedding-f08d3.firebasestorage.app',
  messagingSenderId: '525677830386',
  appId: '1:525677830386:web:19039c5fd13ebc1549b06b',
};

export const ROOT = 'wedding';

export function getDb() {
  return getDatabase(getApps()[0] || initializeApp(firebaseConfig));
}

// id cố định theo thiết bị (mỗi máy một dòng xác nhận / bảng xếp hạng)
export function deviceUid() {
  try {
    let uid = localStorage.getItem('wedding-uid');
    if (!uid) { uid = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; localStorage.setItem('wedding-uid', uid); }
    return uid;
  } catch { return `u${Math.random().toString(36).slice(2, 12)}`; }
}
