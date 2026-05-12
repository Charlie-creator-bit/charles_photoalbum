import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);
export const storage = getStorage(app);

// Increase timeout settings for storage
// Note: Firebase Storage JS SDK doesn't have a direct 'timeout' property on getStorage,
// but we can set it on the task if needed. 
// However, setting the max retry time globally can help.
// Unfortunately, the modern SDK hides some of these behind internal configurations.
// We will stick with the resumable upload which is better at handling interruptions.
export const googleProvider = new GoogleAuthProvider();

// Validation connection as per instructions
async function testConnection() {
  try {
    // Attempt to get a dummy doc to check connection
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or connection.");
    }
  }
}

testConnection();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);
