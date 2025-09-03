"use client";

import * as React from 'react';
import { MapUI } from './MapUI';

export const InteractiveMap = React.memo(() => {
    return <MapUI />;
});

InteractiveMap.displayName = 'InteractiveMap';
