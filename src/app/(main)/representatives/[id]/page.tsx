import {Button} from "@/components/ui/button";

export const dynamic = 'force-dynamic';
import React from "react";
import { notFound } from "next/navigation";
import type { Representative } from '@/types/representative';
import type { Bill } from '@/types/legislation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import PolicyUpdateCard from '@/components/features/PolicyUpdateCard';
import { Badge } from '@/components/ui/badge';
import {ExternalLink, Info, FileText, Tag, MapPin} from 'lucide-react';
import Link from 'next/link';
import { getRepresentativeById, getBillsSponsoredByRep } from '@/services/representativesService';
import { PartyBadge } from './PartyBadge';
import { generateRepresentativeMetadata } from '@/lib/metadata';
import type { Metadata } from 'next';
import { FollowButton } from '@/components/ui/FollowButton';

const fetchRepresentativeData = async (id: string) => {
  try {
    // Fetch representative data
    const rep = await getRepresentativeById(id);
    if (!rep) {
      return null;
    }
    
    // Helper function to extract party information (consistent with API)
    const extractPartyInfo = (rep: any): string => {
      if (rep.party) return rep.party;
      if (rep.current_role?.party) return rep.current_role.party;
      if (rep.extras?.party) return rep.extras.party;
      if (rep.partyHistory && Array.isArray(rep.partyHistory) && rep.partyHistory.length > 0) {
        return rep.partyHistory[0].partyName;
      }
      if (rep.terms && Array.isArray(rep.terms) && rep.terms.length > 0) {
        const latestTerm = rep.terms[rep.terms.length - 1];
        if (latestTerm.partyName) return latestTerm.partyName;
        if (latestTerm.party) return latestTerm.party;
      }
      if (rep.terms?.item && Array.isArray(rep.terms.item) && rep.terms.item.length > 0) {
        const latestTerm = rep.terms.item[rep.terms.item.length - 1];
        if (latestTerm.partyName) return latestTerm.partyName;
        if (latestTerm.party) return latestTerm.party;
      }
      return 'Unknown';
    };

    // --- Normalization logic (copied from API endpoint) ---
    let normalizedRep = rep;
    try {
      if ('terms' in rep && Array.isArray((rep as any).terms)) {
        const terms = (rep as any).terms;
        const latestTerm = terms[terms.length - 1] || {};
        let normId = rep.id || '';
        if (!normId || normId.length < 8) {
          normId = [
            (rep as any).firstName || (rep as any).first_name || '',
            (rep as any).lastName || (rep as any).last_name || '',
            (rep as any).state || '',
            latestTerm.chamber || '',
            latestTerm.startYear || ''
          ].filter(Boolean).join('-');
        }
        normalizedRep = {
          ...rep,
          id: normId,
          office: latestTerm.memberType || '',
          district: '',
          photo: (rep as any).depiction?.imageUrl || '',
          party: extractPartyInfo(rep),
          jurisdiction: 'state' in rep ? (rep as any).state : (latestTerm.stateName || ''),
          name:
            (rep as any).directOrderName ||
            ('name' in rep ? (rep as any).name : '') ||
            ((rep as any).firstName ? (rep as any).firstName + ' ' : '') + ((rep as any).lastName || ''),
        };
      } else {
        // State rep normalization
        let normId = rep.id || '';
        const firstName = (rep as any).firstName || (rep as any).first_name || '';
        const lastName = (rep as any).lastName || (rep as any).last_name || '';
        const stateVal = (rep as any).state || '';
        if ((!normId || normId.length < 8) && firstName && lastName) {
          normId = [firstName, lastName, stateVal].join('-');
        }
        normalizedRep = {
          ...rep,
          id: normId,
          party: extractPartyInfo(rep), // Use consistent party extraction
        };
      }
    } catch (normError) {
      console.error('[SSR] Normalization error:', normError, rep);
      throw new Error('Failed to normalize representative data');
    }
    
    // Fetch bills sponsored by this representative (always use canonical rep.id)
    let bills: Bill[] = [];
    try {
      bills = await getBillsSponsoredByRep(rep.id);
    } catch (billsError) {
      console.error('[SSR] Bills fetch error:', billsError, normalizedRep);
      // Don't throw here, just continue with empty bills
      bills = [];
    }
    
    return { representative: normalizedRep, bills };
  } catch (error) {
    console.error('[SSR] Error fetching representative data:', error);
    return null;
  }
};

