'use client';

import {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ChevronDown, ListChecks} from 'lucide-react';
import {Legislation} from '@/types/legislation';
import {AnimatedSection} from '@/components/ui/AnimatedSection';

interface CollapsibleTimelineProps {
    historyEvents: Legislation['history'];
}

// Helper function to detect enacted actions (defined outside component to avoid scoping issues)
const isEnactedAction = (action: string): boolean => {
    if (!action) return false;

    const enactedPatterns = [
        /signed.*(into|by).*(law|governor)/i,
        /approved.*by.*governor/i,
        /became.*law/i,
        /effective.*date/i,
        /chapter.*laws/i,
        /public.*law.*no/i,
        /acts.*of.*assembly.*chapter/i,
        /governor.*signed/i,
        /signed.*into.*law/i
    ];

    return enactedPatterns.some(pattern => pattern.test(action));
};

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
                                    const isEnacted = isEnactedAction(event.action);
                                    return (
                                        <AnimatedSection key={index} className="relative pl-8 pb-8">
                                            {/* Vertical Connector Line - now correctly spans the full height */}
                                            {!isLast && (
                                                <div className={`absolute left-[11px] top-3 h-full w-0.5 ${isEnacted ? 'bg-green-500' : 'bg-primary'}`}/>
                                            )}
                                            {/* Timeline Dot - highlighted for enacted actions */}
                                            <div
                                                className={`absolute left-[6px] top-3 h-3 w-3 rounded-full border-2 border-background ${
                                                    isEnacted ? 'bg-green-500' : 'bg-primary'
                                                }`}/>
                                            <div
                                                className={`bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow ${
                                                    isEnacted ? 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20' : ''
                                                }`}>
                                                <div
                                                    className={`font-medium text-primary-foreground px-3 py-2 rounded-t-md text-sm flex justify-between items-center -m-4 mb-3 ${
                                                        isEnacted ? 'bg-green-600' : 'bg-primary'
                                                    }`}>
                                                    <span className="flex items-center gap-2">
                                                        {event.date ? new Date(event.date).toLocaleDateString() : 'Date N/A'}
                                                        {isEnacted && <span className="text-xs">ENACTED</span>}
                                                    </span>
                                                    <span
                                                        className="text-xs opacity-90">{event.actor || 'Unknown Actor'}</span>
                                                </div>
                                                <p className={`text-sm m-0 ${isEnacted ? 'text-green-800 dark:text-green-200 font-semibold' : 'text-foreground'}`}>
                                                    {event.action}
                                                </p>
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
