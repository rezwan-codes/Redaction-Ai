
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DetectedEntity, EntityType } from "../types";

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error("API_KEY is not set in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-build' });

const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    entities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "The exact substring found in the text." },
          type: { 
            type: Type.STRING, 
            enum: Object.values(EntityType),
            description: "The category of the sensitive entity."
          }
        },
        required: ["text", "type"]
      }
    }
  },
  required: ["entities"]
};

/**
 * Extracts entities using Gemini.
 * @param text The input text
 * @param highAccuracy If true, uses a stronger model (Gemini Pro)
 */
export const extractEntities = async (text: string, highAccuracy: boolean = false): Promise<DetectedEntity[]> => {
  if (!text || !text.trim()) return [];

  // gemini-2.5-flash is optimized for speed and is the default.
  const modelName = highAccuracy ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Extract sensitive entities (PERSON, LOCATION, EMAIL_ADDRESS, IP_ADDRESS, PHONE_NUMBER, CREDIT_CARD, URL) from the text below. Return ONLY the JSON object.
      
      Text:
      """
      ${text}
      """`,
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema,
        // Short system instruction for speed
        systemInstruction: "You are a fast privacy detection engine.", 
        temperature: highAccuracy ? 0.0 : 0.1,
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    const data = JSON.parse(jsonText);
    return data.entities || [];

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    // Return empty array instead of throwing to allow partial regex results to persist
    return []; 
  }
};
