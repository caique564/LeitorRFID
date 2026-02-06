
import { GoogleGenAI, Type } from "@google/genai";

const HYBRID_SCANNER_PROMPT = `
Você é um especialista em etiquetas RFID e ativos industriais.
Você receberá uma imagem de uma etiqueta RFID (que possui um circuito de antena visível).
Sua missão é:
1. Identificar qualquer número de série, ID ou código impresso na etiqueta.
2. Identificar o tipo de antena (UHF longa, HF espiral, NFC).
3. Se houver um QR Code ou Código de Barras junto à antena, leia-o.
4. Se o texto estiver borrado, use lógica industrial para completar (ex: códigos REIS costumam seguir o padrão REIS-XXXX).

FORMATO: JSON.
`;

export const analyzeTagVisually = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Analise esta etiqueta RFID. Extraia o ID visual e o estado do ativo." },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: HYBRID_SCANNER_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "ID identificado visualmente" },
            tagType: { type: Type.STRING, description: "Tipo de tag RFID identificada" },
            confidence: { type: Type.NUMBER },
            visualData: { type: Type.STRING, description: "Resumo do que foi visto na etiqueta" }
          },
          required: ["id", "tagType"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Erro na análise visual:", error);
    throw error;
  }
};
