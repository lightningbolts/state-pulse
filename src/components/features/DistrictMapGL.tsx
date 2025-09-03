import * as React from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { feature } from 'topojson-client'; // ADDED: TopoJSON parsing function

interface DistrictMapGLProps {
  geojsonUrl: string;
  color: string;
  onDistrictClick?: (feature: any, lngLat: {lng: number, lat: number}) => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  popupMarker?: {
    lng: number;
    lat: number;
    iconHtml?: string;
    draggable?: boolean;
    onDragEnd?: (lngLat: {lng: number, lat: number}) => void;
  };
  mapStyle?: string;
  // Party affiliation coloring
  showPartyAffiliation?: boolean;
  districtPartyMapping?: Record<string, string>; // district ID -> party
  partyColors?: Record<string, string>; // party -> color
  // Gerrymandering analysis
  showGerrymandering?: boolean;
  gerryScores?: Record<string, number>; // district ID -> Polsby-Popper score
  getGerrymanderingColor?: (score: number) => string; // score -> color
  // Representative heatmap coloring
  showRepHeatmap?: boolean;
  repScores?: Record<string, number>; // district ID -> score (0-1)
  repDetails?: Record<string, any>; // district ID -> rep details
  getRepHeatmapColor?: (score: number) => string; // score -> color
  // Topic heatmap coloring
  showTopicHeatmap?: boolean;
  topicScores?: Record<string, number>; // district ID -> score (0-1)
  getTopicHeatmapColor?: (score: number) => string; // score -> color
  // District border visibility
  showDistrictBorders?: boolean;
}

// Mobile detection utility
const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  const userAgent = navigator.userAgent;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSmallScreen = window.innerWidth <= 768;
  const isMobileUserAgent = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  return isTouchDevice && (hasSmallScreen || isMobileUserAgent);
};

// Mobile memory optimization utility
const getOptimalChunkSize = (featureCount: number, isMobile: boolean): number => {
  if (!isMobile) return featureCount; // No chunking on desktop

  // Conservative chunking for mobile devices based on actual district counts
  if (featureCount > 4000) return 400;  // State lower districts (~4,800)
  if (featureCount > 1500) return 600;  // State upper districts (~1,900)
  if (featureCount > 800) return 800;   // Medium datasets
  return featureCount; // Congressional districts (~435) and smaller - no chunking needed
};

