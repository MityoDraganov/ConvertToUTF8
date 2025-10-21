import { initializeApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBFpjgDyd6-IeVN6GdPds9Z3XnU8Z2uwIU",
  authDomain: "converttoutf8.firebaseapp.com",
  projectId: "converttoutf8",
  storageBucket: "converttoutf8.firebasestorage.app",
  messagingSenderId: "182203192525",
  appId: "1:182203192525:web:dc8f895fb07d97e01b4584"
};

const app = initializeApp(firebaseConfig);
export const functions = getFunctions(app);