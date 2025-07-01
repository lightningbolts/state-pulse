import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

interface GenerateMessageRequest {
  representative: {
    name: string;
    office: string;
    party: string;
  };
  messageType: string;
  topic: string;
  position: 'support' | 'oppose' | 'neutral';
  personalStory?: string;
  userInfo: {
    name: string;
    address: string;
  };
  selectedBill?: {
    id: string;
    identifier: string;
    title: string;
    abstract?: string;
    latest_action_description?: string;
    latest_action_date?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateMessageRequest = await request.json();

    const { representative, messageType, topic, position, personalStory, userInfo, selectedBill } = body;

    // Validate required fields
    if (!representative.name || !topic || !messageType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Determine representative title
    const repTitle = representative.office.toLowerCase().includes('senator') ? 'Senator' :
                    representative.office.toLowerCase().includes('representative') ? 'Representative' :
                    representative.office.toLowerCase().includes('governor') ? 'Governor' :
                    'Honorable';

    // Build the prompt for Gemini
    const prompt = buildPrompt({
      representative: { ...representative, title: repTitle },
      messageType,
      topic,
      position,
      personalStory,
      userInfo,
      selectedBill
    });

    // Generate the message using Gemini
    const generatedMessage = await ai.generate(prompt);

    return NextResponse.json({
      message: generatedMessage.text,
      success: true
    });

  } catch (error) {
    console.error('Error generating message:', error);
    return NextResponse.json(
      { error: 'Failed to generate message' },
      { status: 500 }
    );
  }
}

function buildPrompt({
  representative,
  messageType,
  topic,
  position,
  personalStory,
  userInfo,
  selectedBill
}: {
  representative: { name: string; office: string; party: string; title: string };
  messageType: string;
  topic: string;
  position: 'support' | 'oppose' | 'neutral';
  personalStory?: string;
  userInfo: { name: string; address: string };
  selectedBill?: {
    id: string;
    identifier: string;
    title: string;
    abstract?: string;
    latest_action_description?: string;
    latest_action_date?: string;
  };
}): string {

  let messageIntent = '';
  switch (messageType) {
    case 'support':
      messageIntent = 'expressing strong support for';
      break;
    case 'oppose':
      messageIntent = 'expressing opposition to';
      break;
    case 'question':
      messageIntent = 'asking questions about';
      break;
    case 'thank_you':
      messageIntent = 'thanking the representative for their work on';
      break;
    default:
      messageIntent = 'sharing thoughts about';
  }

  let positionGuidance = '';
  if (position === 'support') {
    positionGuidance = 'The constituent supports this issue and wants the representative to take action in favor of it.';
  } else if (position === 'oppose') {
    positionGuidance = 'The constituent opposes this issue and wants the representative to vote against or work against it.';
  } else {
    positionGuidance = 'The constituent has a neutral position and wants to learn more about the representative\'s stance.';
  }

  const personalStorySection = personalStory
    ? `\n\nPersonal Story Context: "${personalStory}"\nPlease incorporate this personal story naturally into the message to make it more compelling and authentic.`
    : '';

  const userInfoSection = userInfo.name && userInfo.address
    ? `\n\nConstituent Information:\nName: ${userInfo.name}\nAddress: ${userInfo.address}`
    : '';

  const billInfoSection = selectedBill && selectedBill.title
    ? `\n\nBill Information:\nTitle: ${selectedBill.title}\nIdentifier: ${selectedBill.identifier}\nAbstract: ${selectedBill.abstract || 'N/A'}\nLatest Action: ${selectedBill.latest_action_description || 'N/A'} on ${selectedBill.latest_action_date || 'N/A'}`
    : '';

  return `You are helping a constituent write a professional, respectful, and effective message to their elected representative. 

Representative Information:
- Name: ${representative.title} ${representative.name}
- Office: ${representative.office}
- Party: ${representative.party}

Message Details:
- Purpose: ${messageIntent} "${topic}"
- Position: ${positionGuidance}${personalStorySection}${userInfoSection}${billInfoSection}

Requirements:
1. Write a formal, respectful letter appropriate for contacting an elected official
2. Use proper salutation (${representative.title} ${representative.name})
3. Clearly state the constituent's position on the topic
4. Include specific, actionable requests where appropriate
5. Maintain a professional but personal tone
6. Keep the message concise but substantive (200-400 words)
7. Include a proper closing with the constituent's information
8. If a personal story is provided, weave it naturally into the message
9. Make the message specific to the representative's role and party affiliation when relevant
10. Avoid overly political language and focus on the issue's impact on constituents

Please generate a complete, professional message that the constituent can send directly to their representative.`;
}
