"use client";

import {useEffect, useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {AlertCircle, Calendar, Clock, ExternalLink, Info, MapPin} from "lucide-react";
import {ElectionEvent, VotingInfoProps} from "@/types/event";

export function VotingInfo({userLocation, onClose}: VotingInfoProps) {
    const [events, setEvents] = useState<ElectionEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchVotingInfo();
    }, [userLocation]);

    const fetchVotingInfo = async () => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (userLocation?.state) params.append('state', userLocation.state);
            if (userLocation?.city) params.append('city', userLocation.city);

            const response = await fetch(`/api/voting-info?${params.toString()}`);

            if (!response.ok) {
                throw new Error('Failed to fetch voting information');
            }

            const data = await response.json();
            setEvents(data.events || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            // Fallback to mock data for demonstration
            setEvents(getMockVotingEvents());
        } finally {
            setLoading(false);
        }
    };

    // Mock data for demonstration
    const getMockVotingEvents = (): ElectionEvent[] => {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const inTwoMonths = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());

        return [
            {
                id: '1',
                type: 'registration_deadline',
                title: 'Voter Registration Deadline',
                date: nextMonth.toISOString().split('T')[0],
                description: 'Last day to register to vote for the upcoming election',
                requirements: ['Valid ID', 'Proof of residence', 'US citizenship'],
                isUrgent: true
            },
            {
                id: '2',
                type: 'early_voting',
                title: 'Early Voting Period Begins',
                date: inTwoMonths.toISOString().split('T')[0],
                description: 'Early voting locations open for registered voters',
                location: 'Various locations throughout the county'
            },
            {
                id: '3',
                type: 'election',
                title: 'General Election Day',
                date: new Date(today.getFullYear(), today.getMonth() + 3, 5).toISOString().split('T')[0],
                description: 'Primary election for local and state offices',
                location: 'Polling locations countywide'
            }
        ];
    };

    const getEventTypeColor = (type: ElectionEvent['type']) => {
        switch (type) {
            case 'registration_deadline':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'early_voting':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'election':
            case 'primary':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'absentee_deadline':
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

    const getDaysUntil = (dateString: string) => {
        const today = new Date();
        const eventDate = new Date(dateString);
        const diffTime = eventDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Past';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        return `${diffDays} days`;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-6 w-6 text-primary"/>
                        <div>
                            <CardTitle>Voting Dates & Deadlines</CardTitle>
                            <CardDescription>
                                Important election dates and deadlines
                                {userLocation?.state && ` for ${userLocation.state}`}
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
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2">Loading voting information...</span>
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
                        {events.map((event) => (
                            <div
                                key={event.id}
                                className={`border rounded-lg p-4 ${event.isUrgent ? 'border-red-200 bg-red-50' : 'border-border'}`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-semibold">{event.title}</h3>
                                            <Badge className={getEventTypeColor(event.type)}>
                                                {event.type.replace('_', ' ')}
                                            </Badge>
                                            {event.isUrgent && (
                                                <Badge variant="destructive" className="text-xs">
                                                    Urgent
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4"/>
                                                {formatDate(event.date)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4"/>
                                                {getDaysUntil(event.date)}
                                            </div>
                                        </div>

                                        {event.description && (
                                            <p className="text-sm mb-2">{event.description}</p>
                                        )}

                                        {event.location && (
                                            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                                                <MapPin className="h-4 w-4"/>
                                                {event.location}
                                            </div>
                                        )}

                                        {event.requirements && event.requirements.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-sm font-medium mb-1">Requirements:</p>
                                                <ul className="text-sm text-muted-foreground">
                                                    {event.requirements.map((req, index) => (
                                                        <li key={index} className="flex items-center gap-1">
                                                            <span
                                                                className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                                                            {req}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {events.length === 0 && (
                            <div className="text-center py-8">
                                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                    No upcoming events
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Check back later for voting dates and deadlines.
                                </p>
                            </div>
                        )}

                        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Info className="h-5 w-5 text-blue-600 mt-0.5"/>
                                <div>
                                    <h4 className="font-medium text-blue-900 mb-1">Stay Informed</h4>
                                    <p className="text-sm text-blue-800 mb-2">
                                        Visit your local election office website for the most up-to-date information.
                                    </p>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                        <ExternalLink className="h-4 w-4 mr-2"/>
                                        Find Local Election Office
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
