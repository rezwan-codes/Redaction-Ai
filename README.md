Live : https://redactionai.netlify.app/

RedactAI - Intelligent Cybersecurity Redaction System
Live Demo License React Gemini API

RedactAI is a high-performance privacy protection engine built for the Cybersecurity Hackathon. It employs a hybrid architecture, orchestrating Google Gemini for semantic entity recognition and optimized Regex patterns for structured data validation. This ensures maximum recall and precision when redacting sensitive information from unstructured text streams.

redact-ai/
├── src/
│   ├── components/       # UI Components (atomic design)
│   │   ├── AccuracyMetric.tsx  # Levenshtein visualization
│   │   ├── EntityTable.tsx     # Data grid for entities
│   │   └── RedactionPanel.tsx  # Main business logic container
│   ├── services/
│   │   └── geminiService.ts    # AI API abstraction layer
│   ├── utils/
│   │   └── textUtils.ts        # Core algo (LCS, Regex, Normalization)
│   ├── types.ts          # TypeScript interfaces & Enums
│   ├── App.tsx           # Root component
│   └── index.tsx         # Entry point
├── public/
├── README.md
└── package.json
