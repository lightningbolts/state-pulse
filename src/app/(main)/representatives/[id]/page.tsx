export const dynamic = 'force-dynamic';
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { Representative, OpenStatesPerson } from '@/types/representative';
import type { Bill } from '@/types/legislation';

// Real fetch function for representative detail
const fetchRepresentativeData = async (id: string) => {
  const res = await fetch(`/api/representatives/${id}`);
  if (!res.ok) throw new Error('Failed to fetch representative data');
  return await res.json();
};

const getTimeInOffice = (roles: any[]) => {
  if (!roles || roles.length === 0) return 'N/A';
  const startDates = roles.map(r => new Date(r.start_date));
  const earliest = new Date(Math.min(...startDates.map(d => d.getTime())));
  const now = new Date();
  const years = now.getFullYear() - earliest.getFullYear();
  return `${years} year${years !== 1 ? 's' : ''}`;
};

const getTopTopics = (bills: Bill[], count = 3) => {
  const topicCounts: Record<string, number> = {};
  bills.forEach(bill => {
    bill.subject.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
  });
  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([topic]) => topic);
};

function RepresentativeCard({ rep, person, timeInOffice }: {
  rep: Representative,
  person: OpenStatesPerson,
  timeInOffice: string
}) {
  return (
    <div className="flex items-center gap-6 mb-8">
      <img
        src={person.image || rep.photo || 'https://via.placeholder.com/150'}
        alt={rep.name}
        className="w-32 h-32 rounded-full object-cover border"
      />
      <div>
        <h1 className="text-3xl font-bold mb-2">{rep.name}</h1>
        <div className="text-lg text-gray-700 mb-1">{rep.office} ({rep.party})</div>
        <div className="text-md text-gray-500 mb-1">District {rep.district}, {rep.jurisdiction}</div>
        <div className="text-md text-gray-500">Time in office: <span className="font-semibold">{timeInOffice}</span></div>
      </div>
    </div>
  );
}

export default function RepresentativeDetailPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rep, setRep] = useState<Representative | null>(null);
  const [person, setPerson] = useState<OpenStatesPerson | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [showAllBills, setShowAllBills] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRepresentativeData(id)
      .then(data => {
        if (!mounted) return;
        setRep(data.representative);
        setPerson(data.openStatesPerson);
        setBills(data.bills);
        setLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        setError('Failed to load representative data.');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div className="py-8 text-center">Loading representative...</div>;
  if (error || !rep || !person) return <div className="py-8 text-center text-red-600">{error || 'Representative not found.'}</div>;

  const recentBills = bills.slice(0, 3);
  const topTopics = getTopTopics(bills);
  const timeInOffice = getTimeInOffice(person.roles || []);

  return (
    <div className="flex justify-center py-8 px-2">
      <div className="w-full max-w-3xl">
        <RepresentativeCard rep={rep} person={person} timeInOffice={timeInOffice} />

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Bills Sponsored</h2>
          <div className="text-md mb-2">Total: <span className="font-bold">{bills.length}</span></div>
          <div>
            <h3 className="text-md font-semibold mb-1">Recent Bills</h3>
            <ul className="list-disc pl-6">
              {recentBills.map(bill => (
                <li key={bill.id} className="mb-1">
                  <span className="font-bold">{bill.identifier}</span>: {bill.title} <span className="text-gray-500">({bill.latest_action_description})</span>
                </li>
              ))}
            </ul>
            {!showAllBills && bills.length > 3 && (
              <button
                className="mt-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setShowAllBills(true)}
              >
                Show all bills sponsored
              </button>
            )}
            {showAllBills && (
              <div className="mt-4">
                <h3 className="text-md font-semibold mb-1">All Bills Sponsored</h3>
                <ul className="list-disc pl-6">
                  {bills.map(bill => (
                    <li key={bill.id} className="mb-1">
                      <span className="font-bold">{bill.identifier}</span>: {bill.title} <span className="text-gray-500">({bill.latest_action_description})</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-2 px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  onClick={() => setShowAllBills(false)}
                >
                  Hide all bills
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Top Topics</h2>
          <div className="flex gap-2 flex-wrap">
            {topTopics.map(topic => (
              <span key={topic} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
