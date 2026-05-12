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
import { db, auth } from './firebase';

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
          // We continue anyway to at least delete the firestore record
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
