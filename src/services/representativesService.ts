import { getCollection } from '../lib/mongodb';
import { Representative, OpenStatesPerson } from '../types/representative';
import { Bill } from '../types/legislation';

export async function getRepresentativeById(id: string): Promise<Representative | null> {
  const collection = await getCollection('representatives');
  const rep = await collection.findOne({ id });
  if (!rep) return null;
  const { _id, ...rest } = rep;
  return rest as Representative;
}

export async function getOpenStatesPersonById(id: string): Promise<OpenStatesPerson | null> {
  const collection = await getCollection('openstates_people');
  const person = await collection.findOne({ id });
  if (!person) return null;
  const { _id, ...rest } = person;
  return rest as OpenStatesPerson;
}

export async function getBillsSponsoredByRep(id: string): Promise<Bill[]> {
  const collection = await getCollection('legislation');
  // Assuming 'sponsors' is an array of objects with a 'id' field
  const bills = await collection.find({ 'sponsors.id': id }).toArray();
  return bills.map(({ _id, ...rest }) => rest as Bill);
}
