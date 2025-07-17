"use client";

import {useEffect, useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {AlertCircle, Calendar, Clock, ExternalLink, MapPin, Search, Users} from "lucide-react";
import {PublicHearing, PublicHearingsProps} from "@/types/event";

export function PublicHearings({userLocation, onClose}: PublicHearingsProps) {
    const [hearings, setHearings] = useState<PublicHearing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");

    useEffect(() => {
        fetchHearings();
    }, [userLocation]);

    const fetchHearings = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (userLocation?.state) params.append('state', userLocation.state);
            if (userLocation?.city) params.append('city', userLocation.city);
            if (userLocation?.county) params.append('county', userLocation.county);

            const response = await fetch(`/api/public-hearings?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch hearing information');
            }

            const data = await response.json();
            setHearings(data.hearings || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            // Fallback to mock data
            setHearings(getMockHearings());
        } finally {
            setLoading(false);
        }
    };

    const getMockHearings = (): PublicHearing[] => {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

        return [
            {
                id: '1',
                title: 'City Council Regular Meeting',
                date: nextWeek.toISOString().split('T')[0],
                time: '7:00 PM',
                location: 'City Hall Council Chambers',
                type: 'city_council',
                description: 'Regular monthly city council meeting to discuss budget allocations and new ordinances.',
                agenda: [
                    'Budget Review for FY 2025',
                    'Zoning Amendment - Commercial District',
                    'Public Comment Period',
                    'New Business'
                ],
                contact: {
                    phone: '(555) 123-4567',
                    email: 'clerk@cityname.gov',
                    website: 'https://cityname.gov/meetings'
                },
                isVirtual: false,
                status: 'scheduled'
            },
            {
                id: '2',
                title: 'Planning Commission Hearing',
                date: nextMonth.toISOString().split('T')[0],
                time: '6:30 PM',
                location: 'Virtual Meeting',
                type: 'planning_commission',
                description: 'Public hearing on proposed residential development project.',
                agenda: [
                    'Review of Sunset Ridge Development Proposal',
                    'Environmental Impact Assessment',
                    'Public Comments',
                    'Commission Vote'
                ],
                contact: {
                    phone: '(555) 987-6543',
                    email: 'planning@countyname.gov'
                },
                isVirtual: true,
                virtualLink: 'https://zoom.us/j/123456789',
                status: 'scheduled'
            },
            {
                id: '3',
                title: 'School Board Budget Meeting',
                date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                time: '7:30 PM',
                location: 'School District Office',
                type: 'school_board',
                description: 'Special meeting to discuss the upcoming school year budget and teacher contracts.',
                agenda: [
                    'FY 2025 Budget Presentation',
                    'Teacher Contract Negotiations Update',
                    'Facility Maintenance Budget',
                    'Public Input Session'
                ],
                contact: {
                    phone: '(555) 555-0123',
                    email: 'board@schooldistrict.edu',
                    website: 'https://schooldistrict.edu/board'
                },
                isVirtual: false,
                status: 'scheduled'
            }
        ];
    };

    const getTypeColor = (type: PublicHearing['type']) => {
        switch (type) {
            case 'city_council':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'county_board':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'school_board':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'planning_commission':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
    };

    const formatType = (type: string) => {
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const filteredHearings = hearings.filter(hearing => {
        const matchesSearch = hearing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            hearing.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || hearing.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="h-6 w-6 text-primary"/>
                        <div>
                            <CardTitle>Public Hearing Schedules</CardTitle>
                            <CardDescription>
                                Upcoming public hearings and government meetings
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
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                        <Input
                            placeholder="Search hearings..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 border border-border rounded-md bg-background"
                    >
                        <option value="all">All Types</option>
                        <option value="city_council">City Council</option>
                        <option value="county_board">County Board</option>
                        <option value="school_board">School Board</option>
                        <option value="planning_commission">Planning Commission</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2">Loading hearing schedules...</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center space-x-2 text-red-800 bg-red-50 p-4 rounded-lg">
                        <AlertCircle className="h-5 w-5"/>
                        <span>{error}</span>
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-4">
                        {filteredHearings.map((hearing) => (
                            <div key={hearing.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold">{hearing.title}</h3>
                                            <Badge className={getTypeColor(hearing.type)}>
                                                {formatType(hearing.type)}
                                            </Badge>
                                            {hearing.isVirtual && (
                                                <Badge variant="outline" className="text-xs">
                                                    Virtual
                                                </Badge>
                                            )}
                                        </div>

                                        <div
                                            className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-2">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4"/>
                                                {formatDate(hearing.date)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4"/>
                                                {hearing.time}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-4 w-4"/>
                                                {hearing.location}
                                            </div>
                                        </div>

                                        <p className="text-sm mb-3">{hearing.description}</p>

                                        {hearing.agenda && hearing.agenda.length > 0 && (
                                            <div className="mb-3">
                                                <h4 className="font-medium text-sm mb-2">Agenda Items:</h4>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    {hearing.agenda.map((item, index) => (
                                                        <li key={index} className="flex items-start gap-2">
                                                            <span
                                                                className="w-1 h-1 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></span>
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-4 text-sm">
                                            {hearing.contact?.phone && (
                                                <a
                                                    href={`tel:${hearing.contact.phone}`}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    📞 {hearing.contact.phone}
                                                </a>
                                            )}
                                            {hearing.contact?.email && (
                                                <a
                                                    href={`mailto:${hearing.contact.email}`}
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    ✉️ {hearing.contact.email}
                                                </a>
                                            )}
                                            {hearing.contact?.website && (
                                                <a
                                                    href={hearing.contact.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                                >
                                                    <ExternalLink className="h-3 w-3"/>
                                                    Meeting Details
                                                </a>
                                            )}
                                            {hearing.virtualLink && (
                                                <a
                                                    href={hearing.virtualLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                                >
                                                    <ExternalLink className="h-3 w-3"/>
                                                    Join Virtual Meeting
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredHearings.length === 0 && (
                            <div className="text-center py-8">
                                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                    No hearings found
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {searchQuery || filterType !== 'all'
                                        ? 'Try adjusting your search or filter criteria.'
                                        : 'Check back later for upcoming public hearings.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
