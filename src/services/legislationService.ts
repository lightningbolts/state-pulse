'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { Legislation, LegislationHistoryEvent, LegislationSponsor } from '@/types/legislation';

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
    // Prepare data for Firestore, converting Dates to Timestamps
    const dataToSave: Partial<Legislation> = {
      ...legislationData,
    };

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

// Example of how you might call this function:
/*
async function exampleUsage() {
  const newBill: Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
    introductionDate?: Date;
    lastActionDate?: Date;
    effectiveDate?: Date;
    history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
    versions?: Array<{ date: Date; url: string; name: string }>;
  } = {
    title: "The Sunshine Act of 2024",
    billNumber: "SB 101",
    jurisdiction: "CA",
    status: "Introduced",
    summary: "A bill to promote transparency in government.",
    fullTextUrl: "https://example.com/sb101.pdf",
    sponsors: [{ name: "Sen. Jane Doe" }],
    introductionDate: new Date("2024-01-15"),
    history: [
      { date: new Date("2024-01-15"), action: "Introduced", actor: "Senate" },
      { date: new Date("2024-02-01"), action: "Referred to Committee", actor: "Rules Committee" }
    ],
    tags: ["transparency", "government"],
    sourceId: "ca-sb-101-2024",
    chamber: "Senate",
    versions: [{ date: new Date("2024-01-15"), url: "https://example.com/sb101-v1.pdf", name: "Introduced Version"}]
  };

  try {
    const billId = await addLegislation(newBill);
    console.log("Successfully added bill with ID:", billId);
  } catch (error) {
    console.error("Could not add bill:", error);
  }
}

// exampleUsage();
*/
