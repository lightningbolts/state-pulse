"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Copy, Send, User, Building, AlertCircle, CheckCircle, Wand2, Search, FileText, X } from "lucide-react";

interface Representative {
  id: string;
  name: string;
  office: string;
  party: string;
  email?: string;
  phone?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'support' | 'oppose' | 'question' | 'thank_you' | 'general';
}

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

interface MessageGeneratorProps {
  representatives?: Representative[];
  userLocation?: {
    state?: string;
    city?: string;
  };
  onClose?: () => void;
}

export function MessageGenerator({ representatives = [], userLocation, onClose }: MessageGeneratorProps) {
  const [selectedRep, setSelectedRep] = useState<Representative | null>(null);
  const [messageType, setMessageType] = useState<string>('general');
  const [topic, setTopic] = useState('');
  const [position, setPosition] = useState<'support' | 'oppose' | 'neutral'>('neutral');
  const [personalStory, setPersonalStory] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [userInfo, setUserInfo] = useState({
    name: '',
    address: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bill search state
  const [billSearchQuery, setBillSearchQuery] = useState('');
  const [billSearchResults, setBillSearchResults] = useState<Bill[]>([]);
  const [selectedBills, setSelectedBills] = useState<Bill[]>([]);
  const [billSearchLoading, setBillSearchLoading] = useState(false);
  const [showBillSearch, setShowBillSearch] = useState(false);

  const messageTemplates: MessageTemplate[] = [
    {
      id: 'support',
      name: 'Support a Bill/Issue',
      subject: 'Support for [TOPIC]',
      body: `Dear [REPRESENTATIVE_TITLE] [REPRESENTATIVE_NAME],

I am writing as your constituent to express my strong support for [TOPIC].

[PERSONAL_STORY]

This issue is important to me because [REASON].

I urge you to support this legislation and would appreciate your continued advocacy on this matter.

Thank you for your time and consideration.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
      category: 'support'
    },
    {
      id: 'oppose',
      name: 'Oppose a Bill/Issue',
      subject: 'Opposition to [TOPIC]',
      body: `Dear [REPRESENTATIVE_TITLE] [REPRESENTATIVE_NAME],

I am writing as your constituent to express my opposition to [TOPIC].

[PERSONAL_STORY]

I have concerns about this legislation because [REASON].

I urge you to vote against this measure and would appreciate your consideration of my concerns.

Thank you for your time and attention to this matter.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
      category: 'oppose'
    },
    {
      id: 'question',
      name: 'Ask a Question',
      subject: 'Question about [TOPIC]',
      body: `Dear [REPRESENTATIVE_TITLE] [REPRESENTATIVE_NAME],

I am writing as your constituent to ask about your position on [TOPIC].

[PERSONAL_STORY]

I would appreciate learning more about your stance on this issue and how you plan to address it.

Could you please share your thoughts and any planned actions regarding this matter?

Thank you for your time and service to our community.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
      category: 'question'
    },
    {
      id: 'thank_you',
      name: 'Thank You Message',
      subject: 'Thank you for your support of [TOPIC]',
      body: `Dear [REPRESENTATIVE_TITLE] [REPRESENTATIVE_NAME],

I am writing to thank you for your support of [TOPIC].

[PERSONAL_STORY]

Your leadership on this issue means a great deal to me and our community.

I appreciate your continued commitment to representing our interests and values.

Thank you for your dedicated service.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
      category: 'thank_you'
    },
    {
      id: 'general',
      name: 'General Message',
      subject: 'Regarding [TOPIC]',
      body: `Dear [REPRESENTATIVE_TITLE] [REPRESENTATIVE_NAME],

I am writing as your constituent to share my thoughts on [TOPIC].

[PERSONAL_STORY]

I hope you will consider my perspective on this important issue.

Thank you for your time and for representing our community.

Sincerely,
[YOUR_NAME]
[YOUR_ADDRESS]`,
      category: 'general'
    }
  ];

  const generateMessage = async () => {
    if (!selectedRep || !topic.trim()) return;

    setLoading(true);
    try {
      // Use Gemini AI to generate the message
      const response = await fetch('/api/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          representative: {
            name: selectedRep.name,
            office: selectedRep.office,
            party: selectedRep.party
          },
          messageType,
          topic,
          position,
          personalStory: personalStory.trim(),
          userInfo: {
            name: userInfo.name.trim(),
            address: userInfo.address.trim()
          },
          selectedBill: selectedBills.length > 0 ? selectedBills.map(bill => ({
            id: bill.id,
            identifier: bill.identifier,
            title: bill.title,
            abstract: bill.abstract,
            latest_action_description: bill.latest_action_description,
            latest_action_date: bill.latest_action_date
          })) : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate message with AI');
      }

      const data = await response.json();
      setGeneratedMessage(data.message);

    } catch (error) {
      console.error('Error generating message with AI:', error);

      // Fallback to template-based generation
      const template = messageTemplates.find(t => t.id === messageType) || messageTemplates[0];

      // Get representative title
      const repTitle = selectedRep.office.toLowerCase().includes('senator') ? 'Senator' :
                      selectedRep.office.toLowerCase().includes('representative') ? 'Representative' :
                      selectedRep.office.toLowerCase().includes('governor') ? 'Governor' :
                      'Honorable';

      // Generate message by replacing placeholders
      let message = template.body
        .replace(/\[REPRESENTATIVE_TITLE\]/g, repTitle)
        .replace(/\[REPRESENTATIVE_NAME\]/g, selectedRep.name)
        .replace(/\[TOPIC\]/g, topic)
        .replace(/\[YOUR_NAME\]/g, userInfo.name || '[Your Name]')
        .replace(/\[YOUR_ADDRESS\]/g, userInfo.address || '[Your Address]');

      // Add bill information if selected
      if (selectedBills.length > 0) {
        const billInfo = selectedBills.map(bill => `${bill.identifier}: "${bill.title}". ${bill.abstract ? `This bill ${bill.abstract.toLowerCase()}` : ''}`).join(' ');
        message = `${message.split('\n\n')[0]}\n\nI am specifically writing regarding the following bills: ${billInfo}\n\n${message.split('\n\n').slice(1).join('\n\n')}`;
      }

      // Add personal story if provided
      if (personalStory.trim()) {
        message = message.replace(/\[PERSONAL_STORY\]/g, personalStory);
      } else {
        message = message.replace(/\[PERSONAL_STORY\]\n\n/g, '');
      }

      // Add reason based on position
      let reason = '';
      if (position === 'support') {
        reason = 'it will benefit our community and align with my values';
      } else if (position === 'oppose') {
        reason = 'I believe it may have negative consequences for our community';
      } else {
        reason = 'I want to ensure the best outcome for our community';
      }
      message = message.replace(/\[REASON\]/g, reason);

      setGeneratedMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async () => {
    if (!generatedMessage) return;

    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const sendEmail = () => {
    if (!selectedRep?.email || !generatedMessage) return;

    const template = messageTemplates.find(t => t.id === messageType) || messageTemplates[0];
    const subject = template.subject.replace(/\[TOPIC\]/g, topic);

    const mailtoLink = `mailto:${selectedRep.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(generatedMessage)}`;
    window.open(mailtoLink);
  };

  // Bill search functions
  const searchBills = async () => {
    if (!billSearchQuery.trim()) return;

    setBillSearchLoading(true);
    try {
      const response = await fetch('/api/search-bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: billSearchQuery.trim(),
          userLocation
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Search bills API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(`Failed to search bills: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
      }

      const data = await response.json();
      console.log('Bill search results:', data);
      setBillSearchResults(data.bills || []);

    } catch (error) {
      console.error('Error searching bills:', error);
      // Show user-friendly error message
      setBillSearchResults([]);
    } finally {
      setBillSearchLoading(false);
    }
  };

  const selectBill = (bill: Bill) => {
    setSelectedBills(prevSelected => {
      if (prevSelected.find(b => b.id === bill.id)) {
        // Bill already selected, remove it
        return prevSelected.filter(b => b.id !== bill.id);
      } else {
        // Bill not selected, add it
        return [...prevSelected, bill];
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Generate Message to Legislator</CardTitle>
              <CardDescription>
                Create personalized messages to contact your representatives
              </CardDescription>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Representative Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Select Representative (You must type your general location in the search bar first for results to show.)</label>
          <select
            value={selectedRep?.id || ''}
            onChange={(e) => {
              const rep = representatives.find(r => r.id === e.target.value);
              setSelectedRep(rep || null);
            }}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
          >
            <option value="">Choose a representative...</option>
            {representatives.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.name} - {rep.office}
              </option>
            ))}
          </select>

          {selectedRep && (
            <div className="mt-2 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedRep.name}</span>
                <Badge variant="outline">{selectedRep.party}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                {selectedRep.office}
              </div>
              {selectedRep.email && (
                <div className="text-sm text-muted-foreground mt-1">
                  Email: {selectedRep.email}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Type Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">Message Type</label>
          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background"
          >
            {messageTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {/* Topic Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Topic/Issue</label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., Education funding, Healthcare reform, Infrastructure..."
            className="w-full"
          />
        </div>

        {/* Position Selection */}
        {(messageType === 'support' || messageType === 'oppose' || messageType === 'general') && (
          <div>
            <label className="block text-sm font-medium mb-2">Your Position</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="support"
                  checked={position === 'support'}
                  onChange={(e) => setPosition(e.target.value as 'support' | 'oppose' | 'neutral')}
                  className="mr-2"
                />
                Support
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="oppose"
                  checked={position === 'oppose'}
                  onChange={(e) => setPosition(e.target.value as 'support' | 'oppose' | 'neutral')}
                  className="mr-2"
                />
                Oppose
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="neutral"
                  checked={position === 'neutral'}
                  onChange={(e) => setPosition(e.target.value as 'support' | 'oppose' | 'neutral')}
                  className="mr-2"
                />
                Neutral/Question
              </label>
            </div>
          </div>
        )}

        {/* Personal Story */}
        <div>
          <label className="block text-sm font-medium mb-2">Personal Story (Optional)</label>
          <Textarea
            value={personalStory}
            onChange={(e) => setPersonalStory(e.target.value)}
            placeholder="Share how this issue affects you personally..."
            rows={3}
            className="w-full"
          />
        </div>

        {/* User Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Name</label>
            <Input
              value={userInfo.name}
              onChange={(e) => setUserInfo({...userInfo, name: e.target.value})}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Your Address</label>
            <Input
              value={userInfo.address}
              onChange={(e) => setUserInfo({...userInfo, address: e.target.value})}
              placeholder="City, State, ZIP"
            />
          </div>
        </div>

        {/* Selected Bills Box - Outside of search section */}
        {selectedBills.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2">Selected Bills ({selectedBills.length})</label>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="space-y-3">
                {selectedBills.map((bill) => (
                  <div key={bill.id} className="flex items-start justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{bill.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {bill.identifier} - {bill.latest_action_date}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bill.abstract}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBills(prev => prev.filter(b => b.id !== bill.id))}
                      className="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-300">
                    These bills will be referenced in your message
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBills([])}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bill Search */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Search for Related Bills</label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBillSearch(!showBillSearch)}
              className="flex items-center gap-2"
            >
              {showBillSearch ? 'Hide' : 'Show'} Bill Search
            </Button>
          </div>

          {showBillSearch && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex gap-2 mb-4">
                <Input
                  value={billSearchQuery}
                  onChange={(e) => setBillSearchQuery(e.target.value)}
                  placeholder="Enter bill number or keywords..."
                  className="flex-1"
                />
                <Button
                  onClick={searchBills}
                  disabled={billSearchLoading}
                  className="whitespace-nowrap"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search Bills
                </Button>
              </div>

              {billSearchResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Bill Search Results (Click to add/remove)</h4>
                  <div className="space-y-2">
                    {billSearchResults.map((bill) => {
                      const isSelected = selectedBills.find(b => b.id === bill.id);
                      return (
                        <div
                          key={bill.id}
                          onClick={() => selectBill(bill)}
                          className={`p-3 rounded-lg border cursor-pointer transition ${
                            isSelected 
                              ? 'bg-primary/10 border-primary ring-1 ring-primary' 
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">{bill.title}</div>
                                {isSelected && (
                                  <Badge variant="secondary" className="text-xs">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {bill.identifier} - {bill.latest_action_date}
                              </div>
                            </div>
                            <FileText className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {bill.abstract}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {billSearchResults.length === 0 && billSearchQuery && !billSearchLoading && (
                <div className="text-sm text-muted-foreground py-2">
                  No bills found for your search query. Please try different keywords or check back later.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generate Button */}
        <Button
          onClick={generateMessage}
          disabled={!selectedRep || !topic.trim() || loading}
          className="w-full"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Wand2 className="h-4 w-4 mr-2" />
          )}
          Generate Message
        </Button>

        {/* Generated Message */}
        {generatedMessage && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Generated Message</label>
              <Textarea
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                rows={12}
                className="w-full font-mono text-sm"
                placeholder="Your generated message will appear here..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={copyMessage}
                variant="outline"
                className="flex-1"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy Message'}
              </Button>

              {selectedRep?.email && (
                <Button
                  onClick={sendEmail}
                  className="flex-1"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
              )}
            </div>

            {!selectedRep?.email && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  Email address not available for this representative. You can copy the message and send it through other channels.
                </span>
              </div>
            )}
          </div>
        )}

        {representatives.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No Representatives Found
            </h3>
            <p className="text-sm text-muted-foreground">
              Please search for your representatives first to generate messages.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
