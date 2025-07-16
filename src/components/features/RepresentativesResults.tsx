"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, ExternalLink, AlertCircle, Database } from "lucide-react";
import { Representative, RepresentativesResultsProps} from "@/types/representative";
import { Pagination} from "@/types/index";

export function RepresentativesResults({
  representatives,
  closestReps,
  loading,
  error,
  showMap,
  showAllMode,
  userLocation,
  dataSource,
  pagination,
  onShowAllToggle,
  onPageChange,
}: RepresentativesResultsProps) {
  const displayedReps = showAllMode ? representatives : (showMap ? closestReps : representatives);

  return (
    <div>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">
          {showMap ? 'Top 10 Closest Representatives:' : 'Your State Representatives:'}
        </h4>
        {dataSource && (
          <div className="flex items-center text-xs text-muted-foreground">
            <Database className="mr-1 h-3 w-3" />
            {dataSource === 'cache' ? 'From cache' : 'Fresh data'}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center p-4 mb-4 text-sm text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
          <AlertCircle className="flex-shrink-0 w-4 h-4 mr-2" />
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
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Start by entering your address</h3>
          <p className="text-sm text-muted-foreground">
            Type your address in the search box above to see instant suggestions and find your representatives.
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
        {displayedReps.map((rep, index) => (
          <Card key={rep.id} className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {rep.photo && (
                  <img
                    src={rep.photo}
                    alt={rep.name}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0 mx-auto md:mx-0"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-semibold text-lg break-words">{rep.name}</h5>
                      {showMap && rep.distance && (
                        <Badge variant="secondary" className="text-xs">
                          #{index + 1} - {rep.distance.toFixed(1)} mi
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit mt-1 md:mt-0">
                      {rep.party}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium text-primary mb-2">
                    {rep.office}
                    {rep.district && ` - ${rep.district}`}
                  </p>

                  <p className="text-xs text-muted-foreground mb-3">
                    {rep.jurisdiction}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {rep.addresses && rep.addresses.length > 0 && rep.addresses[0].phone && (
                      <div className="flex items-center">
                        <Phone className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a href={`tel:${rep.addresses[0].phone}`} className="text-primary hover:underline break-all">
                          {rep.addresses[0].phone}
                        </a>
                      </div>
                    )}

                    {rep.email && (
                      <div className="flex items-center">
                        <Mail className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a href={`mailto:${rep.email}`} className="text-primary hover:underline break-all">
                          {rep.email}
                        </a>
                      </div>
                    )}

                    {rep.website && (
                      <div className="flex items-center md:col-span-2">
                        <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a
                          href={rep.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          Official Website
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Address Information */}
                  {rep.addresses && rep.addresses.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <h6 className="text-sm font-medium text-muted-foreground mb-2">Office Addresses</h6>
                      <div className="space-y-3">
                        {rep.addresses.map((office, idx) => (
                          <div key={idx} className="text-sm">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide mb-1">
                                  {office.type}
                                </div>
                                <div className="text-sm leading-relaxed">
                                  {office.address}
                                </div>
                                {(office.phone || office.fax) && (
                                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                    {office.phone && (
                                      <div className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        <a href={`tel:${office.phone}`} className="text-primary hover:underline">
                                          {office.phone}
                                        </a>
                                      </div>
                                    )}
                                    {office.fax && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Fax:</span>
                                        {office.fax}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Results Summary and Controls */}
      {representatives.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Found {pagination ? pagination.total : representatives.length} representatives</strong> from OpenStates data.
              {showMap && userLocation && ` Showing top 10 closest to your location.`}
              {dataSource === 'cache' && ' This data is cached and refreshed daily.'}
            </p>
          </div>

          {/* Show All Toggle Button */}
          {userLocation && (
            <div className="flex justify-center">
              <button
                onClick={onShowAllToggle}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {showAllMode ? 'Show Closest Representatives' : 'Show All State Representatives'}
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination && showAllMode && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-muted/50 dark:bg-muted/20 rounded-lg">
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
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev || loading}
                  className="px-3 py-1 text-sm rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => onPageChange(pagination.page + 1)}
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
