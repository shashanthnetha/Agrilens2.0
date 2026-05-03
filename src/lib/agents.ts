import { GoogleGenAI, Type } from "@google/genai";
import diseaseData from "../data/diseases.json";
import Fuse from "fuse.js";

const getAi = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing. In Google AI Studio, this is injected automatically.");
    }
    return new GoogleGenAI({ apiKey: key });
};

export type AnalysisResult = {
    disease_detected: boolean;
    issue_type: "Disease" | "Pest" | "Healthy";
    disease_name: string;
    crop_type: string;
    confidence: number;
    affected_area_percent: number;
    visible_symptoms: string[];
    urgency: "Low" | "Medium" | "High" | "Critical";
    lifecycle?: string;
    geography?: string;
    history?: string;
};

export type TreatmentPlan = {
    immediate_action: string;
    organic_remedy: { method: string, materials: string[], frequency: string };
    chemical_remedy: { product_name: string, dosage: string, frequency: string };
    prevention: string[];
    crop_rotation: string[];
    recovery_timeline: string;
};

export type MarketSupplier = {
    title: string;
    snippet: string;
    link: string;
};

/**
 * 1. Vision Agent: Analyses the image and identifies the disease.
 */
export async function analyseCropImage(base64Image: string, language: string = "English", temperature: number = 0.7): Promise<AnalysisResult> {
    const ai = getAi();
    
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

    const imagePart = {
        inlineData: {
            mimeType,
            data: base64Data,
        },
    };

    const textPart = {
        text: `You are an expert agricultural plant pathologist and entomologist.
Analyse this crop leaf image carefully and identify any diseases or pests, confidence level, crop type, and urgency.
Also provide detailed information on the lifecycle, endemic geography, and historical outbreak data for the identified root cause.
IMPORTANT: Please translate the values for 'disease_name', 'crop_type', 'visible_symptoms', 'lifecycle', 'geography', and 'history' into ${language}.`
    };

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: { parts: [imagePart, textPart] },
        config: {
            temperature: temperature,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    disease_detected: { type: Type.BOOLEAN, description: "True if an issue (disease or pest) is detected, false otherwise" },
                    issue_type: { type: Type.STRING, description: "'Disease', 'Pest', or 'Healthy'" },
                    disease_name: { type: Type.STRING, description: "Exact disease/pest name or 'Healthy'" },
                    crop_type: { type: Type.STRING, description: "Detected crop name" },
                    confidence: { type: Type.INTEGER, description: "0-100 as integer" },
                    affected_area_percent: { type: Type.INTEGER, description: "0-100 as integer" },
                    visible_symptoms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of visible symptoms" },
                    urgency: { type: Type.STRING, description: "Low, Medium, High, or Critical" },
                    lifecycle: { type: Type.STRING, description: "Lifecycle of the pathogen or pest" },
                    geography: { type: Type.STRING, description: "Endemic regions" },
                    history: { type: Type.STRING, description: "Historical outbreak data" }
                },
                required: ["disease_detected", "issue_type", "disease_name", "crop_type", "confidence", "affected_area_percent", "visible_symptoms", "urgency", "lifecycle", "geography", "history"]
            }
        }
    });

    if (!response.text) {
        throw new Error("No response from Vision Agent");
    }

    return JSON.parse(response.text) as AnalysisResult;
}

/**
 * 2. RAG Knowledge Agent: Retrieves disease knowledge from JSON database.
 */
function queryDiseaseKnowledge(diseaseName: string, cropType: string): string {
    const fuse = new Fuse(diseaseData, {
        keys: ['disease', 'crop', 'symptoms'],
        threshold: 0.4
    });

    const query = `${cropType} ${diseaseName}`;
    const results = fuse.search(query);

    if (results.length > 0) {
        return results.slice(0, 3).map(r => JSON.stringify(r.item)).join("\n");
    }

    return "No specific database knowledge found for this disease. Rely on general agricultural knowledge.";
}

