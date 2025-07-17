"use client";

import {useEffect, useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {AlertCircle, Download, ExternalLink, FileText, Info, Vote} from "lucide-react";
import type {BallotInformationProps, BallotMeasure, Candidate} from "@/types/ballot";

export function BallotInformation({userLocation, onClose}: BallotInformationProps) {
    const [measures, setMeasures] = useState<BallotMeasure[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'measures' | 'candidates'>('measures');

    useEffect(() => {
        fetchBallotInfo();
    }, [userLocation]);

    const fetchBallotInfo = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (userLocation?.state) params.append('state', userLocation.state);
            if (userLocation?.city) params.append('city', userLocation.city);
            if (userLocation?.county) params.append('county', userLocation.county);

            const response = await fetch(`/api/ballot-info?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch ballot information');
            }

            const data = await response.json();
            setMeasures(data.measures || []);
            setCandidates(data.candidates || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            // Fallback to mock data
            const mockData = getMockBallotData();
            setMeasures(mockData.measures);
            setCandidates(mockData.candidates);
        } finally {
            setLoading(false);
        }
    };

    const getMockBallotData = () => {
        const measures: BallotMeasure[] = [
            {
                id: '1',
                title: 'School Bond Measure',
                type: 'bond',
                number: 'Measure A',
                description: 'Bond measure to fund new school construction and facility improvements',
                summary: 'This measure would authorize $50 million in bonds to build new elementary schools and upgrade existing facilities across the district.',
                fiscalImpact: 'Estimated tax increase of $15 per $100,000 of assessed value',
                jurisdiction: 'School District',
                electionDate: '2025-11-04',
                status: 'upcoming'
            },
            {
                id: '2',
                title: 'Transportation Infrastructure Initiative',
                type: 'initiative',
                number: 'Proposition 12',
                description: 'Initiative to improve public transportation and road infrastructure',
                summary: 'This initiative would establish a dedicated fund for public transit improvements and road maintenance through a 0.5% sales tax increase.',
                fiscalImpact: 'Additional 0.5% sales tax for 10 years',
                jurisdiction: 'County',
                electionDate: '2025-11-04',
                status: 'upcoming'
            }
        ];

        const candidates: Candidate[] = [
            {
                id: '1',
                name: 'Sarah Johnson',
                party: 'Democratic',
                office: 'City Council District 3',
                incumbent: false,
                website: 'https://sarahjohnson.com'
            },
            {
                id: '2',
                name: 'Michael Chen',
                party: 'Republican',
                office: 'City Council District 3',
                incumbent: true,
                website: 'https://chenforcouncil.com'
            },
            {
                id: '3',
                name: 'Lisa Rodriguez',
                party: 'Independent',
                office: 'Mayor',
                incumbent: false
            }
        ];

        return {measures, candidates};
    };

    const getTypeColor = (type: BallotMeasure['type']) => {
        switch (type) {
            case 'proposition':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'bond':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'initiative':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'referendum':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'constitutional_amendment':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatType = (type: string) => {
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Vote className="h-6 w-6 text-primary"/>
                        <div>
                            <CardTitle>Ballot Information</CardTitle>
                            <CardDescription>
                                View ballot measures and candidates for upcoming elections
                                {userLocation?.city && ` in ${userLocation.city}`}
                            </CardDescription>
                        </div>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            ×
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                {/* Tab Navigation */}
                <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('measures')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'measures'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Ballot Measures
                    </button>
                    <button
                        onClick={() => setActiveTab('candidates')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                            activeTab === 'candidates'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Candidates
                    </button>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2">Loading ballot information...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center space-x-2 text-red-800 bg-red-50 p-4 rounded-lg">
                        <AlertCircle className="h-5 w-5"/>
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && (
                    <div>
                        {/* Ballot Measures Tab */}
                        {activeTab === 'measures' && (
                            <div className="space-y-4">
                                {measures.map((measure) => (
                                    <div key={measure.id} className="border rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-semibold">{measure.title}</h3>
                                                    {measure.number && (
                                                        <Badge variant="outline">{measure.number}</Badge>
                                                    )}
                                                    <Badge className={getTypeColor(measure.type)}>
                                                        {formatType(measure.type)}
                                                    </Badge>
                                                </div>

                                                <p className="text-sm text-muted-foreground mb-2">
                                                    {measure.jurisdiction} •
                                                    Election: {formatDate(measure.electionDate)}
                                                </p>

                                                <p className="text-sm mb-3">{measure.description}</p>

                                                <div className="mb-3">
                                                    <h4 className="font-medium text-sm mb-1">Summary:</h4>
                                                    <p className="text-sm text-muted-foreground">{measure.summary}</p>
                                                </div>

                                                {measure.fiscalImpact && (
                                                    <div className="mb-3">
                                                        <h4 className="font-medium text-sm mb-1">Fiscal Impact:</h4>
                                                        <p className="text-sm text-muted-foreground">{measure.fiscalImpact}</p>
                                                    </div>
                                                )}

                                                <div className="flex gap-2 mt-3">
                                                    {measure.fullText && (
                                                        <Button size="sm" variant="outline">
                                                            <FileText className="h-4 w-4 mr-2"/>
                                                            Full Text
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="outline">
                                                        <Download className="h-4 w-4 mr-2"/>
                                                        Voter Guide
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {measures.length === 0 && (
                                    <div className="text-center py-8">
                                        <Vote className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                            No ballot measures
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            There are no ballot measures for your area in the upcoming election.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Candidates Tab */}
                        {activeTab === 'candidates' && (
                            <div className="space-y-4">
                                {candidates.map((candidate) => (
                                    <div key={candidate.id} className="border rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-semibold">{candidate.name}</h3>
                                                    {candidate.party && (
                                                        <Badge variant="outline">{candidate.party}</Badge>
                                                    )}
                                                    {candidate.incumbent && (
                                                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                                            Incumbent
                                                        </Badge>
                                                    )}
                                                </div>

                                                <p className="text-sm text-muted-foreground mb-2">
                                                    Running for: {candidate.office}
                                                </p>

                                                {candidate.bio && (
                                                    <p className="text-sm mb-3">{candidate.bio}</p>
                                                )}

                                                <div className="flex gap-2 mt-3">
                                                    {candidate.website && (
                                                        <a
                                                            href={candidate.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <Button size="sm" variant="outline">
                                                                <ExternalLink className="h-4 w-4 mr-2"/>
                                                                Campaign Website
                                                            </Button>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {candidates.length === 0 && (
                                    <div className="text-center py-8">
                                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                            No candidate information
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Candidate information will be available closer to the election.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Information Footer */}
                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Info className="h-5 w-5 text-blue-600 mt-0.5"/>
                                <div>
                                    <h4 className="font-medium text-blue-900 mb-1">Official Ballot Information</h4>
                                    <p className="text-sm text-blue-800 mb-2">
                                        For the most current and official ballot information, visit your local election
                                        office.
                                    </p>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                        <ExternalLink className="h-4 w-4 mr-2"/>
                                        Official Voter Information
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
