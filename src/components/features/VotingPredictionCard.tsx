import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  Users,
  Target,
  CheckCircle,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { VotingPrediction } from '@/services/votingPredictionService';

interface VotingPredictionCardProps {
  prediction: VotingPrediction;
  isLoading?: boolean;
}

export function VotingPredictionCard({ prediction, isLoading = false }: VotingPredictionCardProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="h-5 sm:h-6 bg-muted rounded w-3/4"></div>
        </CardHeader>
        <CardContent className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="space-y-2 sm:space-y-3">
            <div className="h-3 sm:h-4 bg-muted rounded w-full"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-2/3"></div>
            <div className="h-6 sm:h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />;
      case 'fail':
        return <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />;
      default:
        return <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'pass':
        return 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800';
      case 'fail':
        return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800';
      default:
        return 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800';
    }
  };

  return (
    <Card className="shadow-lg border-l-4 border-l-blue-500 dark:border-l-blue-400 mx-2 sm:mx-0">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="break-words">Voting Outcome Prediction (Beta)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-3 sm:px-6 sm:py-4 space-y-4 sm:space-y-6">
        {/* Main Prediction */}
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {getOutcomeIcon(prediction.prediction.outcome)}
            <Badge
              variant="outline"
              className={`text-base sm:text-lg px-3 py-1 sm:px-4 sm:py-2 ${getOutcomeColor(prediction.prediction.outcome)}`}
            >
              {prediction.prediction.outcome.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm text-foreground">
              <span>Confidence Level</span>
              <span className="font-semibold">{prediction.prediction.confidence}%</span>
            </div>
            <Progress value={prediction.prediction.confidence} className="h-1.5 sm:h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm text-foreground">
              <span>Probability of Passage</span>
              <span className="font-semibold">{prediction.prediction.probabilityPass}%</span>
            </div>
            <Progress
              value={prediction.prediction.probabilityPass}
              className="h-1.5 sm:h-2"
            />
          </div>
        </div>

        {/* Key Factors */}
        <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
          <div className="space-y-2">
            <h4 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2 text-sm sm:text-base">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <span>Supporting Factors</span>
            </h4>
            <ul className="space-y-1">
              {prediction.factors.supportingFactors.map((factor, index) => (
                <li key={index} className="text-xs sm:text-sm text-green-600 dark:text-green-400 flex items-start gap-2">
                  <span className="text-green-500 dark:text-green-400 leading-none flex-shrink-0 mt-[0.125rem]">•</span>
                  <span className="break-words">{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 text-sm sm:text-base">
              <TrendingDown className="h-4 w-4 flex-shrink-0" />
              <span>Opposing Factors</span>
            </h4>
            <ul className="space-y-1">
              {prediction.factors.opposingFactors.map((factor, index) => (
                <li key={index} className="text-xs sm:text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400 leading-none flex-shrink-0 mt-[0.125rem]">•</span>
                  <span className="break-words">{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Timeline */}
        {(prediction.timeline.estimatedVoteDate || prediction.timeline.nextMilestones.length > 0) && (
          <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2 text-sm sm:text-base">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Timeline & Milestones</span>
            </h4>

            {prediction.timeline.estimatedVoteDate && (
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 break-words">
                <strong>Estimated Vote Date:</strong> {prediction.timeline.estimatedVoteDate}
              </p>
            )}

            {prediction.timeline.nextMilestones.length > 0 && (
              <div>
                <p className="text-xs sm:text-sm font-medium mb-2 text-blue-800 dark:text-blue-200">Next Milestones:</p>
                <ul className="space-y-1">
                  {prediction.timeline.nextMilestones.map((milestone, index) => (
                    <li key={index} className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                      <span className="text-blue-500 dark:text-blue-400 leading-none flex-shrink-0 mt-[0.125rem]">•</span>
                      <span className="break-words">{milestone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Analysis Details */}
        <div className="space-y-3 sm:space-y-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span>Detailed Analysis</span>
          </h4>

          <div className="space-y-3 text-xs sm:text-sm">
            <div>
              <strong className="text-foreground block sm:inline">Partisan Analysis:</strong>
              <p className="mt-1 sm:mt-0 sm:ml-1 sm:inline text-muted-foreground break-words leading-relaxed">{prediction.analysis.partisanAnalysis}</p>
            </div>

            <div>
              <strong className="text-foreground block sm:inline">Public Sentiment:</strong>
              <p className="mt-1 sm:mt-0 sm:ml-1 sm:inline text-muted-foreground break-words leading-relaxed">{prediction.analysis.publicSentiment}</p>
            </div>

            <div>
              <strong className="text-foreground block sm:inline">Stakeholder Impact:</strong>
              <p className="mt-1 sm:mt-0 sm:ml-1 sm:inline text-muted-foreground break-words leading-relaxed">{prediction.analysis.stakeholderImpact}</p>
            </div>

            <div>
              <strong className="text-foreground block sm:inline">Historical Precedent:</strong>
              <p className="mt-1 sm:mt-0 sm:ml-1 sm:inline text-muted-foreground break-words leading-relaxed">{prediction.analysis.historicalPrecedent}</p>
            </div>
          </div>
        </div>

        {/* Key Risks */}
        {prediction.analysis.keyRisks.length > 0 && (
          <div className="p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2 mb-2 text-sm sm:text-base">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Key Risks</span>
            </h4>
            <ul className="space-y-1">
              {prediction.analysis.keyRisks.map((risk, index) => (
                <li key={index} className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 leading-none flex-shrink-0 mt-[0.125rem]">•</span>
                  <span className="break-words">{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reasoning */}
        <div className="pt-3 sm:pt-4 border-t border-border">
          <h4 className="font-semibold text-foreground mb-2 text-sm sm:text-base">AI Reasoning</h4>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
            {prediction.reasoning}
          </p>
        </div>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 break-words">
          Last updated: {new Date(prediction.updatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
