'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, Brain, Sparkles, FileText } from 'lucide-react';
import { useDetailedAISummary } from '@/hooks/use-detailed-ai-summary';
import { Legislation } from '@/types/legislation';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

interface DetailedAISummarySectionProps {
  legislation: Legislation;
}

// Custom markdown components for better styling
const markdownComponents = {
  p: ({ children, ...props }: any) => (
    <p className="mb-4 leading-relaxed text-foreground text-sm" {...props}>{children}</p>
  ),
  h1: ({ children, ...props }: any) => (
    <h1 className="text-xl font-bold mb-4 mt-6 text-blue-600 dark:text-blue-400 first:mt-0" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-lg font-semibold mb-3 mt-5 text-blue-600 dark:text-blue-400 first:mt-0" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-base font-semibold mb-2 mt-4 text-blue-600 dark:text-blue-400 first:mt-0" {...props}>{children}</h3>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-inside mb-4 space-y-1 text-foreground pl-2" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground pl-2" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-foreground text-sm leading-relaxed" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold text-foreground" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: any) => (
    <em className="italic text-foreground" {...props}>{children}</em>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-4 border-blue-300 pl-4 my-4 italic text-muted-foreground bg-blue-50 dark:bg-blue-950/30 py-2 rounded-r" {...props}>
      {children}
    </blockquote>
  ),
  code: ({ children, ...props }: any) => (
    <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
      {children}
    </code>
  ),
  // Handle text nodes and asterisk formatting that might still come through
  text: ({ children, ...props }: any) => {
    if (typeof children === 'string') {
      // Clean up any remaining asterisk formatting
      const cleanText = children.replace(/^\*{1,2}([^*]+)\*{1,2}$/g, '$1');
      return <span {...props}>{cleanText}</span>;
    }
    return <span {...props}>{children}</span>;
  },
};

export function DetailedAISummarySection({ legislation }: DetailedAISummarySectionProps) {
  const [showDetailedSummary, setShowDetailedSummary] = useState(false);
  
  const {
    summary,
    isLoading,
    error,
    generateSummary,
    canRefresh,
    timeUntilCanRefresh
  } = useDetailedAISummary({
    legislationId: legislation.id,
    autoFetch: false
  });

  // Check if this is a Congress bill with acceptable source
  const isCongressBill = legislation.jurisdictionName === "United States Congress";
  const hasAcceptableSource = ['pdf-extracted', 'pdf'].includes(legislation.geminiSummarySource || '');
  const isEligible = isCongressBill && hasAcceptableSource;

  // If bill already has a long summary, show it
  const existingLongSummary = legislation.longGeminiSummary;

  const handleShowDetailedSummary = () => {
    setShowDetailedSummary(true);
    if (!existingLongSummary) {
      generateSummary();
    }
  };

  const handleRefresh = () => {
    if (!canRefresh) return;
    generateSummary(true); // force refresh
  };

  // Don't render anything if not eligible
  if (!isEligible) {
    return null;
  }

  return (
    <AnimatedSection>
      <Card className="border border-blue-500/30 rounded-lg bg-blue-950/20">
        <CardHeader className="p-4">
          <CardTitle className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
            Detailed AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          {/* Eligibility info */}
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              Congress Bill
            </Badge>
            <Badge variant="outline" className="text-green-600 border-green-300">
              {legislation.geminiSummarySource === 'pdf-extracted' ? 'PDF Source' : 'PDF Available'}
            </Badge>
          </div>

          {/* Show existing long summary or generate button */}
          {!showDetailedSummary && !existingLongSummary && (
            <div className="text-center py-6">
              <FileText className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Generate a comprehensive AI analysis of this Congress bill using the full text. 
                This provides deeper insights beyond the basic summary.
              </p>
              <Button
                onClick={handleShowDetailedSummary}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Detailed Analysis
              </Button>
            </div>
          )}

          {/* Show existing long summary */}
          {existingLongSummary && !showDetailedSummary && (
            <div className="space-y-4">
              <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-blue prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {existingLongSummary}
                </ReactMarkdown>
              </div>
              {/* <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading || !canRefresh}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Regenerate
                  {!canRefresh && (
                    <span className="ml-2 text-xs">({timeUntilCanRefresh}s)</span>
                  )}
                </Button>
              </div> */}
            </div>
          )}

          {/* Show generated summary or loading state */}
          {showDetailedSummary && (
            <div className="space-y-4">
              {isLoading && (
                <div className="text-center py-6">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p className="text-sm text-muted-foreground">
                    Generating detailed analysis... This may take up to 30 seconds.
                  </p>
                </div>
              )}

              {summary && !isLoading && (
                <div className="space-y-4">
                  <div className="text-sm prose prose-sm max-w-none dark:prose-invert prose-blue prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {summary}
                    </ReactMarkdown>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isLoading || !canRefresh}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Regenerate
                      {!canRefresh && (
                        <span className="ml-2 text-xs">({timeUntilCanRefresh}s)</span>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Rate limit info alert */}
              {/* {!canRefresh && showDetailedSummary && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You can generate a new analysis in {timeUntilCanRefresh} seconds. This helps us manage server resources.
                  </AlertDescription>
                </Alert>
              )} */}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {error}. Try refreshing or check your internet connection.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedSection>
  );
}
