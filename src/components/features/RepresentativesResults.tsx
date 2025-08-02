"use client";

import {AlertCircle, Database, MapPin} from "lucide-react";
import {RepresentativesResultsProps} from "@/types/representative";
import {AnimatedSection} from "@/components/ui/AnimatedSection";
import RepresentativeCard from "@/components/features/RepresentativeCard";

export function RepresentativesResults({
    representatives,
    closestReps,
    loading,
    error,
    showMap,
    userLocation,
    dataSource,
    pagination,
    onPageChange,
}: Omit<RepresentativesResultsProps, 'showAllMode' | 'onShowAllToggle'>) {
    const displayedReps = showMap ? closestReps : representatives;
    // Deduplicate by rep.id to avoid React key errors
    const uniqueReps = displayedReps.filter((rep, idx, arr) =>
      arr.findIndex(r => r.id === rep.id) === idx
    );

    // Suppress distances if userLocation is a state capital (type === 'state' or lat/lon is 0)
    const suppressDistance = userLocation && (
      (typeof userLocation === 'object' && 'type' in userLocation && userLocation.type === 'state') ||
      (userLocation.lat === 0 && userLocation.lon === 0)
    );

    return (
        <div>
            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">
                    {'Your Representatives:'}
                </h4>
                {dataSource && (
                    <div className="flex items-center text-xs text-muted-foreground">
                        <Database className="mr-1 h-3 w-3"/>
                        {dataSource === 'cache' ? 'From cache' : 'Fresh data'}
                    </div>
                )}
            </div>

            {/* Error State */}
            {error && (
                <div
                    className="flex items-center p-4 mb-4 text-sm text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <AlertCircle className="flex-shrink-0 w-4 h-4 mr-2"/>
                    <span>{error}</span>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Finding your representatives...</p>
                </div>
            )}

            {/* Empty State - No Location */}
            {!loading && !error && representatives.length === 0 && !userLocation && (
                <div className="text-center py-12">
                    <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4"/>
                    <h3 className="text-lg font-semibold mb-2">Start by entering your address</h3>
                    <p className="text-sm text-muted-foreground">
                        Type your address in the search box above to see instant suggestions and find your
                        representatives.
                    </p>
                </div>
            )}

            {/* Empty State - No Results */}
            {!loading && !error && representatives.length === 0 && userLocation && (
                <p className="text-sm text-muted-foreground text-center py-8">
                    No representatives found for this location. Please try a different address.
                </p>
            )}

            {/* Representatives List */}
            <div className="space-y-4">
                {uniqueReps.map((rep, index) => (
                  <RepresentativeCard
                    key={rep.id}
                    rep={rep}
                    index={index}
                    showMap={showMap}
                    href={`/representatives/${rep.id}`}
                    suppressDistance={!!suppressDistance}
                  />
                ))}
            </div>

            {/* Results Summary and Controls */}
            {representatives.length > 0 && (
                <div className="mt-4 space-y-3">
                    {/* <div
                        className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Found {pagination ? pagination.total : representatives.length} representatives</strong> from
                            OpenStates data.
                            {showMap && userLocation && ` Showing top 10 closest to your location.`}
                            {dataSource === 'cache' && ' This data is cached and refreshed daily.'}
                        </p>
                    </div> */}

                    {/* Show All Toggle Button removed */}

                    {/* Pagination Controls */}
                    {pagination && (
                        <div
                            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg">
                            <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} representatives
                </span>
                            </div>
                            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                                <button
                                    onClick={() => onPageChange && pagination && onPageChange(pagination.page - 1)}
                                    disabled={!pagination.hasPrev || loading}
                                    className="px-3 py-1 text-sm rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => onPageChange && pagination && onPageChange(pagination.page + 1)}
                                    disabled={!pagination.hasNext || loading}
                                    className="px-3 py-1 text-sm rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
