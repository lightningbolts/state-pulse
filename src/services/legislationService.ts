
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";
import type { Legislation, LegislationHistoryEvent, LegislationSponsor } from '@/types/legislation';

// Helper to convert JS Dates in legislation data to Firestore Timestamps
function prepareDataForFirestore(
  legislationData: Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
    introductionDate?: Date;
    lastActionDate?: Date;
    effectiveDate?: Date;
    history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
    versions?: Array<{ date: Date; url: string; name: string }>;
  }
): Partial<Legislation> {
  const dataToSave: Partial<Legislation> = { ...legislationData };

  if (legislationData.introductionDate) {
    dataToSave.introductionDate = Timestamp.fromDate(legislationData.introductionDate);
  }
  if (legislationData.lastActionDate) {
    dataToSave.lastActionDate = Timestamp.fromDate(legislationData.lastActionDate);
  }
  if (legislationData.effectiveDate) {
    dataToSave.effectiveDate = Timestamp.fromDate(legislationData.effectiveDate);
  }

  if (legislationData.history) {
    dataToSave.history = legislationData.history.map(event => ({
      ...event,
      date: Timestamp.fromDate(event.date),
    }));
  }
  
  if (legislationData.versions) {
      dataToSave.versions = legislationData.versions.map(version => ({
          ...version,
          date: Timestamp.fromDate(version.date),
      }));
  }
  return dataToSave;
}


/**
 * Adds a new legislation document to the 'legislations' collection in Firestore.
 * Dates should be JavaScript Date objects; they will be converted to Firestore Timestamps.
 * @param legislationData - The legislation data to add.
 * @returns The ID of the newly created document.
 */
export async function addLegislation(legislationData: Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
  introductionDate?: Date;
  lastActionDate?: Date;
  effectiveDate?: Date;
  history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
  versions?: Array<{ date: Date; url: string; name: string }>;
}): Promise<string> {
  try {
    const dataToSave = prepareDataForFirestore(legislationData);

    // If lastActionDate is not provided, set it to now for new entries
    if (!dataToSave.lastActionDate) {
      dataToSave.lastActionDate = serverTimestamp() as Timestamp;
    }

    const docRef = await addDoc(collection(db, "legislations"), dataToSave);
    console.log("Legislation document written with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding legislation document: ", e);
    throw new Error("Failed to add legislation.");
  }
}

/**
 * Adds or updates a legislation document in Firestore based on its sourceId.
 * If a document with the given sourceId exists, it's updated. Otherwise, a new document is created.
 * Dates in legislationData should be JavaScript Date objects.
 * @param legislationData - The legislation data to upsert. Must include `sourceId`.
 * @returns The Firestore document ID of the upserted document.
 */
export async function upsertLegislationBySourceId(
  legislationData: Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
    sourceId: string; // sourceId is mandatory for upserting
    introductionDate?: Date;
    lastActionDate?: Date;
    effectiveDate?: Date;
    history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
    versions?: Array<{ date: Date; url: string; name: string }>;
  }
): Promise<string> {
  if (!legislationData.sourceId) {
    throw new Error("sourceId is required for upserting legislation.");
  }

  const legislationsRef = collection(db, "legislations");
  const q = query(legislationsRef, where("sourceId", "==", legislationData.sourceId));

  try {
    const querySnapshot = await getDocs(q);
    const dataToSave = prepareDataForFirestore(legislationData);

    if (!querySnapshot.empty) {
      // Document exists, update it
      const existingDocRef = querySnapshot.docs[0].ref;
      // Ensure lastActionDate is updated if provided, otherwise keep existing or set if new.
      // For updates, we typically expect lastActionDate to be part of the incoming data if it changed.
      // If not provided in update data, it implies no change to this specific field from the source.
      // However, if the record itself is updated, its lastActionDate (from OpenStates) effectively becomes the update time.
      if (!dataToSave.lastActionDate && legislationData.lastActionDate) { // If JS date was provided
         dataToSave.lastActionDate = Timestamp.fromDate(legislationData.lastActionDate);
      }

      await updateDoc(existingDocRef, dataToSave);
      console.log(`Legislation document with sourceId ${legislationData.sourceId} updated. Firestore ID: ${existingDocRef.id}`);
      return existingDocRef.id;
    } else {
      // Document does not exist, add it
      // If lastActionDate is not provided for a new record, set it to now
      if (!dataToSave.lastActionDate) {
        dataToSave.lastActionDate = serverTimestamp() as Timestamp;
      }
      const newDocRef = await addDoc(legislationsRef, dataToSave);
      console.log(`New legislation document with sourceId ${legislationData.sourceId} added. Firestore ID: ${newDocRef.id}`);
      return newDocRef.id;
    }
  } catch (e) {
    console.error(`Error upserting legislation document with sourceId ${legislationData.sourceId}: `, e);
    throw new Error("Failed to upsert legislation.");
  }
}


// Example of how you might call this function:
/*
async function exampleUsage() {
  const newBill: Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
    sourceId: string;
    introductionDate?: Date;
    lastActionDate?: Date;
    effectiveDate?: Date;
    history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
    versions?: Array<{ date: Date; url: string; name: string }>;
  } = {
    title: "The Sunshine Act of 2024 (Updated)",
    billNumber: "SB 101",
    jurisdiction: "CA",
    status: "In Committee", // Status updated
    summary: "A bill to promote transparency in government and add new reporting requirements.", // Summary updated
    fullTextUrl: "https://example.com/sb101.pdf",
    sponsors: [{ name: "Sen. Jane Doe" }, { name: "Sen. John Smith", id: "ocd-person/xyz" }], // Sponsor added
    introductionDate: new Date("2024-01-15"),
    lastActionDate: new Date("2024-07-29"), // lastActionDate updated
    history: [
      { date: new Date("2024-01-15"), action: "Introduced", actor: "Senate" },
      { date: new Date("2024-02-01"), action: "Referred to Committee", actor: "Rules Committee" },
      { date: new Date("2024-07-29"), action: "Amended in Committee", actor: "Rules Committee"} // New history event
    ],
    tags: ["transparency", "government", "reporting"], // Tag added
    sourceId: "ca-sb-101-2024", // CRUCIAL for upsert
    chamber: "Senate",
    versions: [
        { date: new Date("2024-01-15"), url: "https://example.com/sb101-v1.pdf", name: "Introduced Version"},
        { date: new Date("2024-07-29"), url: "https://example.com/sb101-v2-amended.pdf", name: "Amended Committee Version"} // New version
    ]
  };

  try {
    const billId = await upsertLegislationBySourceId(newBill);
    console.log("Successfully upserted bill with Firestore ID:", billId);
  } catch (error) {
    console.error("Could not upsert bill:", error);
  }
}

// exampleUsage();
*/
