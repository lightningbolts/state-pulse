"use client";

import {Button} from "@/components/ui/button";
import {ExternalLink, FileText, X} from "lucide-react";
import {useRouter} from "next/navigation";
import {Bill} from "@/types/legislation";

interface SelectedBillsProps {
    selectedBills: Bill[];
    onRemoveBill: (billId: string) => void;
    onClearAll: () => void;
    className?: string;
    title?: string;
    description?: string;
    readOnly?: boolean;
}

export function SelectedBills({
                                  selectedBills,
                                  onRemoveBill,
                                  onClearAll,
                                  className,
                                  title = "Selected Bills",
                                  description = "These bills will be referenced in your message",
                                  readOnly = false
                              }: SelectedBillsProps) {
    const router = useRouter();

    if (selectedBills.length === 0) {
        return null;
    }

    const handleViewDetails = (billId: string) => {
        router.push(`/legislation/${billId}`);
    };

    return (
        <div className={className}>
            <label className="block text-sm font-medium mb-2">
                {title} ({selectedBills.length})
            </label>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="space-y-3">
                    {selectedBills.map((bill) => {
                        if (!bill) return null;
                        return (
                            <div
                                key={bill.id}
                                className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-primary"/>
                                        <span className="font-medium text-sm">{bill.title}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">
                                        {bill.identifier} - {bill.latest_action_date}
                                    </div>
                                    {bill.abstract && (
                                        <div className="text-xs text-muted-foreground">
                                            {bill.abstract}
                                        </div>
                                    )}
                                    {readOnly && (
                                        <div className="mt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleViewDetails(bill.id)}
                                                className="text-xs flex items-center gap-1"
                                            >
                                                <ExternalLink className="h-3 w-3"/>
                                                View Details
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {!readOnly && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onRemoveBill(bill.id)}
                                        className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        aria-label={`Remove ${bill.identifier}`}
                                    >
                                        <X className="h-4 w-4"/>
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700 dark:text-blue-300">
              {description}
            </span>
                        {!readOnly && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClearAll}
                                className="text-xs"
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
