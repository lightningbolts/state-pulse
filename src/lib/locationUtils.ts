import { STATE_MAP } from "@/types/geo";

/**
 * Extracts a state abbreviation from a string.
 * @param addressString The string to parse.
 * @returns A two-letter state abbreviation or null.
 */
export function getStateAbbrFromString(addressString: string): string | null {
    if (!addressString) {
        return null;
    }

    // 1. Check for full state name.
    for (const [fullName, abbrev] of Object.entries(STATE_MAP)) {
        if (addressString.toLowerCase().includes(fullName.toLowerCase())) {
            return abbrev;
        }
    }

    // 2. Check for a 2-letter abbreviation using a regex for address-like strings.
    const addressRegex = /,\s*([A-Z]{2})(?:\s|$)|(?:^|\s)([A-Z]{2})(?:\s*$)/;
    const addressMatch = addressString.match(addressRegex);
    if (addressMatch) {
        const abbr = addressMatch[1] || addressMatch[2];
        if (abbr && Object.values(STATE_MAP).includes(abbr)) {
            return abbr;
        }
    }

    // 3. Fallback to a simpler regex for general text.
    const generalRegex = /\b([A-Z]{2})\b/;
    const generalMatch = addressString.match(generalRegex);
    if (generalMatch) {
        const abbr = generalMatch[1];
        if (Object.values(STATE_MAP).includes(abbr)) {
            return abbr;
        }
    }
    
    return null;
}

/**
 * Extracts a state abbreviation from a location object.
 * @param location A location object with address and display_name properties.
 * @returns A two-letter state abbreviation or null.
 */
export function getStateAbbreviation(location: { display_name: string; address: { state?: string | null } }): string | null {
    // 1. Prefer the explicit state from the address object.
    if (location.address.state) {
        const state = location.address.state;
        // It could be a full name, so convert to abbreviation.
        return STATE_MAP[state] || state;
    }
    
    // 2. If not in address object, try to parse from display_name string.
    return getStateAbbrFromString(location.display_name);
}
