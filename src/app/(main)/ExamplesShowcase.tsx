"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, User, ArrowRight, Calendar, MapPin, ExternalLink } from 'lucide-react';
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Legislation } from '@/types/legislation';
import { Representative } from '@/types/representative';

export default function ExamplesShowcase() {
    const [policyUpdate, setPolicyUpdate] = useState<Legislation | null>(null);
    const [representative, setRepresentative] = useState<Representative | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchExamples();
    }, []);

    const fetchExamples = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch both random policy update and representative in a single API call
            const response = await fetch('/api/homepage/random-examples');
            const data = await response.json();

            if (data.success && data.data) {
                setPolicyUpdate(data.data.legislation || null);
                setRepresentative(data.data.representative || null);
            } else {
                setError(data.message || 'Failed to load examples');
            }
        } catch (err) {
            console.error('Error fetching examples:', err);
            setError('Failed to load examples');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string | null | undefined) => {
        if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';

        switch (status.toLowerCase()) {
            case 'passed':
            case 'enacted':
                return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
            case 'failed':
            case 'defeated':
                return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
            case 'pending':
            case 'introduced':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
        }
    };

    const getPartyColor = (party: string | undefined) => {
        if (!party) return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';

        switch (party.toLowerCase()) {
            case 'democratic':
            case 'democrat':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
            case 'republican':
                return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
            case 'independent':
                return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
        }
    };

    // Helper functions to extract data from existing types
    const getSponsorName = (sponsors: any[]) => {
        if (!sponsors || sponsors.length === 0) return 'Unknown Sponsor';
        const primarySponsor = sponsors[0];
        if (typeof primarySponsor === 'string') return primarySponsor;
        return primarySponsor?.name || primarySponsor?.person?.name || 'Unknown Sponsor';
    };

    const getSponsorParty = (sponsors: any[]) => {
        if (!sponsors || sponsors.length === 0) return null;
        const primarySponsor = sponsors[0];
        if (typeof primarySponsor === 'string') return null;
        return primarySponsor?.party || primarySponsor?.person?.party || null;
    };

    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return 'Unknown';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString();
    };

    const getRepresentativeOffice = (rep: Representative) => {
        if (rep.current_role?.title) return rep.current_role.title;
        if (rep.office) return rep.office;
        return 'Representative';
    };

    const getRepresentativeJurisdiction = (rep: Representative) => {
        if (rep.jurisdiction?.name) return rep.jurisdiction.name;
        if (rep.jurisdictionName) return rep.jurisdictionName;
        return 'Unknown Jurisdiction';
    };

    const getRecentBillsCount = (rep: Representative) => {
        // This would need to be calculated from actual data or stored in the representative record
        // For now, return a placeholder
        return Math.floor(Math.random() * 20) + 1; // Random number between 1-20
    };

    return (
        <AnimatedSection className="py-20 px-6 md:px-10 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/20 dark:to-indigo-950/20">
            <div className="container mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold mb-4 tracking-tight">See StatePulse in Action</h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                        Get a glimpse of the detailed information and insights available on our platform.
                    </p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Loading skeleton for policy update */}
                        <Card className="shadow-lg">
                            <CardHeader className="pb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
                            </CardContent>
                        </Card>

                        {/* Loading skeleton for representative */}
                        <Card className="shadow-lg">
                            <CardHeader className="pb-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                                        <User className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
                            </CardContent>
                        </Card>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={fetchExamples} variant="outline">
                            Try Again
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Policy Update Card */}
                        {policyUpdate && (
                            <AnimatedSection className="h-full">
                                <Card className="h-full flex flex-col rounded-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 bg-white dark:bg-slate-800 border-0">
                                    <CardHeader className="bg-blue-50 dark:bg-blue-950/20 pb-4 rounded-t-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl text-blue-900 dark:text-blue-100">
                                                        Featured Policy Update
                                                    </CardTitle>
                                                    <CardDescription className="text-blue-700 dark:text-blue-300">
                                                        {policyUpdate.jurisdictionName || 'Unknown Jurisdiction'}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 p-6 flex flex-col">
                                        <div className="flex-1 space-y-4">
                                            <div>
                                                <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                                                    {policyUpdate.title || 'Untitled Legislation'}
                                                </h3>
                                                <p className="text-muted-foreground text-sm line-clamp-3">
                                                    {policyUpdate.geminiSummary || policyUpdate.summary || 'No summary available'}
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center text-sm">
                                                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                                                    <span className="font-medium">{getSponsorName(policyUpdate.sponsors || [])}</span>
                                                    {getSponsorParty(policyUpdate.sponsors || []) && (
                                                        <Badge className={`ml-2 text-xs ${getPartyColor(getSponsorParty(policyUpdate.sponsors || [])!)}`}>
                                                            {getSponsorParty(policyUpdate.sponsors || [])}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="flex items-center text-sm text-muted-foreground">
                                                    <Calendar className="h-4 w-4 mr-2" />
                                                    <span>{policyUpdate.statusText || 'Unknown Status'}</span>
                                                    {policyUpdate.latestActionAt && (
                                                        <>
                                                            <span className="mx-2">•</span>
                                                            <span>{formatDate(policyUpdate.latestActionAt)}</span>
                                                        </>
                                                    )}
                                                </div>

                                                {policyUpdate.subjects && policyUpdate.subjects.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {policyUpdate.subjects.slice(0, 3).map((subject, index) => (
                                                            <Badge key={index} variant="secondary" className="text-xs">
                                                                {subject}
                                                            </Badge>
                                                        ))}
                                                        {policyUpdate.subjects.length > 3 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{policyUpdate.subjects.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <Button asChild className="w-full group">
                                                <Link href={`/legislation/${encodeURIComponent(policyUpdate.id)}`}>
                                                    View Full Details
                                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </AnimatedSection>
                        )}

                        {/* Representative Card */}
                        {representative && (
                            <AnimatedSection className="h-full">
                                <Card className="h-full flex flex-col rounded-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 bg-white dark:bg-slate-800 border-0">
                                    <CardHeader className="bg-green-50 dark:bg-green-950/20 pb-4 rounded-t-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                                                    <User className="h-6 w-6 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-xl text-green-900 dark:text-green-100">
                                                        Featured Representative
                                                    </CardTitle>
                                                    <CardDescription className="text-green-700 dark:text-green-300">
                                                        {getRepresentativeJurisdiction(representative)}
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 p-6 flex flex-col">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center space-x-4">
                                                {representative.image ? (
                                                    <img
                                                        src={representative.image}
                                                        alt={representative.name}
                                                        className="w-16 h-16 rounded-full object-cover border-2 border-green-200 dark:border-green-800"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                                        <User className="h-8 w-8 text-green-600 dark:text-green-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-lg">{representative.name}</h3>
                                                    <p className="text-muted-foreground">{getRepresentativeOffice(representative)}</p>
                                                    {representative.party && (
                                                        <Badge className={getPartyColor(representative.party)} variant="outline">
                                                            {representative.party}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center text-sm">
                                                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                                                    <span>{getRepresentativeJurisdiction(representative)}</span>
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/10 rounded-lg">
                                                    <span className="text-sm font-medium">Recent Bills Sponsored</span>
                                                    <Badge variant="secondary">{getRecentBillsCount(representative)}</Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6">
                                            <Button asChild variant="outline" className="w-full group">
                                                <Link href={`/representatives/${encodeURIComponent(representative.id)}`}>
                                                    View Profile
                                                    <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </AnimatedSection>
                        )}
                    </div>
                )}

                {/*Refresh for a different set */}
                <div className="text-center py-6">
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button onClick={fetchExamples} variant="outline" className="w-full">
                        Fetch Again
                    </Button>
                </div>


                {/*/!* Call to Action *!/*/}
                {/*<div className="text-center">*/}
                {/*    <p className="text-muted-foreground mb-6">*/}
                {/*        Ready to explore the full power of StatePulse?*/}
                {/*    </p>*/}
                {/*    <div className="flex flex-col sm:flex-row gap-4 justify-center">*/}
                {/*        <Button asChild size="lg">*/}
                {/*            <Link href="/legislation">*/}
                {/*                Browse All Legislation*/}
                {/*                <ArrowRight className="ml-2 h-5 w-5" />*/}
                {/*            </Link>*/}
                {/*        </Button>*/}
                {/*        <Button asChild variant="outline" size="lg">*/}
                {/*            <Link href="/representatives">*/}
                {/*                Find Your Representatives*/}
                {/*                <User className="ml-2 h-5 w-5" />*/}
                {/*            </Link>*/}
                {/*        </Button>*/}
                {/*    </div>*/}
                {/*</div>*/}
            </div>
        </AnimatedSection>
    );
}
