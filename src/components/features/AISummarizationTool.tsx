"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { summarizeLegislationPlainEnglish } from "@/ai/flows/summarize-legislation";
import { summarizeLegislationLegallyDense } from "@/ai/flows/summarize-legislation-legally-dense";
import { summarizeLegislationTweetLength } from "@/ai/flows/summarize-legislation-tweet-length";
import { BrainCircuit, FileText, Twitter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

type SummaryType = "plain" | "legal" | "tweet";

export function AISummarizationTool() {
  const [billText, setBillText] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSummaryType, setActiveSummaryType] = useState<SummaryType | null>(null);
  const { toast } = useToast();

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setBillText(event.target.value);
  };

  const handleSubmit = async (summaryType: SummaryType) => {
    if (!billText.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter some bill text to summarize.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSummary("");
    setActiveSummaryType(summaryType);

    try {
      let result;
      if (summaryType === "plain") {
        result = await summarizeLegislationPlainEnglish({ legislationText: billText });
        setSummary(result.summary);
      } else if (summaryType === "legal") {
        result = await summarizeLegislationLegallyDense({ billText: billText });
        setSummary(result.summary);
      } else if (summaryType === "tweet") {
        result = await summarizeLegislationTweetLength({ legislationText: billText });
        setSummary(result.tweetLengthSummary);
      }
      toast({
        title: "Summary Generated",
        description: `Successfully generated ${summaryType} summary.`,
      });
    } catch (error) {
      console.error("Error summarizing legislation:", error);
      setSummary("Failed to generate summary. Please try again.");
      toast({
        title: "Error",
        description: "Failed to generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">AI Summarization Tool</CardTitle>
        <CardDescription>Get AI-powered summaries of legislative text in various styles. Paste the bill text below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e: FormEvent) => e.preventDefault()} className="space-y-6">
          <div>
            <Textarea
              placeholder="Paste the full text of the bill here..."
              value={billText}
              onChange={handleInputChange}
              rows={10}
              className="w-full p-3 border rounded-md shadow-sm focus:ring-primary focus:border-primary"
              aria-label="Bill text input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => handleSubmit("plain")} 
              disabled={isLoading || !billText.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              <FileText className="mr-2 h-4 w-4" /> Plain English
            </Button>
            <Button 
              onClick={() => handleSubmit("legal")} 
              disabled={isLoading || !billText.trim()}
              variant="secondary"
            >
              <BrainCircuit className="mr-2 h-4 w-4" /> Legally Dense
            </Button>
            <Button 
              onClick={() => handleSubmit("tweet")} 
              disabled={isLoading || !billText.trim()}
              variant="outline"
            >
              <Twitter className="mr-2 h-4 w-4" /> Tweet-Length
            </Button>
          </div>
        </form>

        {(isLoading || summary) && (
          <div className="mt-6 p-4 border rounded-md bg-muted/30">
            <h4 className="font-semibold mb-2 text-lg font-headline">
              {isLoading ? "Generating Summary..." : `Summary (${activeSummaryType}):`}
            </h4>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
              </div>
            ) : (
              <ScrollArea className="h-[200px] pr-4">
                <p className="text-sm whitespace-pre-wrap">{summary}</p>
              </ScrollArea>
            )}
             {summary && !isLoading && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Contextual footnotes (e.g., "this law is similar to Texas SB 8") would appear here if available.
                </p>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
