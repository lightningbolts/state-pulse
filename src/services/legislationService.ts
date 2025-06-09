import {
    collection,
    doc,
    setDoc,
    getDoc,
    Timestamp,
    // Add any other Firestore imports you use, like query, where, getDocs, etc.
  } from 'firebase/firestore';
  import { db } from '@/lib/firebase'; // Adjust path if your Firebase init is elsewhere
  import { OpenStatesBill } from '@/types/legislation'; // Or your specific type path
  
  // Helper function to robustly convert various date inputs to Firestore Timestamp or null
  function toFirestoreTimestamp(dateInput: Date | Timestamp | string | null | undefined): Timestamp | null {
    if (dateInput === null || typeof dateInput === 'undefined') {
      return null;
    }
    if (dateInput instanceof Timestamp) {
      return dateInput; // Already a Firestore Timestamp
    }
    if (dateInput instanceof Date) {
      // Check if the Date object is valid before converting
      return isNaN(dateInput.getTime()) ? null : Timestamp.fromDate(dateInput);
    }
    if (typeof dateInput === 'string') {
      if (dateInput.trim() === "") {
        return null;
      }
      // Attempt to parse the string, taking only the date part if time is included with a space
      const date = new Date(dateInput.split(' ')[0]);
      return isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
    }
    // console.warn(`toFirestoreTimestamp (legislationService): Unhandled date type - ${typeof dateInput}`, dateInput); // Optional for debugging
    return null; // Fallback for unhandled types
  }
  
  /**
   * Prepares data for Firestore by converting specific fields (especially dates)
   * to Firestore-compatible types (e.g., Timestamp).
   * @param data The raw data object, potentially with mixed date types.
   * @returns A new object with data prepared for Firestore.
   */
  function prepareDataForFirestore(data: Partial<OpenStatesBill> | any): any {
    const preparedData = { ...data };
  
    // Convert known top-level date fields using the helper
    if (preparedData.hasOwnProperty('introductionDate')) {
      preparedData.introductionDate = toFirestoreTimestamp(preparedData.introductionDate);
    }
    if (preparedData.hasOwnProperty('lastActionDate')) {
      preparedData.lastActionDate = toFirestoreTimestamp(preparedData.lastActionDate);
    }
    if (preparedData.hasOwnProperty('effectiveDate')) {
      preparedData.effectiveDate = toFirestoreTimestamp(preparedData.effectiveDate);
    }
  
    // Handle history events if they exist and have dates
    if (Array.isArray(preparedData.history)) {
      preparedData.history = preparedData.history.map((event: any) => {
        if (event && event.hasOwnProperty('date')) {
          const timestamp = toFirestoreTimestamp(event.date);
          if (timestamp === null) {
            // console.warn('Invalid date in history event, removing event:', event);
            return null; // Mark for removal if date is invalid
          }
          return { ...event, date: timestamp };
        }
        return event; // Return event as-is if no date property or not an object
      }).filter((event: any) => event !== null); // Remove events marked for removal
    }
  
    // Handle versions if they exist and have dates
    if (Array.isArray(preparedData.versions)) {
      preparedData.versions = preparedData.versions.map((version: any) => {
        if (version && version.hasOwnProperty('date')) {
           const timestamp = toFirestoreTimestamp(version.date);
          if (timestamp === null) {
            // console.warn('Invalid date in version, removing version:', version);
            return null; // Mark for removal if date is invalid
          }
          return { ...version, date: timestamp };
        }
        return version; // Return version as-is if no date property or not an object
      }).filter((version: any) => version !== null); // Remove versions marked for removal
    }
  
    // Ensure createdAt and updatedAt are Timestamps
    // If createdAt is being set for the first time (i.e., not present or not a Timestamp), use Timestamp.now()
    // If it exists and is already a Timestamp (e.g. from fetchOpenStatesDataHistorical), it will be returned as is by toFirestoreTimestamp
    preparedData.createdAt = toFirestoreTimestamp(preparedData.createdAt) || Timestamp.now();
    preparedData.updatedAt = Timestamp.now(); // Always set updatedAt to current time on upsert
  
    // Optional: Remove any fields that became null if Firestore should omit them
    // This depends on your schema and whether you want to store nulls or delete the field.
    // Example:
    // Object.keys(preparedData).forEach(key => {
    //   if (preparedData[key] === null) {
    //     delete preparedData[key];
    //   }
    // });
  
    return preparedData;
  }
  
  export async function upsertLegislationBySourceId(legislationData: OpenStatesBill): Promise<void> {
    if (!legislationData.id) {
      console.error('sourceId is required to upsert legislation.', legislationData);
      throw new Error('sourceId is required to upsert legislation.');
    }
  
    const legislationCollection = collection(db, 'legislation');
    // Firestore disallows empty strings as document IDs.
    // Ensure sourceId is a non-empty string.
    const docId = legislationData.id.replace(/\//g, '_'); // Replace slashes if they cause issues, or ensure valid ID
    if (!docId) {
        console.error('Generated document ID is empty. Original sourceId:', legislationData.id);
        throw new Error('Generated document ID is empty.');
    }
    const legislationRef = doc(legislationCollection, docId);
  
    try {
      // Prepare data for Firestore, ensuring all date fields are correctly formatted
      // This is the critical step where `prepareDataForFirestore` is called.
      const dataToSet = prepareDataForFirestore(legislationData);
  
      // console.log(`Upserting to Firestore (ID: ${docId}):`, JSON.stringify(dataToSet, null, 2)); // For debugging
  
      await setDoc(legislationRef, dataToSet, { merge: true });
      // console.log(`Legislation with sourceId ${legislationData.sourceId} (docId: ${docId}) upserted successfully.`);
    } catch (error) {
      console.error(`Error upserting legislation document with sourceId ${legislationData.id} (docId: ${docId}): `, error);
      // Log the data that was attempted to be set for more detailed debugging
      // console.error('Data attempted to set:', JSON.stringify(legislationData, null, 2)); // Log original data
      // console.error('Prepared data attempted to set:', JSON.stringify(prepareDataForFirestore(legislationData), null, 2)); // Log prepared data
      throw new Error('Failed to upsert legislation.');
    }
  }
  
  // Example of fetching a single legislation document (if you need it)
  export async function getLegislationBySourceId(sourceId: string): Promise<OpenStatesBill | null> {
    if (!sourceId) {
      console.error('sourceId is required to fetch legislation.');
      return null;
    }
    const legislationCollection = collection(db, 'legislation');
    const docId = sourceId.replace(/\//g, '_');
    const legislationRef = doc(legislationCollection, docId);
  
    try {
      const docSnap = await getDoc(legislationRef);
      if (docSnap.exists()) {
        // Note: Firestore Timestamps will be retrieved as Timestamp objects.
        // If you need to convert them to JS Dates for client-side use, do it here or in the client.
        return docSnap.data() as OpenStatesBill;
      } else {
        // console.log(`No legislation found with sourceId ${sourceId}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching legislation document with sourceId ${sourceId}: `, error);
      return null;
    }
  }