/**
 * 3. Advisory Agent: Generates a treatment plan.
 */
export async function generateTreatmentPlan(analysis: AnalysisResult, language: string = "English", temperature: number = 0.7): Promise<TreatmentPlan> {
    const ai = getAi();
    
    // Get RAG Context
    const kbContext = queryDiseaseKnowledge(analysis.disease_name, analysis.crop_type);
    
    const info = JSON.stringify(analysis);

    const prompt = `You are an expert agricultural advisor.
Given this disease information:
${info}

Knowledge Base Context:
${kbContext}

Create a practical treatment plan based on the disease information and the provided knowledge base context.
CRITICAL: Please translate all text values in your JSON response into the ${language} language.`;

    const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
            temperature: temperature,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    immediate_action: { type: Type.STRING, description: "What to do TODAY" },
                    organic_remedy: { 
                        type: Type.OBJECT,
                        properties: {
                            method: { type: Type.STRING },
                            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
                            frequency: { type: Type.STRING }
                        },
                        required: ["method", "materials", "frequency"]
                    },
                    chemical_remedy: {
                        type: Type.OBJECT,
                        properties: {
                            product_name: { type: Type.STRING },
                            dosage: { type: Type.STRING },
                            frequency: { type: Type.STRING }
                        },
                        required: ["product_name", "dosage", "frequency"]
                    },
                    prevention: { type: Type.ARRAY, items: { type: Type.STRING } },
                    crop_rotation: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Crop rotation recommendations" },
                    recovery_timeline: { type: Type.STRING, description: "Expected days to see improvement" }
                },
                required: ["immediate_action", "organic_remedy", "chemical_remedy", "prevention", "crop_rotation", "recovery_timeline"]
            }
        }
    });

    if (!response.text) return {} as TreatmentPlan;
    return JSON.parse(response.text) as TreatmentPlan;
}

/**
 * 4. Market Agent: Finds suppliers using Google Search grounding.
 */
export async function findNearbySuppliers(chemicalName: string, location: string = "India", language: string = "English"): Promise<MarketSupplier[]> {
    const ai = getAi();
    const prompt = `Find places to buy the agricultural chemical "${chemicalName}" near ${location}. Please return a JSON list of the top 3 suppliers or stores. Translate the 'title' and 'snippet' fields to ${language}.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Name of the supplier or store" },
                            snippet: { type: Type.STRING, description: "Short description" },
                            link: { type: Type.STRING, description: "URL" }
                        },
                        required: ["title", "snippet", "link"]
                    }
                }
            }
        });
        
        if (!response.text) return [];
        return JSON.parse(response.text) as MarketSupplier[];
    } catch(err) {
        console.error("Error finding suppliers", err);
        return [];
    }
}

// Helper: Convert PCM to WAV so it can drop natively into <audio>
function pcmToWav(pcmData: Int16Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(offset, pcmData[i], true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * 5. Voice Agent: TTS for generating voice report.
 */
export async function generateVoiceReport(analysis: AnalysisResult, treatment: TreatmentPlan, language: string = "English"): Promise<string | null> {
    const ai = getAi();
    const script = `Crop detected: ${analysis.crop_type}. Disease identified: ${analysis.disease_name}. Urgency level: ${analysis.urgency}. Immediate action required: ${treatment.immediate_action}. Expected recovery timeline: ${treatment.recovery_timeline}.`;

    const prompt = `You are an expert TTS system.
Translate the following text to ${language} and speak it clearly:
"${script}"`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const binary = window.atob(base64Audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const int16View = new Int16Array(bytes.buffer);
            // 24kHz is the typical sample rate for Gemini TTS output
            const wavBlob = pcmToWav(int16View, 24000);
            
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(wavBlob);
            });
        }
        return null;
    } catch(err) {
        console.error("Failed to generate TTS", err);
        return null;
    }
}
