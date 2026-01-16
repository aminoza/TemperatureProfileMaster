import { GoogleGenAI, Type } from "@google/genai";
import { DataPoint } from "../types";

// Helper to get AI instance safely
const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please select a valid Gemini API Key.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateProfileWithAI = async (description: string): Promise<{ name: string; description: string; points: DataPoint[] }> => {
  const ai = getAI();
  const prompt = `Create a realistic temperature profile for the following process: "${description}". 
  The profile should consist of a series of time (in seconds) and temperature (in Celsius) points. 
  Ensure the profile follows logical physics for heating/cooling.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "A short, descriptive name for the profile" },
          description: { type: Type.STRING, description: "A detailed technical description of the profile stages" },
          points: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.NUMBER, description: "Time in seconds (cumulative)" },
                temperature: { type: Type.NUMBER, description: "Temperature in Celsius" }
              },
              required: ["time", "temperature"]
            }
          }
        },
        required: ["name", "description", "points"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text);
};

export const analyzeProfileWithAI = async (points: DataPoint[]): Promise<{ summary: string; recommendations: string[] }> => {
  const ai = getAI();
  const prompt = `Analyze the following temperature profile data points (Time [s], Temp [C]): 
  ${JSON.stringify(points)}. 
  Provide a technical summary and operational recommendations (e.g., peak temp checks, ramp rates).`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Technical summary of the profile characteristics" },
          recommendations: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "List of actionable recommendations or warnings" 
          }
        },
        required: ["summary", "recommendations"]
      }
    }
  });

   const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text);
};
