
# StatePulse

**Empowering civic engagement through accessible state legislation tracking**

StatePulse is a comprehensive web application designed to encourage and facilitate citizen engagement with state-level politics across the United States. By aggregating legislation from all 50 U.S. states and making it accessible through AI-powered summaries and intuitive tools, StatePulse bridges the gap between complex legislative processes and everyday citizens.

## Mission

Our mission is to democratize access to state legislation information and empower citizens to actively participate in their state's political processes through informed engagement.

## Features

### **Comprehensive Legislation Database**
- **100,000+ Bills**: Aggregated legislation from all 50 U.S. states (2024 data)
- **Quick and Timely Updates**: Continuous tracking of legislative changes and new bills
- **Advanced Search**: Find legislation by keywords, sponsors, or bill numbers
- **Bill Linking**: Connect related bills and track legislative families

### **AI-Powered Understanding**
- **Multiple Summary Styles**:
  - Plain English explanations for everyday understanding
  - Legal-dense summaries for detailed analysis
  - Tweet-length summaries for quick insights
  - 100-word summaries for balanced detail
- **Gemini AI Integration**: High-quality, contextual bill summaries
- **Local LLM Support**: Privacy-focused AI processing options

### **Community Engagement**
- **Community Posts**: Share thoughts, analysis, and questions about legislation
- **Bill Discussions**: Link specific bills to community conversations
- **Bug Reports**: Help improve the platform through user feedback
- **Social Features**: Like, comment, and engage with other users' posts

### **Civic Tools**
- **Representative Finder**: Locate your state-level representatives
- **Message Generator**: AI-assisted tool to craft personalized messages to legislators
- **Contact Information**: Direct access to representative contact details
- **Civic Engagement Guidance**: Tools and resources for effective political participation

### **Personal Tracking & Organization**
- **Policy Tracking**: Subscribe to specific topics and receive updates
- **Bookmarking System**: Save and organize legislation you care about
- **Personalized Dashboard**: Customized view of your tracked policies and bookmarks
- **Activity Feed**: Stay updated on changes to your followed legislation

### **User Experience**
- **OAuth Authentication**: Secure account creation with Clerk integration
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Privacy-Focused**: Transparent data handling and user privacy protection
- **Accessible Interface**: Designed for users of all technical backgrounds

## Technology Stack

### **Frontend**
- **Next.js** with App Router
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **Lucide React** for icons

### **Backend & Database**
- **MongoDB** for data storage
- **Firebase** for additional services
- **Clerk** for authentication
- **Node.js** API routes

### **AI & Data Processing**
- **Google Gemini AI and Ollama Mistral** for bill summarization
- **Genkit** for AI workflow management
- **Custom rate limiting** for API compliance
- **PDF parsing** for bill text extraction

### **Data Sources**
- **OpenStates API** for legislation data
- **Custom web scrapers** for additional data sources
- **Government APIs** for representative information
- **User-generated content** for community engagement
- **Leaflet.js** for interactive maps

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- MongoDB instance
- Clerk account for authentication
- OpenStates API key
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/state-pulse.git
   cd state-pulse
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Configure the following variables:
   ```env
   # Authentication
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

   # Database
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB_NAME=statepulse-data

   # APIs
   OPENSTATES_API_KEY=your_openstates_api_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

[//]: # (### Data Setup)

[//]: # ()
[//]: # (To populate your database with legislation data:)

[//]: # ()
[//]: # (```bash)

[//]: # (# Fetch current legislation data)

[//]: # (npm run fetch-data)

[//]: # ()
[//]: # (# Fetch historical data &#40;optional&#41;)

[//]: # (npm run fetch-historical)

[//]: # (```)

## Project Structure

```
state-pulse/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── (main)/            # Main application routes
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── auth/              # Authentication components
│   │   ├── features/          # Feature-specific components
│   │   ├── theme/             # Theme components
│   │   └── ui/                # Reusable UI components
│   ├── ai/                    # AI workflows and integrations
│   │   └── flows/             # AI workflow definitions
│   ├── scripts/               # Data processing scripts
│   ├── services/              # Business logic services
│   ├── lib/                   # Utility libraries
│   ├── types/                 # TypeScript type definitions
│   ├── hooks/                 # Custom React hooks
│   └── data/                  # Static data files
├── dataconnect/               # Firebase Data Connect
│   ├── connector/             # Database connectors
│   └── schema/                # Database schema
├── dataconnect-generated/     # Generated Data Connect code
│   └── js/                    # JavaScript bindings
├── functions/                 # Firebase Cloud Functions
│   └── src/
│       └── lib/               # Function utilities
├── docs/                      # Documentation
├── public/                    # Static assets
└── state-pulse-codebase/      # Additional codebase
    └── src/
```

## Contributing

We welcome contributions from developers, civic enthusiasts, and anyone passionate about democratic engagement!

### Ways to Contribute

1. **Code Contributions**
   - Bug fixes and feature improvements
   - New AI summarization models
   - UI/UX enhancements
   - Performance optimizations

2. **Data Quality**
   - Report missing or incorrect legislation data
   - Improve bill categorization and tagging
   - Enhance representative information accuracy

3. **Community Building**
   - Share feedback and feature requests
   - Help test new features
   - Contribute to documentation

4. **Civic Engagement**
   - Create educational content
   - Share best practices for political engagement
   - Help onboard new users

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Data & Privacy

### Data Sources
- **OpenStates**: Primary source for legislation and representative data
- **Government APIs**: Official state and federal data sources
- **User-Generated Content**: Community posts and interactions (with consent)

### Privacy Commitment
- **Minimal Data Collection**: Only collect necessary information
- **Transparent Practices**: Clear privacy policy and data handling
- **User Control**: Users can delete their data at any time
- **Secure Processing**: All data encrypted in transit and at rest

## Acknowledgments

**Special thanks to the [OpenStates](https://openstates.org/) community** for providing an incredible API for aggregating legislation, representatives, and jurisdictions across all 50 states. Their custom web scrapers and dedication to government transparency make StatePulse possible.

Additional thanks to:
- MapLibre GL for extremely fast and highly performative map rendering.
- Fuse for fast and accurate fuzzy search.
- The open-source community for the amazing tools and libraries
- Beta testers and early users for valuable feedback
- Civic engagement organizations for guidance and support

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Website**: [statepulse.me](https://statepulse.me)
- **OpenStates**: [openstates.org](https://openstates.org/)
- **Report Issues**: [GitHub Issues](https://github.com/yourusername/state-pulse/issues)

## Contact

For questions, suggestions, or partnership opportunities:
- **Email**: contact@statepulse.me
- **GitHub**: [Open an issue](https://github.com/yourusername/state-pulse/issues)

---

**Built with civic engagement in mind**

*StatePulse - Empowering citizens through accessible government transparency*
