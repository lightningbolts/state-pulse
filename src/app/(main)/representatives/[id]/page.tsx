"use client";
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Representative } from '@/types/representative';
import type { Bill } from '@/types/legislation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import PolicyUpdateCard from '@/components/features/PolicyUpdateCard';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Info, FileText, Tag } from 'lucide-react';
import Link from 'next/link';
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

// Real fetch function for representative detail
const fetchRepresentativeData = async (id: string) => {
  const res = await fetch(`/api/representatives/${id}`);
  if (!res.ok) throw new Error('Failed to fetch representative data');
  return await res.json();
};

const getTimeInOffice = (role: any) => {
  if (!role || !role.start_date) return 'N/A';
  const start = new Date(role.start_date);
  if (isNaN(start.getTime())) return 'N/A';
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  // Adjust if the current month/day is before the start month/day
  if (
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())
  ) {
    years--;
  }
  return years > 0 ? `${years} year${years !== 1 ? 's' : ''}` : '<1 year';
};

const getTopTopics = (bills: Bill[], count = 3) => {
  const topicCounts: Record<string, number> = {};
  bills.forEach(bill => {
    if (Array.isArray(bill.subject)) {
      bill.subject.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    }
  });
  return Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([topic]) => topic);
};

function RepresentativeCard({ rep, timeInOffice }: {
  rep: Representative,
  timeInOffice: string
}) {
  return (
    <div className="flex items-center gap-6 mb-8">
      <img
        src={rep.image || rep.photo || 'https://via.placeholder.com/150'}
        alt={rep.name}
        className="w-32 h-32 rounded-full object-cover border"
      />
      <div>
        <h1 className="text-3xl font-bold mb-2">{rep.name}</h1>
        <div className="text-lg text-gray-700 mb-1">{rep.office} ({rep.party})</div>
        <div className="text-md text-gray-500 mb-1">
          District {rep.district}, {typeof rep.jurisdiction === 'string' ? rep.jurisdiction : rep.jurisdiction?.name}
        </div>
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [showAllBills, setShowAllBills] = useState(false);

  // Guard: check if id is a non-empty string
  const isLikelyRepId = typeof id === 'string' && id.length > 0;
  if (!isLikelyRepId) {
    return (
      <div className="py-8 text-center text-red-600">
        Invalid Representative ID.<br />
        You may have followed a broken or incorrect link.
      </div>
    );
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRepresentativeData(id)
      .then(data => {
        if (!mounted) return;
        setRep(data.representative);
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

  if (loading) return <LoadingOverlay text="Loading representative details..." smallText="Please wait..." />;
  if (error) return <div className="py-8 text-center text-red-600">{error}</div>;
  if (!rep) return <div className="py-8 text-center text-red-600">Representative not found.</div>;

  // Section: Normalize data for display
  const timeInOffice = getTimeInOffice(rep.current_role);
  const recentBills = bills.slice(0, 3);
  const topTopics = getTopTopics(bills);

  // Only compute filterJurisdiction after rep is confirmed non-null
  let filterJurisdiction = '';
  if (!rep) return <div className="py-8 text-center text-red-600">Representative not found.</div>;
  const office = (rep.office || '').toLowerCase();
  if (
    office.includes('u.s. senator') ||
    office.includes('us senator') ||
    office.includes('u.s. representative') ||
    office.includes('us representative')
  ) {
    filterJurisdiction = 'United States Congress';
  } else if (typeof rep.jurisdiction === 'string') {
    filterJurisdiction = rep.jurisdiction;
  } else if (rep.jurisdiction && typeof rep.jurisdiction.name === 'string') {
    filterJurisdiction = rep.jurisdiction.name;
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="w-full max-w-4xl mx-auto shadow-xl rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-700 text-primary-foreground p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
            <div className="flex justify-center sm:block mb-4 sm:mb-0">
              <img
                src={rep.image || rep.photo || 'https://via.placeholder.com/150'}
                alt={rep.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border shadow-lg"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col items-center justify-center sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight break-words text-center sm:text-left">{rep.name}</CardTitle>
                {rep.party && (
                  <Badge
                    className="bg-black text-white border-black text-base font-semibold px-4 py-1 mt-2 sm:mt-0 sm:ml-4 whitespace-nowrap mx-auto sm:mx-0"
                    style={{ minWidth: 64, textAlign: 'center' }}
                  >
                    {rep.party}
                  </Badge>
                )}
              </div>
              <div className="text-primary-foreground/80 text-sm mt-2 break-words text-center sm:text-left">
                {rep.office}
              </div>
              <div className="text-primary-foreground/80 text-sm mt-1 break-words text-center sm:text-left">
                {rep.current_role?.org_classification && (
                  <span>
                    Chamber: {rep.current_role.org_classification === 'upper' ? 'Senate' : rep.current_role.org_classification === 'lower' ? 'House' : rep.current_role.org_classification.charAt(0).toUpperCase() + rep.current_role.org_classification.slice(1)}
                  </span>
                )}
              </div>
              <div className="text-primary-foreground/80 text-sm mt-1 break-words text-center sm:text-left">
                {((typeof rep.jurisdiction === 'string' && rep.jurisdiction) || (rep.jurisdiction?.name)) && (
                  <span>{typeof rep.jurisdiction === 'string' ? rep.jurisdiction : rep.jurisdiction?.name}</span>
                )}
                {rep.current_role?.district && (
                  <span>{((typeof rep.jurisdiction === 'string' && rep.jurisdiction) || (rep.jurisdiction?.name)) ? ' - ' : ''}District {rep.current_role.district}</span>
                )}
              </div>
              <div className="text-md text-gray-200 mt-2 text-center sm:text-left">Time in office: <span className="font-semibold">{timeInOffice}</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6 bg-background">
          <AnimatedSection>
            <section>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Key Details
              </h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {rep.email && (
                  <a href={`mailto:${rep.email}`} className="text-primary underline font-medium">
                    {rep.email}
                  </a>
                )}
                {rep.phone && <Badge variant="secondary">Phone: {rep.phone}</Badge>}
                {rep.website && (
                  <Link href={rep.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    <Badge variant="secondary">Website</Badge>
                  </Link>
                )}
              </div>
            </section>
          </AnimatedSection>

          <AnimatedSection>
            <section>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                <FileText className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Bills Sponsored
              </h3>
              <div className="text-md mb-2">Total: <span className="font-bold">{bills.length}</span></div>
              {bills.length === 0 ? (
                <div className="text-sm text-muted-foreground">No bills sponsored by this representative.</div>
              ) : (
                <>
                  <h4 className="text-md font-semibold mb-1">Recent Bills</h4>
                  <div className="space-y-3">
                    {recentBills.map(bill => (
                      <AnimatedSection key={bill.id}>
                        <div className="border rounded-lg p-3 bg-muted/50 flex flex-col gap-2">
                          <div>
                            <span className="font-bold">{bill.identifier}</span>: {bill.title}
                          </div>
                          <Link
                            href={`/legislation/${bill.id}`}
                            className="inline-block mt-2 px-4 py-2 bg-primary text-white rounded font-semibold shadow hover:bg-primary/90 transition-colors text-center"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Details
                          </Link>
                        </div>
                      </AnimatedSection>
                    ))}
                  </div>
                  {bills.length > 3 && (
                    (() => {
                      // Generate a color from the rep's name
                      function stringToHslColor(str: string, s = 70, l = 50) {
                        let hash = 0;
                        for (let i = 0; i < str.length; i++) {
                          hash = str.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const h = hash % 360;
                        return `hsl(${h}, ${s}%, ${l}%)`;
                      }
                      const repColor = rep && rep.name ? stringToHslColor(rep.name) : '#2563eb';
                      return (
                        <Link
                          href={rep && rep.id ? `/legislation?sponsorId=${encodeURIComponent(rep.id)}` : '#'}
                          className="inline-block mt-2 px-4 py-2 rounded font-semibold shadow transition-colors text-center"
                          style={{
                            background: repColor,
                            color: '#fff',
                            border: `2px solid ${repColor}`,
                          }}
                        >
                          View all bills sponsored
                        </Link>
                      );
                    })()
                  )}
                </>
              )}
            </section>
          </AnimatedSection>

          <AnimatedSection>
            <section>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                <Tag className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Top Topics
              </h3>
              {topTopics.length === 0 ? (
                <div className="text-sm text-muted-foreground">No topics found for sponsored bills.</div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {topTopics.map(topic => (
                    <Badge key={topic} variant="default" className="text-xs break-words">{topic}</Badge>
                  ))}
                </div>
              )}
            </section>
          </AnimatedSection>
        </CardContent>
      </Card>
    </div>
  );
}
