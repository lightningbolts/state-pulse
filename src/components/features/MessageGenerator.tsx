"use client";

import {useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {AlertCircle, Building, CheckCircle, Copy, MessageSquare, Send, User, Wand2} from "lucide-react";
import {BillSearch} from "./BillSearch";
import {SelectedBills} from "./SelectedBills";
import {Representative} from "@/types/representative";
import {Bill} from "@/types/legislation";

interface MessageTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    category: 'support' | 'oppose' | 'question' | 'thank_you' | 'general';
}

interface MessageGeneratorProps {
    representatives?: Representative[];
    userLocation?: {
        state?: string;
        city?: string;
    };
    onClose?: () => void;
}

export function MessageGenerator({representatives = [], userLocation, onClose}: MessageGeneratorProps) {
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

    // Bill search state - simplified to only track selected bills
    const [selectedBills, setSelectedBills] = useState<Bill[]>([]);
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

    const handleBillSelect = (bill: Bill) => {
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
                        <MessageSquare className="h-6 w-6 text-primary"/>
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
                    <label className="block text-sm font-medium mb-2">Select Representative (You must type your general
                        location in the search bar first for results to show.)</label>
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

                    <AnimatePresence>
                        {selectedRep && (
                            <motion.div
                                className="mt-2 p-3 bg-muted rounded-lg overflow-hidden"
                                initial={{opacity: 0, height: 0, marginTop: 0}}
                                animate={{opacity: 1, height: "auto", marginTop: "0.5rem"}}
                                exit={{opacity: 0, height: 0, marginTop: 0}}
                                transition={{duration: 0.3, ease: "easeInOut"}}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <User className="h-4 w-4"/>
                                    <span className="font-medium">{selectedRep.name}</span>
                                    <Badge variant="outline">{selectedRep.party}</Badge>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Building className="h-4 w-4"/>
                                    {selectedRep.office}
                                </div>
                                {selectedRep.email && (
                                    <div className="text-sm text-muted-foreground mt-1">
                                        Email: {selectedRep.email}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                <AnimatePresence mode="wait">
                    {(messageType === 'support' || messageType === 'oppose' || messageType === 'general') && (
                        <motion.div
                            key="position-selection"
                            initial={{opacity: 0, height: 0}}
                            animate={{opacity: 1, height: "auto"}}
                            exit={{opacity: 0, height: 0}}
                            transition={{duration: 0.3, ease: "easeInOut"}}
                            className="overflow-hidden"
                        >
                            <div className="pt-2">
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
                        </motion.div>
                    )}
                </AnimatePresence>

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

                {/* Selected Bills Box - Now using modular component */}
                <SelectedBills
                    selectedBills={selectedBills}
                    onRemoveBill={(billId) => setSelectedBills(prev => prev.filter(b => b.id !== billId))}
                    onClearAll={() => setSelectedBills([])}
                />

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

                    <AnimatePresence>
                        {showBillSearch && (
                            <motion.div
                                className="p-4 bg-muted rounded-lg overflow-hidden"
                                initial={{opacity: 0, height: 0}}
                                animate={{opacity: 1, height: "auto"}}
                                exit={{opacity: 0, height: 0}}
                                transition={{duration: 0.4, ease: "easeInOut"}}
                            >
                                <BillSearch
                                    selectedBills={selectedBills}
                                    onBillSelect={handleBillSelect}
                                    userLocation={userLocation}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                        <Wand2 className="h-4 w-4 mr-2"/>
                    )}
                    Generate Message
                </Button>

                {/* Generated Message */}
                <AnimatePresence>
                    {generatedMessage && (
                        <motion.div
                            className="space-y-4"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0}}
                            exit={{opacity: 0, y: -20}}
                            transition={{duration: 0.5, ease: "easeInOut"}}
                        >
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
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600"/>
                                    ) : (
                                        <Copy className="h-4 w-4 mr-2"/>
                                    )}
                                    {copied ? 'Copied!' : 'Copy Message'}
                                </Button>

                                {selectedRep?.email && (
                                    <Button
                                        onClick={sendEmail}
                                        className="flex-1"
                                    >
                                        <Send className="h-4 w-4 mr-2"/>
                                        Send Email
                                    </Button>
                                )}
                            </div>

                            {!selectedRep?.email && (
                                <div
                                    className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <AlertCircle className="h-4 w-4 text-amber-600"/>
                                    <span className="text-sm text-amber-800">
                    Email address not available for this representative. You can copy the message and send it through other channels.
                  </span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {representatives.length === 0 && (
                        <motion.div
                            className="text-center py-8"
                            initial={{opacity: 0, y: 20}}
                            animate={{opacity: 1, y: 0, transition: {delay: 0.2}}}
                        >
                            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                            <h3 className="text-lg font-medium text-muted-foreground mb-2">
                                No Representatives Found
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Please search for your representatives first to generate messages.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
