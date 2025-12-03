import { Request, Response, NextFunction } from 'express';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

interface GenerateRequest {
  type: 'title' | 'shortDescription' | 'description' | 'tags' | 'all';
  context: {
    fileName?: string;
    category?: string;
    existingTitle?: string;
    existingDescription?: string;
  };
}

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.message || 'Gemini API error');
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export const generateProductContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'AI service not configured' });
    }

    const { type, context } = req.body as GenerateRequest;
    const { fileName, category, existingTitle, existingDescription } = context || {};

    const productName = existingTitle || fileName?.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Digital Product';
    const categoryName = category || 'Digital Products';

    let result: any = {};

    if (type === 'title' || type === 'all') {
      const prompt = `Generate a compelling, SEO-optimized product title for a digital product.
Context: File name is "${fileName || 'unknown'}", category is "${categoryName}".
Requirements:
- Make it catchy and professional
- Include relevant keywords for SEO
- Keep it under 80 characters
- Don't use quotes in the response
Just return the title, nothing else.`;
      
      result.title = (await callGemini(prompt)).trim().replace(/^["']|["']$/g, '');
    }

    if (type === 'shortDescription' || type === 'all') {
      const prompt = `Write a compelling, SEO-optimized short description for: "${productName}"
Category: ${categoryName}
Requirements:
- Exactly 150-160 characters (this is for meta description)
- Include main benefit/value proposition
- Use action words
- Don't use quotes
Just return the short description, nothing else.`;
      
      result.shortDescription = (await callGemini(prompt)).trim().replace(/^["']|["']$/g, '');
    }

    if (type === 'description' || type === 'all') {
      const prompt = `Write a detailed, SEO-optimized product description for: "${productName}"
Category: ${categoryName}
${existingDescription ? `Current description to improve: ${existingDescription}` : ''}

Requirements:
- 150-300 words
- Start with a compelling hook
- List key benefits (use bullet points with •)
- Include a call to action
- Use keywords naturally for SEO
- Make it persuasive but not pushy
- Format with short paragraphs for readability

Just return the description, no additional commentary.`;
      
      result.description = (await callGemini(prompt)).trim();
    }

    if (type === 'tags' || type === 'all') {
      const prompt = `Generate 5-8 relevant SEO tags for: "${productName}"
Category: ${categoryName}
${existingDescription ? `Description: ${existingDescription.substring(0, 200)}` : ''}

Requirements:
- Each tag should be 1-3 words
- Include category-related terms
- Include benefit-related terms
- Make them searchable keywords
- Return as comma-separated list

Just return the tags as comma-separated values, nothing else.`;
      
      const tagsText = await callGemini(prompt);
      result.tags = tagsText.split(',').map((t: string) => t.trim().toLowerCase()).filter((t: string) => t.length > 0);
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('AI generation error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI generation failed' });
  }
};

