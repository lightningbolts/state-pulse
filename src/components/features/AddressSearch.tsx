"use client";

import React, {useEffect, useRef, useState} from "react";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Loader2, MapPin, Search} from "lucide-react";
import {cn} from "@/lib/utils";
import {AddressSearchProps, AddressSuggestion} from "@/types/geo";

export function AddressSearch({
                                  onAddressSelect,
                                  onSearch,
                                  placeholder = "Enter address or zip code (e.g., 98021, WA)",
                                  disabled = false,
                                  className
                              }: AddressSearchProps) {
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();

    // Debounced search function
    const debouncedSearch = async (searchQuery: string) => {
        if (searchQuery.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery)}&limit=5`);
            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.suggestions || []);
                setShowSuggestions(data.suggestions?.length > 0);
            }
        } catch (error) {
            console.error('Search error:', error);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setLoading(false);
        }
    };

    // Handle input change with debouncing
    const handleInputChange = (value: string) => {
        setQuery(value);
        setSelectedIndex(-1);

        // Clear previous debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Set new debounce
        debounceRef.current = setTimeout(() => {
            debouncedSearch(value);
        }, 300);
    };

    // Handle suggestion selection
    const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
        setQuery(suggestion.display_name);
        setSuggestions([]);
        setShowSuggestions(false);
        setSelectedIndex(-1);
        onAddressSelect(suggestion);
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleSuggestionSelect(suggestions[selectedIndex]);
        } else if (query.trim()) {
            onSearch(query.trim());
            setShowSuggestions(false);
        }
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleSuggestionSelect(suggestions[selectedIndex]);
                } else {
                    handleSubmit(e);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Format address for display
    const formatAddress = (suggestion: AddressSuggestion) => {
        const {address} = suggestion;
        const parts = [];

        if (address.house_number && address.road) {
            parts.push(`${address.house_number} ${address.road}`);
        } else if (address.road) {
            parts.push(address.road);
        }

        if (address.city) {
            parts.push(address.city);
        }

        if (address.state) {
            parts.push(address.state);
        }

        if (address.postcode) {
            parts.push(address.postcode);
        }

        return parts.join(', ') || suggestion.display_name;
    };

    return (
        <div className={cn("relative w-full", className)}>
            <form onSubmit={handleSubmit}
                  className="flex flex-col md:flex-row items-stretch md:items-center space-y-2 md:space-y-0 md:space-x-2">
                <div className="relative flex-1">
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (suggestions.length > 0) {
                                setShowSuggestions(true);
                            }
                        }}
                        disabled={disabled}
                        className="pr-10"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>
                        ) : (
                            <Search className="h-4 w-4 text-muted-foreground"/>
                        )}
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={disabled || (!query.trim() && selectedIndex < 0)}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground w-full md:w-auto"
                >
                    <Search className="mr-2 h-4 w-4"/>
                    Find
                </Button>
            </form>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <Card
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 md:right-auto md:min-w-96 mt-1 z-50 max-h-80 overflow-y-auto shadow-lg border"
                >
                    <div className="p-1">
                        {suggestions.map((suggestion, index) => (
                            <div
                                key={suggestion.id}
                                className={cn(
                                    "flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors",
                                    index === selectedIndex
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-muted"
                                )}
                                onClick={() => handleSuggestionSelect(suggestion)}
                            >
                                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary"/>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {formatAddress(suggestion)}
                                    </p>
                                    {suggestion.address.state && (
                                        <p className="text-xs text-muted-foreground">
                                            {suggestion.address.state}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
