import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  QueryDocumentSnapshot,
  SnapshotOptions
} from "firebase/firestore";
import { db } from "../firebase";
import { TemperatureProfile } from "../types";

const COLLECTION_NAME = "profiles";

// Firestore data converter
const profileConverter = {
  toFirestore: (profile: TemperatureProfile) => {
    return {
      name: profile.name,
      description: profile.description,
      startDate: profile.startDate,
      steps: profile.steps || [],
      points: profile.points || [], // Keep points for backup/legacy compatibility
      createdAt: profile.createdAt ? Timestamp.fromDate(profile.createdAt) : Timestamp.now(),
      updatedAt: Timestamp.now()
    };
  },
  fromFirestore: (snapshot: QueryDocumentSnapshot, options: SnapshotOptions): TemperatureProfile => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      steps: data.steps || [], // New field
      points: data.points || [], // Legacy field
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate()
    };
  }
};

export const getProfiles = async (): Promise<TemperatureProfile[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME).withConverter(profileConverter));
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("Error fetching profiles:", error);
    throw error;
  }
};

export const createProfile = async (profile: TemperatureProfile): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME).withConverter(profileConverter), profile);
    return docRef.id;
  } catch (error) {
    console.error("Error adding profile:", error);
    throw error;
  }
};

export const updateProfile = async (id: string, profile: Partial<TemperatureProfile>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...profile,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

export const deleteProfile = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error deleting profile:", error);
    throw error;
  }
};