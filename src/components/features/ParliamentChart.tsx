"use client"
import React, { useMemo, useEffect, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { MemberVote } from '@/types/legislation';

let modulesLoaded = false;
const loadHighchartsModules = async () => {
  if (modulesLoaded || typeof window === 'undefined') return;
  try {
    const [itemSeries, accessibility] = await Promise.all([
      import('highcharts/modules/item-series'),
      import('highcharts/modules/accessibility')
    ]);
    const itemSeriesInit = itemSeries.default as any;
    const accessibilityInit = accessibility.default as any;
    if (typeof itemSeriesInit === 'function') itemSeriesInit(Highcharts);
    if (typeof accessibilityInit === 'function') accessibilityInit(Highcharts);
    modulesLoaded = true;
  } catch (error) {
    console.warn('Failed to load Highcharts modules:', error);
  }
};

interface ExtendedMemberVote extends MemberVote {
  chamber?: string;
  memberName?: string;
  party?: string;
  state?: string;
  voteParty?: string;
  voteState?: string;
  voteQuestion?: string; // Add vote question context
}

interface ParliamentChartProps {
  votes: ExtendedMemberVote[];
  chamber: string;
}

const VOTE_TYPES = { YES: 'Yes', NO: 'No', PRESENT: 'Present', NOT_VOTING: 'Not Voting' };

const normalizeVoteType = (vote: string): string => {
  const lowerVote = vote.toLowerCase().trim();
  if (lowerVote.includes('yea') || lowerVote.includes('aye') || lowerVote === 'yes') return VOTE_TYPES.YES;
  if (lowerVote.includes('nay') || lowerVote === 'no') return VOTE_TYPES.NO;
  if (lowerVote.includes('present')) return VOTE_TYPES.PRESENT;
  return VOTE_TYPES.NOT_VOTING;
};

const getVoteColor = (voteType: string): string => {
  switch (voteType) {
    case VOTE_TYPES.YES: return '#22c55e';
    case VOTE_TYPES.NO: return '#ef4444';
    case VOTE_TYPES.PRESENT: return '#eab308';
    case VOTE_TYPES.NOT_VOTING: return '#a1a1aa';
    default: return '#e5e5e5';
  }
};

const getChamberTotalSeats = (chamberName?: string): number | null => {
  if (!chamberName) return null;
  const lowerChamber = chamberName.toLowerCase();
  if (lowerChamber.includes('house')) return 435;
  if (lowerChamber.includes('senate')) return 100;
  return null;
};

// **FIXED**: Replaced with a simpler, more robust position calculation algorithm
const calculateParliamentPositions = (totalSeats: number, screenSize: 'mobile' | 'tablet' | 'desktop' = 'desktop') => {
  const positions: Array<{ x: number, y: number }> = [];
  
  // Responsive scaling factors
  const scales = {
    mobile: { centerX: 200, centerY: 40, startRadius: 50, sizeMultiplier: 0.6 },
    tablet: { centerX: 300, centerY: 45, startRadius: 65, sizeMultiplier: 0.8 },
    desktop: { centerX: 400, centerY: 50, startRadius: 80, sizeMultiplier: 1.0 }
  };
  
  const scale = scales[screenSize];
  const centerX = scale.centerX;
  const centerY = scale.centerY;

  // Dynamically adjust dot size and spacing based on seat count and screen size
  const baseMarkerRadius = totalSeats <= 150 ? 7 : 5;
  const markerRadius = Math.max(2, baseMarkerRadius * scale.sizeMultiplier);
  const rowSpacing = markerRadius * 2.2; // Tighter spacing on mobile
  const dotSpacing = markerRadius * (screenSize === 'mobile' ? 2.0 : 2.4);
  const startRadius = scale.startRadius;

  let seatsPlaced = 0;
  let row = 0;

  while (seatsPlaced < totalSeats) {
    const radius = startRadius + row * rowSpacing;
    const circumference = Math.PI * radius;
    const seatsInThisRow = Math.floor(circumference / dotSpacing);

    if (seatsInThisRow <= 0) break; // Failsafe

    const angleIncrement = seatsInThisRow > 1 ? Math.PI / (seatsInThisRow - 1) : 0;

    for (let i = 0; i < seatsInThisRow && seatsPlaced < totalSeats; i++) {
      // Generate points from left (PI) to right (0)
      const angle = Math.PI - (i * angleIncrement);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius; // Y increases downwards
      positions.push({ x, y });
      seatsPlaced++;
    }
    row++;
  }
  return { positions, markerRadius };
};


const ParliamentChart: React.FC<ParliamentChartProps> = ({ votes, chamber }) => {
  const [isReady, setIsReady] = useState(false);
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadHighchartsModules().then(() => setIsReady(true));
  }, []);

  // Screen size detection hook
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    // Set initial screen size
    updateScreenSize();

    // Listen for window resize
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // Dark mode detection hook
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
    };

    updateTheme();

    // Listen for theme changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  const chartData = useMemo(() => {
    const chambersToRender = chamber === 'all'
      ? Array.from(new Set(votes.map((v: ExtendedMemberVote) => v.chamber || 'Unknown')))
      : [chamber];

    return chambersToRender.map(chamberName => {
      const chamberVotes = votes.filter((v: ExtendedMemberVote) => (v.chamber || 'Unknown') === chamberName);
      const totalSeats = getChamberTotalSeats(chamberName) || chamberVotes.length;

      const voteGroups = chamberVotes.reduce((acc, vote) => {
        const voteType = normalizeVoteType(vote.voteCast);
        if (!acc[voteType]) {
          acc[voteType] = [];
        }
        acc[voteType].push(vote);
        return acc; // This line fixes the error
      }, {} as Record<string, ExtendedMemberVote[]>);

      // Use the responsive calculation function
      const { positions, markerRadius } = calculateParliamentPositions(totalSeats, screenSize);

      // Sort positions by angle to ensure a clean left-to-right path for coloring
      const sortedPositions = [...positions].sort((a, b) => {
        const centerX = screenSize === 'mobile' ? 200 : screenSize === 'tablet' ? 300 : 400;
        const centerY = screenSize === 'mobile' ? 40 : screenSize === 'tablet' ? 45 : 50;
        const angleA = Math.atan2(a.y - centerY, a.x - centerX);
        const angleB = Math.atan2(b.y - centerY, b.x - centerX);
        return angleB - angleA;
      });

      // This order ensures Yes (green) is on the left and No (red) is on the right
      const voteTypeOrder = [VOTE_TYPES.YES, VOTE_TYPES.PRESENT, VOTE_TYPES.NOT_VOTING, VOTE_TYPES.NO];
      const organizedVotes: (ExtendedMemberVote | null)[] = [];
      
      voteTypeOrder.forEach(voteType => {
        if (voteGroups[voteType]) organizedVotes.push(...voteGroups[voteType]);
      });

      const vacantSeats = totalSeats - chamberVotes.length;
      for (let i = 0; i < vacantSeats; i++) organizedVotes.push(null);

      const allSeats = organizedVotes.map((vote, index) => {
        const position = sortedPositions[index];
        if (!position) return null;
        const isVacant = !vote;
        const voteType = isVacant ? 'Vacant' : normalizeVoteType(vote!.voteCast);
        const memberName = isVacant ? 'Vacant Seat' : (vote!.memberName || `${vote!.firstName} ${vote!.lastName}`);

        return {
          x: position.x,
          y: position.y,
          name: memberName,
          voteType,
          member: vote,
          color: getVoteColor(voteType),
          bioguideId: vote?.bioguideId || null,
          marker: {
            fillColor: getVoteColor(voteType),
            radius: markerRadius,
            lineWidth: 1,
            lineColor: 'rgba(255, 255, 255, 0.5)',
            states: { hover: { radius: markerRadius + 2, lineWidth: 2 } }
          },
        };
      }).filter(Boolean);
      
      const series: Highcharts.SeriesOptionsType[] = [{
        type: 'scatter',
        name: 'Seats',
        data: allSeats,
        showInLegend: false
      }];

      const voteTypeCounts = Object.entries(voteGroups).map(([voteType, members]) => ({
        name: voteType, count: members.length, color: getVoteColor(voteType)
      }));
      if (vacantSeats > 0) {
        voteTypeCounts.push({ name: 'Vacant', count: vacantSeats, color: getVoteColor('Vacant') });
      }

      return { chamberName, series, totalVoted: chamberVotes.length, totalSeats, voteTypeCounts };
    });
  }, [votes, chamber, screenSize, isDarkMode]);
  
  if (!isReady || votes.length === 0) {
    return <div className="flex justify-center items-center h-96 text-gray-500 dark:text-gray-400">
      {isReady ? 'No votes to display' : 'Loading chart...'}
    </div>;
  }

  return (
    <div className="w-full">
      {chartData.map(({ chamberName, series, totalVoted, totalSeats, voteTypeCounts }, index) => {
        // Responsive chart configuration
        const chartConfig = {
          mobile: { 
            height: 300, 
            titleSize: '1.2rem',
            subtitleSize: '0.85rem',
            tooltipSize: '12px'
          },
          tablet: { 
            height: 400, 
            titleSize: '1.35rem',
            subtitleSize: '0.9rem',
            tooltipSize: '13px'
          },
          desktop: { 
            height: 500, 
            titleSize: '1.5rem',
            subtitleSize: '1rem',
            tooltipSize: '14px'
          }
        };

        const config = chartConfig[screenSize];

        // Use isDarkMode state for proper theme colors
        const titleColor = isDarkMode ? '#f200ffff' : '#1e293b';
        const subtitleColor = isDarkMode ? '#f200ffff' : '#dbdbdbff';

        const options: Highcharts.Options = {
          chart: { type: 'scatter', backgroundColor: 'transparent', height: config.height },
          title: { text: chamberName.replace(/_/g, ' '), style: { color: titleColor, fontSize: config.titleSize, fontWeight: 'bold' } },
          subtitle: { text: `${totalVoted} voted out of ${totalSeats} seats`, style: { color: subtitleColor, fontSize: config.subtitleSize } },
          xAxis: { visible: false, minPadding: 0.05, maxPadding: 0.05 },
          yAxis: { visible: false, minPadding: 0.05, maxPadding: 0.05, startOnTick: false, endOnTick: false },
          legend: { enabled: false },
          series: series,
          tooltip: {
            useHTML: true,
            backgroundColor: 'rgba(31, 41, 55, 0.95)',
            borderColor: '#4b5563',
            borderRadius: 8,
            style: { color: '#F9FAFB', fontSize: config.tooltipSize },
            formatter: function () {
              const point = this.point as any;
              const member = point.member as ExtendedMemberVote | undefined;
              if (!member) return `<div class="p-3 text-center"><b>Vacant Seat</b></div>`;

              const memberName = member.memberName || `${member.firstName} ${member.lastName}`;
              const party = member.party || member.voteParty;
              const state = member.state || member.voteState;
              let partyStateInfo = '';
              if (party && state) {
                partyStateInfo = `<div class="text-sm text-gray-300 mb-2">${party} - ${state}</div>`;
              } else if (party || state) {
                partyStateInfo = `<div class="text-sm text-gray-300 mb-2">${party || state}</div>`;
              }
              
              return `
                <div class="p-3 font-sans max-w-xs">
                  <div class="font-bold text-gray-100 text-lg">${memberName}</div>
                  ${partyStateInfo}
                  <div class="text-sm">
                    Vote: <span class="font-semibold px-2 py-1 rounded" style="background-color: ${getVoteColor(point.voteType)}; color: white;">${member.voteCast}</span>
                  </div>
                  <div class="text-xs text-gray-400 mt-2">Click to view representative</div>
                </div>
              `;
            }
          },
          plotOptions: {
            scatter: {
              cursor: 'pointer',
              point: {
                events: {
                  click: function () {
                    const point = this as any;
                    if (point.bioguideId) {
                      window.open(`/representatives/${point.bioguideId}`, '_blank');
                    }
                  }
                }
              }
            }
          },
          credits: { enabled: false },
        };

        return (
          <div key={chamberName || index} className="mb-8">
            <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 sm:p-4">
              <HighchartsReact highcharts={Highcharts} options={options} />
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-600">
                <div className="flex justify-center">
                  <div className={`grid gap-2 sm:gap-4 text-xs sm:text-sm ${
                    screenSize === 'mobile' 
                      ? 'grid-cols-2' 
                      : 'grid-cols-2 md:grid-cols-4'
                  }`}>
                    {voteTypeCounts.map(({ name, count, color }) => (
                      <div key={name} className={`flex items-center gap-2 sm:gap-3 ${
                        screenSize === 'mobile' ? 'min-w-[100px]' : 'min-w-[120px]'
                      }`}>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <div className={`rounded-full border-2 border-white shadow-sm ${
                            screenSize === 'mobile' ? 'w-3 h-3' : 'w-4 h-4'
                          }`} style={{ backgroundColor: color }} />
                          <div className="text-gray-900 dark:text-gray-100">
                            <div className="font-semibold">{name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{count} seats</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`text-center mt-2 sm:mt-3 text-xs text-gray-500 dark:text-gray-400 ${
                  screenSize === 'mobile' ? 'text-xs' : ''
                }`}>
                  Click on any seat to view representative details
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ParliamentChart;