import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDeiCP9iXfzhyExE4up9EaV6To_cGxWQtw",
  authDomain: "read-japanese.firebaseapp.com",
  projectId: "read-japanese",
  storageBucket: "read-japanese.firebasestorage.app",
  messagingSenderId: "1084363010320",
  appId: "1:1084363010320:web:113c4252c438aced16b595",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
