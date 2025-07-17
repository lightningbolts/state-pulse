'use client';

import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ChevronDown, ListChecks} from 'lucide-react';
import {Legislation} from '@/types/legislation';
import {AnimatedSection} from '@/components/ui/AnimatedSection';

interface CollapsibleTimelineProps {
    historyEvents: Legislation['history'];
}

export function CollapsibleTimeline({historyEvents}: CollapsibleTimelineProps) {
    const [timelineOpen, setTimelineOpen] = useState(false);

    if (!historyEvents || historyEvents.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4 mt-6">
            <button
                onClick={() => setTimelineOpen(!timelineOpen)}
                className="flex justify-between items-center w-full cursor-pointer hover:bg-muted/50 py-2 px-0 rounded-md transition-colors"
                aria-expanded={timelineOpen}
                aria-controls="timeline-content"
            >
                <h3 className="text-xl font-semibold text-foreground flex items-center">
                    <ListChecks className="mr-2 h-6 w-6 text-primary"/> Timeline ({historyEvents.length} events)
                </h3>
                <motion.div
                    animate={{rotate: timelineOpen ? 180 : 0}}
                    transition={{duration: 0.2}}
                >
                    <ChevronDown className="h-5 w-5 text-primary"/>
                </motion.div>
            </button>

            <AnimatePresence initial={false}>
                {timelineOpen && (
                    <motion.div
                        id="timeline-content"
                        key="content"
                        initial="collapsed"
                        animate="open"
                        exit="collapsed"
                        variants={{
                            open: {opacity: 1, height: 'auto'},
                            collapsed: {opacity: 0, height: 0},
                        }}
                        transition={{duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98]}}
                        className="overflow-hidden"
                    >
                        {historyEvents.length === 0 ? (
                            <p className="text-muted-foreground">No history events available for this legislation.</p>
                        ) : (
                            <motion.ul
                                className="list-none p-0 m-0"
                                variants={{open: {transition: {staggerChildren: 0.07, delayChildren: 0.2}}}}
                            >
                                {historyEvents.map((event, index) => {
                                    const isLast = index === historyEvents.length - 1;
                                    const itemVariants = {
                                        open: {y: 0, opacity: 1, transition: {y: {stiffness: 1000, velocity: -100}}},
                                        collapsed: {y: 50, opacity: 0, transition: {y: {stiffness: 1000}}}
                                    };
                                    return (
                                        <AnimatedSection key={index} className="relative pl-8 pb-8">
                                            {/* Vertical Connector Line - now correctly spans the full height */}
                                            {!isLast && (
                                                <div className="absolute left-[11px] top-3 h-full w-0.5 bg-primary"/>
                                            )}
                                            {/* Timeline Dot */}
                                            <div
                                                className="absolute left-[6px] top-3 h-3 w-3 rounded-full bg-primary border-2 border-background"/>
                                            <div
                                                className="bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                                <div
                                                    className="font-medium text-primary-foreground bg-primary px-3 py-2 rounded-t-md text-sm flex justify-between items-center -m-4 mb-3">
                                                    <span>{event.date ? new Date(event.date).toLocaleDateString() : 'Date N/A'}</span>
                                                    <span
                                                        className="text-xs opacity-90">{event.actor || 'Unknown Actor'}</span>
                                                </div>
                                                <p className="text-sm text-foreground m-0">{event.action}</p>
                                                {event.details &&
                                                    <p className="text-xs text-muted-foreground mt-1 mb-0">Details: {event.details}</p>}
                                            </div>
                                        </AnimatedSection>
                                    );
                                })}
                            </motion.ul>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
