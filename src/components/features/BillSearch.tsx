"use client";

import React, {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {FileText, Search} from "lucide-react";
import {Bill, BillSearchProps} from "@/types/legislation";

export function BillSearch({selectedBills, onBillSelect, userLocation, className}: BillSearchProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Bill[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const searchBills = async () => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/search-bills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: searchQuery.trim(),
                    userLocation
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({error: 'Unknown error'}));
                console.error('Search bills API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData
                });
                console.error(`Failed to search bills: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
            }

            const data = await response.json();
            console.log('Bill search results:', data);
            setSearchResults(data.bills || []);

        } catch (error) {
            console.error('Error searching bills:', error);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBills();
        }
    };

    return (
        <div className={className}>
            {/* Search Input */}
            <div className="flex gap-2 mb-4">
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter sponsor last name, bill number or keywords... (Press Enter to search)"
                    className="flex-1"
                />
                <Button
                    onClick={searchBills}
                    disabled={isLoading}
                    className="whitespace-nowrap"
                >
                    <Search className="h-4 w-4 mr-2"/>
                    Search Bills
                </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium mb-2">Bill Search Results (Click to add/remove)</h4>
                    <div className="space-y-2">
                        {searchResults.map((bill) => {
                            const isSelected = selectedBills.find(b => b.id === bill.id);
                            return (
                                <div
                                    key={bill.id}
                                    onClick={() => onBillSelect(bill)}
                                    className={`p-3 rounded-lg border cursor-pointer transition ${
                                        isSelected
                                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-medium">{bill.title}</div>
                                                {isSelected && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Selected
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {bill.identifier} - {bill.latest_action_date}
                                            </div>
                                        </div>
                                        <FileText
                                            className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}/>
                                    </div>
                                    {bill.abstract && (
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            {bill.abstract}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* No Results Message */}
            {searchResults.length === 0 && searchQuery && !isLoading && (
                <div className="text-sm text-muted-foreground py-2">
                    No bills found for your search query. Please try different keywords or check back later.
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">Searching bills...</span>
                </div>
            )}
        </div>
    );
}
