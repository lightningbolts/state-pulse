import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, ExternalLink } from "lucide-react";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import type { Representative } from "@/types/representative";


type RepresentativeCardProps = {
  rep: Representative;
  index?: number;
  showMap?: boolean;
  href?: string;
};


const RepresentativeCard: React.FC<RepresentativeCardProps> = ({ rep, index, showMap, href }) => {
  return (
    <AnimatedSection key={rep.id}>
      <Card className="border-l-4 border-l-primary hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          {href ? (
            <div
              className="cursor-pointer"
              onClick={e => {
                // Prevent navigation if clicking a contact link
                const target = e.target as HTMLElement;
                if (target.closest && target.closest('a')) return;
                window.location.href = href;
              }}
              role="link"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter') window.location.href = href;
              }}
            >
              {/* Main card block */}
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
                          #{index !== undefined ? index + 1 : ''} - {rep.distance.toFixed(1)} mi
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
                </div>
              </div>
              {/* Contact info visually inside card, but not part of navigation */}
              <div className="mt-2">
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
                    <div className="flex items-center w-full max-w-full md:col-span-2">
                      <Mail className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={`mailto:${rep.email}`}
                        className="text-primary hover:underline overflow-hidden whitespace-nowrap w-full max-w-full"
                        style={{ display: 'inline-block' }}
                      >
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
          ) : (
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* ...existing code for non-link card... */}
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedSection>
  );
};

export default RepresentativeCard;