const getTimeInOffice = (rep: any) => {
  // Handle both new structure (terms as direct array) and old structure (terms.item)
  let terms = rep?.terms;
  if (terms?.item && Array.isArray(terms.item)) {
    terms = terms.item;
  }

  if (Array.isArray(terms) && terms.length > 0) {
    // For Congress members: Use earliest startYear in terms
    const startYears = terms
      .map((term: any) => term.startYear)
      .filter((y: any) => typeof y === 'number' && !isNaN(y));
    if (startYears.length > 0) {
      const earliest = Math.min(...startYears);
      const now = new Date();
      let years = now.getFullYear() - earliest;
      return years > 0 ? `${years} year${years !== 1 ? 's' : ''}` : '<1 year';
    }
  }

  // State representatives: Prefer current_role.start_date, fallback to rep.created_at
  const startDate = rep?.current_role?.start_date || rep?.created_at;
  if (!startDate) return 'N/A';
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 'N/A';
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
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

/** Generate rich metadata for the representative detail page */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchRepresentativeData(id);
  if (!data) {
    return { title: 'Representative Not Found - StatePulse', description: 'The requested representative could not be found.' };
  }
  const rep = data.representative;
  const roleTitle = rep.current_role?.title || rep.office || '';
  const jurisdiction = typeof rep.jurisdiction === 'string' ? rep.jurisdiction : rep.jurisdiction?.name;
  // Generate base metadata
  const meta = generateRepresentativeMetadata(rep.name, roleTitle, jurisdiction);
  // Override default images with representative's photo
  const imageUrl = rep.image || rep.photo;
  if (imageUrl) {
    // Override Open Graph and Twitter images with representative's image
    meta.openGraph = {
      ...meta.openGraph,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: rep.name,
        }
      ],
    };
    meta.twitter = {
      ...meta.twitter,
      images: [imageUrl],
    };
  }
  return meta;
}

