import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, auth, storage } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface Photo {
  id: string;
  url: string;
  title?: string;
  description?: string;
  albumId?: string | null;
  userId: string;
  createdAt: Timestamp;
  tags?: string[];
  isPublic?: boolean;
}

export interface Album {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: Timestamp;
}

const PHOTOS_COL = 'photos';
const ALBUMS_COL = 'albums';

export const photoService = {
  getPhotos: (albumId: string | null, callback: (photos: Photo[]) => void) => {
    if (!auth.currentUser) return () => {};
    
    let q = query(
      collection(db, PHOTOS_COL),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    if (albumId) {
      q = query(q, where('albumId', '==', albumId));
    }

    return onSnapshot(q, (snapshot) => {
      const photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Photo));
      callback(photos);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, PHOTOS_COL);
    });
  },

  getAlbums: (callback: (albums: Album[]) => void) => {
    if (!auth.currentUser) return () => {};

    const q = query(
      collection(db, ALBUMS_COL),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const albums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Album));
      callback(albums);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, ALBUMS_COL);
    });
  },

  createAlbum: async (name: string, description: string = '') => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    try {
      const docRef = await addDoc(collection(db, ALBUMS_COL), {
        name,
        description,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, ALBUMS_COL);
    }
  },

  uploadPhoto: async (url: string, title: string = '', description: string = '', albumId: string | null = null) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    try {
      const docRef = await addDoc(collection(db, PHOTOS_COL), {
        url,
        title,
        description,
        albumId,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        tags: [],
        isPublic: false
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, PHOTOS_COL);
    }
  },

  uploadFile: async (file: File): Promise<string> => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    // Attempt Firebase Storage first
    try {
      const timestamp = Date.now();
      const fileName = `${auth.currentUser.uid}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, `photos/${fileName}`);
      
      return await new Promise((resolve, reject) => {
        // Set a timeout for the entire operation to avoid infinite hanging
        const timeout = setTimeout(() => {
          reject(new Error('Firebase Storage upload timed out. Falling back to local server...'));
        }, 30000); // 30 second timeout for cloud upload

        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log('Firebase Upload: ' + Math.round(progress) + '% done');
          }, 
          (error) => {
            clearTimeout(timeout);
            console.warn('Firebase Storage upload failed, will try fallback:', error.code, error.message);
            reject(error);
          }, 
          async () => {
            clearTimeout(timeout);
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    } catch (cloudError: any) {
      console.warn('Cloud upload failed, attempting local server fallback...', cloudError);
      
      // Fallback: Local Server Upload
      try {
        const formData = new FormData();
        formData.append('files', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Local upload fallback failed' }));
          throw new Error(errorData.error || 'Local upload fallback failed');
        }
        
        const data = await response.json();
        const localUrl = data.urls[0];
        console.log('Successfully uploaded to local server fallback:', localUrl);
        return localUrl;
      } catch (localError: any) {
        console.error('Both Cloud and Local upload failed:', localError);
        throw new Error(`Upload failed. Cloud: ${cloudError.message}. Local: ${localError.message}`);
      }
    }
  },

  updatePhoto: async (photoId: string, updates: Partial<Pick<Photo, 'title' | 'description' | 'albumId' | 'tags' | 'isPublic'>>) => {
    try {
      const docRef = doc(db, PHOTOS_COL, photoId);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${PHOTOS_COL}/${photoId}`);
    }
  },

  deletePhoto: async (photo: Photo) => {
    try {
      // If it's a local upload, try to delete it from the server
      if (photo.url.startsWith('/uploads/')) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: photo.url })
          });
        } catch (err) {
          console.error('Failed to delete physical file:', err);
        }
      } 
      // If it's a Firebase Storage URL, delete it there
      else if (photo.url.includes('firebasestorage.googleapis.com')) {
        try {
          const storageRef = ref(storage, photo.url);
          await deleteObject(storageRef);
        } catch (err) {
          console.error('Failed to delete storage file:', err);
        }
      }

      const docRef = doc(db, PHOTOS_COL, photo.id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${PHOTOS_COL}/${photo.id}`);
    }
  },

  deleteAlbum: async (albumId: string) => {
    try {
      const docRef = doc(db, ALBUMS_COL, albumId);
      await deleteDoc(docRef);
      // Note: Ideally, we should also handle photos with this albumId (set to null or delete)
      // but firestore rules will block unauthorized access anyway.
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${ALBUMS_COL}/${albumId}`);
    }
  },

  getPhotoById: async (photoId: string): Promise<Photo | null> => {
    try {
      const docRef = doc(db, PHOTOS_COL, photoId);
      const docSnap = await getDocFromServer(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Photo;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${PHOTOS_COL}/${photoId}`);
      return null;
    }
  },

  deleteAllPhotos: async (photos: Photo[]) => {
    // Delete all photos concurrently
    return Promise.all(photos.map(p => photoService.deletePhoto(p)));
  }
};
