"use client";
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

  // --- Robust normalization for both Congress and state reps ---
  // Name
  let name = rep.name || '';
  if (!name && (rep as any).directOrderName) name = (rep as any).directOrderName;
  if (!name && (rep as any).firstName) name = `${(rep as any).firstName || ''} ${(rep as any).lastName || ''}`.trim();
  if (!name && (rep as any).invertedOrderName) name = (rep as any).invertedOrderName;
  if (!name && (rep as any).first_name) {
    name = `${(rep as any).first_name} ${(rep as any).middle_name || ''} ${(rep as any).last_name || ''} ${(rep as any).suffix || ''}`.replace(/ +/g, ' ').trim();
  }
  if (!name && (rep as any).display_name) name = (rep as any).display_name;

  // Party
  let party = rep.party || '';
  if (!party && Array.isArray((rep as any).partyHistory) && (rep as any).partyHistory.length > 0) {
    const lastParty = (rep as any).partyHistory[(rep as any).partyHistory.length - 1];
    if (lastParty && lastParty.partyName) party = lastParty.partyName;
  }
  if (!party && (rep as any).party) party = (rep as any).party;

  // State & District
  let state = (rep as any).state || (rep as any).stateName || '';
  let district = rep.district || (rep as any).district || '';
  // For CongressPeople, try to get state/district from last term if missing
  if ((!state || !district) && (rep as any).terms && Array.isArray((rep as any).terms.item)) {
    const lastTerm = (rep as any).terms.item.slice(-1)[0];
    if (!state && (lastTerm?.stateName || lastTerm?.stateCode)) state = lastTerm.stateName || lastTerm.stateCode;
    if (!district && lastTerm?.district) district = lastTerm.district;
  }

  // Chamber
  let chamber = (rep as any).chamber || '';
  if (!chamber && (rep as any).role) chamber = (rep as any).role;
  if (!chamber && (rep as any).current_role && (rep as any).current_role.chamber) chamber = (rep as any).current_role.chamber;
  if (!chamber && (rep as any).title) {
    if ((rep as any).title.toLowerCase().includes('senator')) chamber = 'Senate';
    if ((rep as any).title.toLowerCase().includes('representative')) chamber = 'House';
  }

  // Office
  let office = '';
  if (typeof rep.office === 'string') {
    office = rep.office;
  } else if ((rep as any).office) {
    office = (rep as any).office;
  } else if (rep.offices && rep.offices.length > 0 && rep.offices[0].name) {
    office = rep.offices[0].name;
  } else if (rep.addresses && rep.addresses.length > 0 && rep.addresses[0].address) {
    office = rep.addresses[0].address;
  } else if ((rep as any).addressInformation && (rep as any).addressInformation.officeAddress) {
    office = (rep as any).addressInformation.officeAddress;
  } else if ((rep as any).terms && Array.isArray((rep as any).terms.item)) {
    const lastTerm = (rep as any).terms.item.slice(-1)[0];
    if (lastTerm?.officeAddress) office = lastTerm.officeAddress;
  }

  // Email
  let email = rep.email || '';
  if (!email && rep.addresses && rep.addresses.length > 0 && 'email' in rep.addresses[0]) {
    email = (rep.addresses[0] as any).email;
  }
  if (!email && (rep as any).contact_form) email = (rep as any).contact_form;

  // Addresses: robustly extract for CongressPeople
  let addresses = Array.isArray(rep.addresses) ? rep.addresses : [];
  if ((!addresses || addresses.length === 0) && ((rep as any).office || (rep as any).phone)) {
    addresses = [{
      type: 'Capitol Office',
      address: (rep as any).office || '',
      phone: (rep as any).phone || '',
      fax: (rep as any).fax || '',
    }];
  }
  if ((!addresses || addresses.length === 0) && Array.isArray(rep.offices)) {
    addresses = rep.offices.map((o: any) => ({
      type: o.type || o.classification || '',
      address: o.address || '',
      phone: o.phone || o.voice || '',
      fax: o.fax || '',
      email: o.email || '',
    }));
  }
  // Congress.gov: addressInformation
  if ((!addresses || addresses.length === 0) && (rep as any).addressInformation) {
    addresses = [{
      type: 'Capitol Office',
      address: (rep as any).addressInformation.officeAddress || '',
      phone: (rep as any).addressInformation.phoneNumber || '',
      fax: '',
    }];
  }
  // Congress.gov: last term office info
  if ((!addresses || addresses.length === 0) && (rep as any).terms && Array.isArray((rep as any).terms.item)) {
    const lastTerm = (rep as any).terms.item.slice(-1)[0];
    if (lastTerm && (lastTerm.officeAddress || lastTerm.phoneNumber)) {
      addresses = [{
        type: 'Capitol Office',
        address: lastTerm.officeAddress || '',
        phone: lastTerm.phoneNumber || '',
        fax: '',
      }];
    }
  }

  // Website: check all possible fields
  let website = rep.website || (rep as any).officialUrl || (rep as any).url || '';
  if (!website && (rep as any).contactInfo && (rep as any).contactInfo.url) website = (rep as any).contactInfo.url;
  if (!website && (rep as any).terms && Array.isArray((rep as any).terms.item)) {
    const lastTerm = (rep as any).terms.item.slice(-1)[0];
    if (lastTerm?.url) website = lastTerm.url;
  }

  // Image
  let image = rep.image || rep.photo || (rep as any).depiction?.imageUrl || 'https://via.placeholder.com/150';

  // Jurisdiction/Chamber
  let jurisdiction = '';
  if (typeof rep.jurisdiction === 'string') {
    jurisdiction = rep.jurisdiction;
  } else if (rep.jurisdiction && typeof rep.jurisdiction === 'object' && rep.jurisdiction.name) {
    jurisdiction = rep.jurisdiction.name;
  } else if (chamber) {
    jurisdiction = chamber === 'Senate' ? 'U.S. Senate' : chamber === 'House' ? 'U.S. House' : chamber;
  }

  const normalized = {
    name,
    party,
    office,
    email,
    website,
    image,
    jurisdiction,
    currentRoleTitle: rep.current_role?.title || (rep as any).title || '',
    currentRoleDistrict: rep.current_role?.district || district,
    state,
    addresses,
    distance: rep.distance,
    id: rep.id,
  };

  return (
    <AnimatedSection key={normalized.id}>
      <Card className="border-l-4 border-l-primary hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          {/* DEBUG: Show rep.id for troubleshooting */}
          {/* <div className="mb-2 text-xs text-red-500">DEBUG: rep.id = {String(rep.id)}</div> */}
          {href ? (
            <div
              className="cursor-pointer"
              onClick={e => {
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
                <img
                  src={normalized.image}
                  alt={normalized.name}
                  className="w-16 h-16 rounded-full object-cover flex-shrink-0 mx-auto md:mx-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-semibold text-lg break-words">{normalized.name}</h5>
                      {showMap && normalized.distance && (
                        <Badge variant="secondary" className="text-xs">
                          #{index !== undefined ? index + 1 : ''} - {normalized.distance.toFixed(1)} mi
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit mt-1 md:mt-0">
                      {normalized.party}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-primary mb-2">
                    {normalized.office}
                    {normalized.currentRoleTitle && (
                      <>
                        {normalized.currentRoleTitle}
                        {normalized.currentRoleDistrict ? ` - ${normalized.currentRoleDistrict}` : ''}
                      </>
                    )}
                    {/* Always show state and district for all reps */}
                    {!normalized.currentRoleTitle && (
                      <>
                        {normalized.state ? `${normalized.state}` : ''}
                        {normalized.currentRoleDistrict ? ` - ${normalized.currentRoleDistrict}` : ''}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {normalized.jurisdiction}
                  </p>
                </div>
              </div>
              {/* Contact info visually inside card, but not part of navigation */}
              <div className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {normalized.addresses && normalized.addresses.length > 0 && normalized.addresses[0].phone && (
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a href={`tel:${normalized.addresses[0].phone}`} className="text-primary hover:underline break-all">
                        {normalized.addresses[0].phone}
                      </a>
                    </div>
                  )}
                  {normalized.email && (
                    <div className="flex items-center w-full max-w-full md:col-span-2">
                      <Mail className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={`mailto:${normalized.email}`}
                        className="text-primary hover:underline overflow-hidden whitespace-nowrap w-full max-w-full"
                        style={{ display: 'inline-block' }}
                      >
                        {normalized.email}
                      </a>
                    </div>
                  )}
                  {normalized.website && (
                    <div className="flex items-center md:col-span-2">
                      <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <a
                        href={normalized.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        Official Website
                      </a>
                    </div>
                  )}
                </div>
                {normalized.addresses && normalized.addresses.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <h6 className="text-sm font-medium text-muted-foreground mb-2">Office Addresses</h6>
                    <div className="space-y-3">
                      {normalized.addresses.map((office, idx) => (
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