export default async function RepresentativeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const data = await fetchRepresentativeData(id);
  
  if (!data) {
    notFound();
  }

  const { representative: rep, bills } = data;

  // Section: Normalize data for display
  const timeInOffice = getTimeInOffice(rep);
  const recentBills = bills.slice(0, 3);
  const topTopics = getTopTopics(bills);

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
                {rep.party && <PartyBadge party={rep.party} />}
              </div>
              <div className="text-primary-foreground/80 text-sm mt-2 break-words text-center sm:text-left">
                {(() => {
                  // Check if this is a Congress member and format accordingly
                  const office = rep.office || '';
                  const jurisdiction = typeof rep.jurisdiction === 'string' ? rep.jurisdiction : rep.jurisdiction?.name || '';

                  // Determine if this is a Congress member
                  const isCongressMember = jurisdiction === 'US House' || jurisdiction === 'US Senate' ||
                                          office.toLowerCase().includes('representative') || office.toLowerCase().includes('senator') ||
                                          ((rep as any).terms && Array.isArray((rep as any).terms) && (rep as any).terms.length > 0);

                  if (isCongressMember) {
                    // Extract district from terms or rep object
                    let district = rep.district || (rep as any).district || '';
                    if (!district && (rep as any).terms) {
                      let terms = (rep as any).terms;
                      if (terms.item && Array.isArray(terms.item)) {
                        terms = terms.item;
                      }
                      if (Array.isArray(terms) && terms.length > 0) {
                        const lastTerm = terms.slice(-1)[0];
                        if (lastTerm?.district) district = lastTerm.district;
                      }
                    }

                    // Determine chamber
                    let chamber = '';
                    if ((rep as any).terms && Array.isArray((rep as any).terms) && (rep as any).terms.length > 0) {
                      const lastTerm = (rep as any).terms.slice(-1)[0];
                      if (lastTerm?.chamber === 'House of Representatives') {
                        chamber = 'House';
                      } else if (lastTerm?.chamber === 'Senate') {
                        chamber = 'Senate';
                      }
                    }

                    // Fallback to office field or jurisdiction
                    if (!chamber) {
                      if (office.toLowerCase().includes('representative') || jurisdiction === 'US House') {
                        chamber = 'House';
                      } else if (office.toLowerCase().includes('senator') || jurisdiction === 'US Senate') {
                        chamber = 'Senate';
                      }
                    }

                    // Format the display
                    if (chamber === 'House') {
                      return district ? `US House - ${district}` : 'US House';
                    } else if (chamber === 'Senate') {
                      return 'US Senate';
                    }
                  }

                  // For non-Congress members, return original office
                  return office;
                })()}
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
                {/* Show district for US House reps or state reps */}
                {(rep.district || rep.current_role?.district) && (
                  <span>
                    {((typeof rep.jurisdiction === 'string' && rep.jurisdiction) || (rep.jurisdiction?.name)) ? ' - ' : ''}
                    District {rep.district || rep.current_role?.district}
                  </span>
                )}
              </div>
              <div className="text-primary-foreground/80 text-sm mt-1 break-words text-center sm:text-left">Time in office: <span className="font-semibold">{timeInOffice}</span></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6 bg-background">
          <AnimatedSection>
            <div className="h-10"> {/* reserve button height to avoid layout shift */}
              <FollowButton repId={rep.id} showText />
            </div>
          </AnimatedSection>
          <AnimatedSection>
            <section>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-3">
                <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Contact Information
              </h3>
              <div className="space-y-2 text-sm">
                {rep.phone && (
                  <div className="flex items-center">
                    <span className="font-medium text-muted-foreground w-20">Phone:</span>
                    <a href={`tel:${rep.phone}`} className="text-primary hover:underline">
                      {rep.phone}
                    </a>
                  </div>
                )}
                {rep.email && (
                  <div className="flex items-center">
                    <span className="font-medium text-muted-foreground w-20">Email:</span>
                    <a href={`mailto:${rep.email}`} className="text-primary hover:underline break-all">
                      {rep.email}
                    </a>
                  </div>
                )}
                {((rep as any).address || (rep.addresses && rep.addresses[0]?.address)) && (
                  <div className="flex items-start">
                    <span className="font-medium text-muted-foreground w-20 flex-shrink-0">Address:</span>
                    <span className="text-foreground">
                      {(rep as any).address || rep.addresses?.[0]?.address}
                    </span>
                  </div>
                )}
                {rep.website && (
                  <div className="flex items-center">
                    <span className="font-medium text-muted-foreground w-20">Website:</span>
                    <a href={rep.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center">
                      Official Website <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </section>
          </AnimatedSection>

          {(() => {
            let terms = (rep as any).terms;
            if (terms?.item && Array.isArray(terms.item)) {
              terms = terms.item;
            }
            return (Array.isArray(terms) && terms.length > 0) ? (
              <AnimatedSection>
                <section>
                  <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                    <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Past Terms
                  </h3>
                  <div className="overflow-x-auto rounded-lg bg-muted/50">
                    <table className="min-w-full text-sm border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-3 py-2 text-left">Chamber</th>
                          <th className="px-3 py-2 text-left">Congress</th>
                          <th className="px-3 py-2 text-left">Years</th>
                          <th className="px-3 py-2 text-left">Party</th>
                          <th className="px-3 py-2 text-left">State</th>
                          <th className="px-3 py-2 text-left">District</th>
                        </tr>
                      </thead>
                      <tbody>
                        {terms.map((term: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{term.chamber || '-'}</td>
                            <td className="px-3 py-2">{term.congress || '-'}</td>
                            <td className="px-3 py-2">{term.startYear || '-'}{term.endYear ? `–${term.endYear}` : ''}</td>
                            <td className="px-3 py-2">{term.partyName || term.party || '-'}</td>
                            <td className="px-3 py-2">{term.stateName || term.stateCode || '-'}</td>
                            <td className="px-3 py-2">{term.district || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </AnimatedSection>
            ) : null;
          })()}

          {(((rep as any).leadership && Array.isArray((rep as any).leadership) && (rep as any).leadership.length > 0) ||
            ((rep as any).extras?.title)) && (
            <AnimatedSection>
              <section className="">
                <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                  <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Leadership Roles
                </h3>

                {/* Federal Leadership Roles (Congress members) */}
                {(rep as any).leadership && Array.isArray((rep as any).leadership) && (rep as any).leadership.length > 0 && (
                  <div className="overflow-x-auto rounded-lg bg-muted/50 mb-3">
                    <table className="min-w-full text-sm border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Congress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rep as any).leadership.map((role: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{role.type || '-'}</td>
                            <td className="px-3 py-2">{role.congress || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* State Leadership Roles (from extras.title) */}
                {(rep as any).extras?.title && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">Current Leadership Position:</span>
                      <span className="text-foreground">{(rep as any).extras.title}</span>
                    </div>
                  </div>
                )}
              </section>
            </AnimatedSection>
          )}

          <AnimatedSection>
            <section>
              <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                <FileText className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Bills Sponsored
              </h3>
              <div className="text-md mb-2">Total (this year): <span className="font-bold">{bills.length}</span></div>
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
                      function stringToHslColor(str: string, s = 70, l = 50) {
                        let hash = 0;
                        for (let i = 0; i < str.length; i++) {
                          hash = str.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const h = hash % 360;
                        return `hsl(${h}, ${s}%, ${l}%)`;
                      }
                      // Use the URL ID (the one in the current page path) for the sponsor link
                      const sponsorLink = id && rep.name
                        ? `/legislation?sponsorId=${encodeURIComponent(id)}&rep=${encodeURIComponent(rep.name)}`
                        : '#';
                      return (
                          <AnimatedSection>
                            <Button asChild variant="outline" className="w-full group mt-4">
                               <Link href={sponsorLink}>
                                 View all bills sponsored
                               </Link>
                            </Button>
                          </AnimatedSection>
                      );
                    })()
                  )}
                </>
              )}
            </section>
          </AnimatedSection>

          {(() => {
            let sponsoredLegislation = (rep as any).sponsoredLegislation;
            if (sponsoredLegislation?.item && Array.isArray(sponsoredLegislation.item)) {
              sponsoredLegislation = sponsoredLegislation.item;
            }
            return (Array.isArray(sponsoredLegislation) && sponsoredLegislation.length > 0) ? (
              <AnimatedSection>
                <section>
                  <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                    <FileText className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Sponsored Legislation (Congress API)
                  </h3>
                  <div className="space-y-2">
                    {sponsoredLegislation.slice(0, 5).map((bill: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg border">
                        <h4 className="font-medium text-foreground">{bill.number}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{bill.title}</p>
                        {bill.introducedDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Introduced: {new Date(bill.introducedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                    {sponsoredLegislation.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ... and {sponsoredLegislation.length - 5} more bills
                      </p>
                    )}
                  </div>
                </section>
              </AnimatedSection>
            ) : null;
          })()}

          {(() => {
            let cosponsoredLegislation = (rep as any).cosponsoredLegislation;
            if (cosponsoredLegislation?.item && Array.isArray(cosponsoredLegislation.item)) {
              cosponsoredLegislation = cosponsoredLegislation.item;
            }
            return (Array.isArray(cosponsoredLegislation) && cosponsoredLegislation.length > 0) ? (
              <AnimatedSection>
                <section>
                  <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                    <FileText className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Cosponsored Legislation (Congress API)
                  </h3>
                  <div className="space-y-2">
                    {cosponsoredLegislation.slice(0, 5).map((bill: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg border">
                        <h4 className="font-medium text-foreground">{bill.number}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{bill.title}</p>
                        {bill.introducedDate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Introduced: {new Date(bill.introducedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                    {cosponsoredLegislation.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ... and {cosponsoredLegislation.length - 5} more bills
                      </p>
                    )}
                  </div>
                </section>
              </AnimatedSection>
            ) : null;
          })()}

          {(() => {
            let partyHistory = (rep as any).partyHistory;
            if (partyHistory?.item && Array.isArray(partyHistory.item)) {
              partyHistory = partyHistory.item;
            }
            return (Array.isArray(partyHistory) && partyHistory.length > 0) ? (
              <AnimatedSection>
                <section>
                  <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                    <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Party History
                  </h3>
                  <div className="overflow-x-auto rounded-lg bg-muted/50">
                    <table className="min-w-full text-sm border">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-3 py-2 text-left">Party</th>
                          <th className="px-3 py-2 text-left">Start Date</th>
                          <th className="px-3 py-2 text-left">End Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partyHistory.map((party: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{party.partyName || party.party || '-'}</td>
                            <td className="px-3 py-2">{party.startDate ? new Date(party.startDate).toLocaleDateString() : '-'}</td>
                            <td className="px-3 py-2">{party.endDate ? new Date(party.endDate).toLocaleDateString() : 'Current'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </AnimatedSection>
            ) : null;
          })()}

          {(rep as any).birthYear && (
            <AnimatedSection>
              <section>
                <h3 className="text-lg font-semibold text-foreground flex items-center mb-2">
                  <Info className="mr-2 h-5 w-5 text-primary flex-shrink-0" /> Personal Information
                </h3>
                <div className="text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-muted-foreground w-20">Birth Year:</span>
                    <span className="text-foreground">{(rep as any).birthYear}</span>
                  </div>
                </div>
              </section>
            </AnimatedSection>
          )}

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
