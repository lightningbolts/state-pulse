"use client";

import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface Bill {
  id: string;
  identifier: string;
  title: string;
  subject: string[];
  classification: string[];
  from_organization?: {
    name: string;
  };
  latest_action_description?: string;
  latest_action_date?: string;
  abstract?: string;
}

interface SelectedBillsProps {
  selectedBills: Bill[];
  onRemoveBill: (billId: string) => void;
  onClearAll: () => void;
  className?: string;
  title?: string;
  description?: string;
}

export function SelectedBills({
  selectedBills,
  onRemoveBill,
  onClearAll,
  className,
  title = "Selected Bills",
  description = "These bills will be referenced in your message"
}: SelectedBillsProps) {
  if (selectedBills.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-2">
        {title} ({selectedBills.length})
      </label>
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="space-y-3">
          {selectedBills.map((bill) => (
            <div
              key={bill.id}
              className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-primary" />
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
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveBill(bill.id)}
                className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                aria-label={`Remove ${bill.identifier}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700 dark:text-blue-300">
              {description}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAll}
              className="text-xs"
            >
              Clear All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