// Performance optimization: Memoize the component to prevent unnecessary re-renders
export const DistrictMapGL: React.FC<DistrictMapGLProps> = React.memo(({
                                                                         geojsonUrl,
                                                                         color,
                                                                         onDistrictClick,
                                                                         initialViewState = { longitude: -98.5795, latitude: 39.8283, zoom: 4 },
                                                                         popupMarker,
                                                                         mapStyle = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
                                                                         showPartyAffiliation = false,
                                                                         districtPartyMapping = {},
                                                                         partyColors = {},
                                                                         showGerrymandering = false,
                                                                         gerryScores = {},
                                                                         getGerrymanderingColor = () => '#e0e0e0',
                                                                         showRepHeatmap = false,
                                                                         repScores = {},
                                                                         repDetails = {},
                                                                         getRepHeatmapColor = () => '#e0e0e0',
                                                                         showTopicHeatmap = false,
                                                                         topicScores = {},
                                                                         getTopicHeatmapColor = () => '#e0e0e0',
                                                                         showDistrictBorders = true,
                                                                       }) => {
  const mapRef = React.useRef<MapRef>(null);
  const markerRef = React.useRef<any>(null);
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [geoJsonData, setGeoJsonData] = React.useState<any>(null);
  const [loadingProgress, setLoadingProgress] = React.useState(0);
  const [isPartiallyLoaded, setIsPartiallyLoaded] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Mobile detection effect
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(isMobileDevice());

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Smart data loading with mobile-specific optimizations and progressive loading
  React.useEffect(() => {
    let isCancelled = false;
    let abortController: AbortController | null = null;

    const loadGeoJsonData = async () => {
      if (!geojsonUrl) return;

      try {
        setLoading(true);
        setError(null);
        setLoadingProgress(0);
        setIsPartiallyLoaded(false);

        // Clear any existing timeout
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }

        abortController = new AbortController();

        // Mobile-specific timeout and fetch options
        const fetchTimeout = isMobile ? 25000 : 30000; // Longer timeout on mobile for better stability
        const timeoutId = setTimeout(() => {
          if (abortController && !abortController.signal.aborted) {
            try {
              abortController.abort('Request timeout');
            } catch (e) {
              console.debug('[DistrictMapGL] Timeout abort error:', e);
            }
          }
        }, fetchTimeout);

        const response = await fetch(geojsonUrl, {
          signal: abortController.signal,
          cache: 'force-cache', // Use browser cache aggressively
          // Mobile-specific headers for smaller responses
          headers: isMobile ? {
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'application/json'
          } : {}
        });

        clearTimeout(timeoutId);

        // Check if request was cancelled before processing response
        if (isCancelled) {
          console.debug('[DistrictMapGL] Request cancelled during fetch');
          return;
        }

        if (!response.ok) {
          console.error(`HTTP ${response.status}: ${response.statusText}`);
        }

        setLoadingProgress(30);

        // --- START OF TOPOJSON MODIFICATION ---
        const topojsonData = await response.json(); // Data is now TopoJSON

        if (isCancelled) return;

        // Dynamically find the key for the main object within the TopoJSON file
        const objectKey = topojsonData.objects && Object.keys(topojsonData.objects)[0];
        if (!objectKey) {
          console.error('Invalid TopoJSON file: No objects found.');
        }

        // Convert the TopoJSON object back into a GeoJSON FeatureCollection
        const data = feature(topojsonData, topojsonData.objects[objectKey]) as any;
        // --- END OF TOPOJSON MODIFICATION ---

        setLoadingProgress(60);

        const featureCount = data.features?.length || 0;
        const isLargeDataset = featureCount > 1800; // Adjusted: Only state upper (~1900) and state lower (~4800)
        const isVeryLargeDataset = featureCount > 4000; // Only state lower districts (~4800)

        console.log(`[DistrictMapGL] Dataset loaded: ${featureCount} features (isLarge: ${isLargeDataset}, isVeryLarge: ${isVeryLargeDataset})`);

        // Mobile-specific optimizations for large datasets
        if (isMobile && isVeryLargeDataset) {
          console.log(`[DistrictMapGL] Mobile device detected with ${featureCount} features - applying mobile optimizations`);

          const chunkSize = getOptimalChunkSize(featureCount, true);

          if (chunkSize < featureCount) {
            console.log(`[DistrictMapGL] Mobile progressive loading: ${chunkSize}/${featureCount} features initially`);

            // Create initial chunk with only essential properties
            const initialChunk = {
              ...data,
              features: data.features.slice(0, chunkSize).map((feature: any) => ({
                type: feature.type,
                geometry: {
                  type: feature.geometry.type,
                  coordinates: feature.geometry.coordinates
                },
                properties: {
                  // Keep only essential properties for mobile
                  GEOID: feature.properties.GEOID,
                  GEOIDFQ: feature.properties.GEOIDFQ,
                  ID: feature.properties.ID,
                  DISTRICT: feature.properties.DISTRICT,
                  STATEFP: feature.properties.STATEFP,
                  NAME: feature.properties.NAME,
                  _optimized: true,
                  _mobile: true
                }
              }))
            };

            initialChunk._isLargeDataset = true;
            initialChunk._isMobile = true;
            initialChunk._originalFeatureCount = featureCount;
            initialChunk._loadedFeatureCount = chunkSize;
            initialChunk._isPartialLoad = true;

            setGeoJsonData(initialChunk);
            setIsPartiallyLoaded(true);
            setLoadingProgress(80);

            // Progressive loading with longer delays on mobile to prevent crashes
            loadingTimeoutRef.current = setTimeout(() => {
              if (!isCancelled && isMobile) {
                console.log(`[DistrictMapGL] Mobile progressive loading: Loading remaining ${featureCount - chunkSize} features`);

                // Load remaining features in chunks to prevent memory spikes
                const remainingFeatures = data.features.slice(chunkSize);
                const remainingChunks: any[][] = [];
                const mobileChunkSize = 300; // Smaller chunks for mobile stability

                for (let i = 0; i < remainingFeatures.length; i += mobileChunkSize) {
                  remainingChunks.push(remainingFeatures.slice(i, i + mobileChunkSize));
                }

                let currentChunkIndex = 0;

                const loadNextChunk = () => {
                  if (currentChunkIndex >= remainingChunks.length || isCancelled) {
                    setLoadingProgress(100);
                    setIsPartiallyLoaded(false);
                    console.log(`[DistrictMapGL] Mobile progressive loading complete - ${featureCount} features loaded`);
                    return;
                  }

                  const currentChunk = remainingChunks[currentChunkIndex];
                  const processedChunk = currentChunk.map((feature: any) => ({
                    type: feature.type,
                    geometry: {
                      type: feature.geometry.type,
                      coordinates: feature.geometry.coordinates
                    },
                    properties: {
                      GEOID: feature.properties.GEOID,
                      GEOIDFQ: feature.properties.GEOIDFQ,
                      ID: feature.properties.ID,
                      DISTRICT: feature.properties.DISTRICT,
                      STATEFP: feature.properties.STATEFP,
                      NAME: feature.properties.NAME,
                      _optimized: true,
                      _mobile: true
                    }
                  }));

                  setGeoJsonData((prevData: any) => {
                    if (!prevData || isCancelled) return prevData;

                    return {
                      ...prevData,
                      features: [...prevData.features, ...processedChunk],
                      _loadedFeatureCount: prevData._loadedFeatureCount + processedChunk.length,
                      _isPartialLoad: (currentChunkIndex + 1) < remainingChunks.length
                    };
                  });

                  const progress = 80 + Math.floor((currentChunkIndex + 1) / remainingChunks.length * 20);
                  setLoadingProgress(progress);

                  currentChunkIndex++;

                  // Use requestIdleCallback on mobile for better performance
                  if (window.requestIdleCallback && isMobile && !isCancelled) {
                    window.requestIdleCallback(() => {
                      if (!isCancelled) loadNextChunk();
                    }, { timeout: 2000 });
                  } else if (!isCancelled) {
                    setTimeout(() => {
                      if (!isCancelled) loadNextChunk();
                    }, 300); // Longer delay for mobile stability
                  }
                };

                loadNextChunk();
              }
            }, 2000); // Longer initial delay for mobile stability

          } else {
            // Load full dataset with mobile optimizations
            const optimizedData = {
              ...data,
              features: data.features.map((feature: any) => ({
                type: feature.type,
                geometry: {
                  type: feature.geometry.type,
                  coordinates: feature.geometry.coordinates
                },
                properties: {
                  // Minimal properties for mobile
                  GEOID: feature.properties.GEOID,
                  GEOIDFQ: feature.properties.GEOIDFQ,
                  ID: feature.properties.ID,
                  DISTRICT: feature.properties.DISTRICT,
                  STATEFP: feature.properties.STATEFP,
                  NAME: feature.properties.NAME,
                  _optimized: true,
                  _mobile: isMobile
                }
              }))
            };

            optimizedData._isLargeDataset = isLargeDataset;
            optimizedData._isMobile = isMobile;
            optimizedData._originalFeatureCount = featureCount;
            optimizedData._loadedFeatureCount = featureCount;
            setGeoJsonData(optimizedData);
          }
        } else {
          // Desktop or small datasets - simple load with minimal optimization
          const optimizedData = {
            ...data,
            features: data.features.map((feature: any) => ({
              type: feature.type,
              geometry: feature.geometry,
              properties: {
                ...feature.properties,
                _optimized: true
              }
            }))
          };

          optimizedData._isLargeDataset = isLargeDataset;
          optimizedData._isMobile = false;
          optimizedData._originalFeatureCount = featureCount;
          optimizedData._loadedFeatureCount = featureCount;
          setGeoJsonData(optimizedData);
        }

        setLoadingProgress(100);

      } catch (err: any) {
        if (!isCancelled) {
          console.error('[DistrictMapGL] Error loading GeoJSON:', err);
          if (err.name === 'AbortError') {
            // Silently handle abort errors to prevent console spam
            console.debug('[DistrictMapGL] Request aborted');
            setError('Loading was interrupted. Please try again.');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load district data');
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadGeoJsonData();

    return () => {
      isCancelled = true;
      // Safely abort the controller without throwing errors
      if (abortController && !abortController.signal.aborted) {
        try {
          abortController.abort('Component cleanup');
        } catch (abortError) {
          // Silently ignore abort errors during cleanup
        }
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [geojsonUrl, isMobile]);

  // Performance optimization: Memoize the fill color expression to prevent recalculation on every render
  const fillColorExpression = React.useMemo((): any => {
    // Priority: Topic Heatmap > Representative Heatmap > Gerrymandering > Party Affiliation > Default Color

    const NO_DATA_COLOR = '#f8f9fa';

    // Topic heatmap coloring takes precedence
    if (showTopicHeatmap && Object.keys(topicScores).length > 0) {
      const caseExpression: any[] = ['case'];

      // Performance optimization: Batch process entries for better performance
      const topicEntries = Object.entries(topicScores);
      topicEntries.forEach(([districtId, score]) => {
        const topicColor = getTopicHeatmapColor(score);

        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(topicColor);
      });

      // Default fallback color for unmapped features when heatmap active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }

    // Representative heatmap coloring
    if (showRepHeatmap && Object.keys(repScores).length > 0) {
      const caseExpression: any[] = ['case'];

      // Performance optimization: Batch process entries for better performance
      const repEntries = Object.entries(repScores);
      repEntries.forEach(([districtId, score]) => {
        const repColor = getRepHeatmapColor(score);

        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(repColor);
      });

      // Default fallback color for unmapped features when heatmap active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }

    // Gerrymandering coloring takes precedence
    if (showGerrymandering && Object.keys(gerryScores).length > 0) {
      const caseExpression: any[] = ['case'];

      // Performance optimization: Batch process entries for better performance
      const scoreEntries = Object.entries(gerryScores);
      scoreEntries.forEach(([districtId, score]) => {
        const gerryColor = getGerrymanderingColor(score);

        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(gerryColor);
      });

      // Default fallback color for unmapped features when overlay active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }

    // Party affiliation coloring (if gerrymandering is not active)
    if (showPartyAffiliation && Object.keys(districtPartyMapping).length > 0) {
      const caseExpression: any[] = ['case'];

      // Performance optimization: Batch process party mapping entries
      const partyEntries = Object.entries(districtPartyMapping);
      partyEntries.forEach(([districtId, party]) => {
        const partyColor = partyColors[party] || partyColors['Unknown'] || '#6b7280'; // fallback to gray

        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(partyColor);
      });

      // Default fallback color for unmapped features when overlay active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }

    // Default color (no special coloring active)
    let defaultColor = color;
    if (color.includes('var(')) {
      console.warn('[DistrictMapGL] CSS variable detected in color, using fallback');
      defaultColor = '#2563eb'; // Blue fallback
    }
    return defaultColor;
  }, [showPartyAffiliation, districtPartyMapping, partyColors, showGerrymandering, gerryScores, getGerrymanderingColor, showRepHeatmap, repScores, repDetails, getRepHeatmapColor, showTopicHeatmap, topicScores, getTopicHeatmapColor, color]);

  // Performance optimization: Memoize the click handler to prevent recreation on every render
  const handleClick = React.useCallback((event: any) => {
    try {
      const features = event.features || [];
      const polygon = features.find((f: any) => f.layer.id === 'district-fill');
      if (polygon && onDistrictClick) {
        onDistrictClick(polygon, event.lngLat);
      }
    } catch (err) {
      console.error('[DistrictMapGL] Error handling click:', err);
    }
  }, [onDistrictClick]);

  // Performance optimization: Memoize marker management with error handling
  React.useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    try {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      if (popupMarker && typeof window !== 'undefined') {
        const marker = new (require('maplibre-gl').Marker)({
          element: (() => {
            const el = document.createElement('div');
            el.innerHTML = popupMarker.iconHtml || `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`;
            el.style.transform = 'translate(-50%, -100%)';
            el.style.position = 'absolute';
            el.style.pointerEvents = 'none';
            return el;
          })(),
          draggable: !!popupMarker.draggable,
        })
            .setLngLat([popupMarker.lng, popupMarker.lat])
            .addTo(map);
        if (popupMarker.draggable && typeof popupMarker.onDragEnd === 'function') {
          marker.on('dragend', () => {
            try {
              const lngLat = marker.getLngLat();
              if (popupMarker.onDragEnd) {
                popupMarker.onDragEnd({ lng: lngLat.lng, lat: lngLat.lat });
              }
            } catch (err) {
              console.error('[DistrictMapGL] Error handling marker drag:', err);
            }
          });
        }
        markerRef.current = marker;
      }
    } catch (err) {
      console.error('[DistrictMapGL] Error managing marker:', err);
    }

    return () => {
      try {
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
      } catch (err) {
        console.error('[DistrictMapGL] Error cleaning up marker:', err);
      }
    };
  }, [popupMarker]);

  // Optimized layer paint properties - mobile-specific optimizations
  const layerFillPaint = React.useMemo(() => {
    const baseOpacity = (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) ?
        (isMobile ? 0.65 : 0.75) : // Slightly lower opacity on mobile for better performance
        (isMobile ? 0.06 : 0.08);

    return {
      'fill-color': fillColorExpression,
      'fill-opacity': baseOpacity,
    };
  }, [fillColorExpression, showPartyAffiliation, showGerrymandering, showTopicHeatmap, showRepHeatmap, isMobile]);

  const layerLinePaint = React.useMemo(() => {
    // If borders are disabled, make the line completely transparent
    if (!showDistrictBorders) {
      return {
        'line-color': 'transparent',
        'line-width': 0,
        'line-opacity': 0
      };
    }

    const lineWidth = (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) ?
        (isMobile ? 0.5 : 1) : // Thinner lines on mobile for better performance
        (isMobile ? 1 : 2);

    return {
      'line-color': (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) ? '#000000' : (color.includes('var(') ? '#2563eb' : color),
      'line-width': lineWidth,
    };
  }, [showPartyAffiliation, showGerrymandering, showTopicHeatmap, showRepHeatmap, color, isMobile, showDistrictBorders]);

  // Simplified Source properties to avoid clustering issues and enable world copies
  const sourceProps = React.useMemo(() => {
    if (!geoJsonData) return null;

    return {
      id: "districts",
      type: "geojson" as const,
      data: geoJsonData,
      // Simplified properties for maximum compatibility
      tolerance: 0.5,
      buffer: 64,
      generateId: true,
      // Remove clustering entirely to avoid undefined boolean issues
      cluster: false
    };
  }, [geoJsonData]);

  // Enhanced loading state with progress for mobile
  if (loading) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '8px' }}>
              {isMobile ? 'Loading district data for mobile...' : 'Loading district data...'}
            </div>
            {loadingProgress > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{
                    width: '200px',
                    height: '4px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '2px',
                    margin: '0 auto',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${loadingProgress}%`,
                      height: '100%',
                      backgroundColor: '#2563eb',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                    {loadingProgress}%
                  </div>
                </div>
            )}
            <div style={{ fontSize: '12px', color: '#666' }}>
              {isMobile ? 'Optimizing for mobile device...' : 'This may take a moment on mobile devices'}
            </div>
            {isPartiallyLoaded && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                  Loading progressively to prevent crashes...
                </div>
            )}
          </div>
        </div>
    );
  }

  // Show error state
  if (error) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#dc2626' }}>
            <div style={{ marginBottom: '8px' }}>Failed to load district data</div>
            <div style={{ fontSize: '12px' }}>{error}</div>
            {isMobile && (
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                  Try refreshing or switch to a smaller district view
                </div>
            )}
          </div>
        </div>
    );
  }

  // Don't render map until data is loaded
  if (!geoJsonData) {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>Preparing map...</div>
        </div>
    );
  }

  return (
      <Map
          ref={mapRef}
          initialViewState={initialViewState}
          style={{ width: '100%', height: '100%' }}
          mapStyle={mapStyle}
          interactiveLayerIds={['district-fill']}
          onClick={handleClick}
          // Standard settings for world copies support
          maxZoom={18}
          minZoom={0}
          attributionControl={false}
          fadeDuration={0} // Disable fade for better mobile performance
          // Standard interaction settings
          touchZoomRotate={true}
          touchPitch={false} // Disable pitch for better mobile performance
          dragRotate={false} // Disable rotation for better mobile performance
          doubleClickZoom={true}
          scrollZoom={true}
          renderWorldCopies={true} // Explicitly enable world copies
      >
        {sourceProps && (
            <Source {...sourceProps}>
              <Layer
                  id="district-fill"
                  type="fill"
                  paint={layerFillPaint}
              />
              <Layer
                  id="district-outline"
                  type="line"
                  paint={layerLinePaint}
                  layout={{
                    'line-cap': 'round',
                    'line-join': 'round'
                  }}
              />
            </Source>
        )}

        {/* Show loading indicator overlay for partial loads */}
        {isPartiallyLoaded && (geoJsonData?._originalFeatureCount > 0) && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                right: '10px',
                backgroundColor: 'var(--district-loading-bg, rgba(255,255,255,0.92))',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000,
                color: 'var(--district-loading-text, #222)'
              }}
              className={typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'district-loading-dark' : ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  border: '2px solid #e0e0e0',
                  borderTop: '2px solid #2563eb',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Loading additional districts... ({geoJsonData?._loadedFeatureCount || 0}/{geoJsonData?._originalFeatureCount || 0})</span>
              </div>
              <style>{`
                .district-loading-dark {
                  --district-loading-bg: rgba(30, 32, 36, 0.92);
                  --district-loading-text: #f3f4f6;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
        )}
      </Map>
  );
});

