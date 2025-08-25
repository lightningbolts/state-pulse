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
        <CardHeader>
          <div className="h-6 bg-muted rounded w-3/4"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <HelpCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
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
    <Card className="shadow-lg border-l-4 border-l-blue-500 dark:border-l-blue-400">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          Voting Outcome Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Prediction */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            {getOutcomeIcon(prediction.prediction.outcome)}
            <Badge
              variant="outline"
              className={`text-lg px-4 py-2 ${getOutcomeColor(prediction.prediction.outcome)}`}
            >
              {prediction.prediction.outcome.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Confidence Level</span>
              <span className="font-semibold">{prediction.prediction.confidence}%</span>
            </div>
            <Progress value={prediction.prediction.confidence} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Probability of Passage</span>
              <span className="font-semibold">{prediction.prediction.probabilityPass}%</span>
            </div>
            <Progress
              value={prediction.prediction.probabilityPass}
              className="h-2"
            />
          </div>
        </div>

        {/* Key Factors */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Supporting Factors
            </h4>
            <ul className="space-y-1">
              {prediction.factors.supportingFactors.map((factor, index) => (
                <li key={index} className="text-sm text-green-600 dark:text-green-400 flex items-start gap-2">
                  <span className="text-green-500 dark:text-green-400 mt-1">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Opposing Factors
            </h4>
            <ul className="space-y-1">
              {prediction.factors.opposingFactors.map((factor, index) => (
                <li key={index} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span className="text-red-500 dark:text-red-400 mt-1">•</span>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Timeline */}
        {(prediction.timeline.estimatedVoteDate || prediction.timeline.nextMilestones.length > 0) && (
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline & Milestones
            </h4>

            {prediction.timeline.estimatedVoteDate && (
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Estimated Vote Date:</strong> {prediction.timeline.estimatedVoteDate}
              </p>
            )}

            {prediction.timeline.nextMilestones.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-blue-800 dark:text-blue-200">Next Milestones:</p>
                <ul className="space-y-1">
                  {prediction.timeline.nextMilestones.map((milestone, index) => (
                    <li key={index} className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                      <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                      {milestone}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Analysis Details */}
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Detailed Analysis
          </h4>

          <div className="grid gap-3 text-sm">
            <div>
              <strong className="text-foreground">Partisan Analysis:</strong>
              <p className="mt-1 text-muted-foreground">{prediction.analysis.partisanAnalysis}</p>
            </div>

            <div>
              <strong className="text-foreground">Public Sentiment:</strong>
              <p className="mt-1 text-muted-foreground">{prediction.analysis.publicSentiment}</p>
            </div>

            <div>
              <strong className="text-foreground">Stakeholder Impact:</strong>
              <p className="mt-1 text-muted-foreground">{prediction.analysis.stakeholderImpact}</p>
            </div>

            <div>
              <strong className="text-foreground">Historical Precedent:</strong>
              <p className="mt-1 text-muted-foreground">{prediction.analysis.historicalPrecedent}</p>
            </div>
          </div>
        </div>

        {/* Key Risks */}
        {prediction.analysis.keyRisks.length > 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h4 className="font-semibold text-yellow-700 dark:text-yellow-300 flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" />
              Key Risks
            </h4>
            <ul className="space-y-1">
              {prediction.analysis.keyRisks.map((risk, index) => (
                <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 mt-1">•</span>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reasoning */}
        <div className="pt-4 border-t border-border">
          <h4 className="font-semibold text-foreground mb-2">AI Reasoning</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {prediction.reasoning}
          </p>
        </div>

        {/* Metadata */}
        <div className="text-xs text-muted-foreground pt-2 border-t border-border/50">
          Last updated: {new Date(prediction.updatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
