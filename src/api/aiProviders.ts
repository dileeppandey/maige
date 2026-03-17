import type { ImageAdjustments } from '../../shared/types'

const SYSTEM_PROMPT = `You are an expert photo editor AI. The user will describe how they want to edit the image.
Respond ONLY with a JSON object containing adjustment values.
Use this exact structure (all values range from -100 to 100, default 0):
{
  "light": { "exposure": 0, "contrast": 0, "highlights": 0, "shadows": 0, "whites": 0, "blacks": 0 },
  "color": { "temperature": 0, "tint": 0, "saturation": 0, "vibrance": 0 }
}
Only include fields that need to change from 0. Do not include explanation text, only the JSON.`

function parseAdjustments(text: string): Partial<ImageAdjustments> {
    try {
        // Extract JSON from the response text (handle potential surrounding text)
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return {}
        const parsed = JSON.parse(jsonMatch[0])
        return parsed as Partial<ImageAdjustments>
    } catch {
        return {}
    }
}

export async function callClaude(
    base64Image: string,
    instruction: string
): Promise<Partial<ImageAdjustments>> {
    try {
        const apiKey = await window.api.getAPIKey('anthropic')

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-opus-4-6',
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: base64Image,
                                },
                            },
                            {
                                type: 'text',
                                text: instruction,
                            },
                        ],
                    },
                ],
            }),
        })

        if (!response.ok) {
            console.error('Claude API error:', response.status, await response.text())
            return {}
        }

        const data = await response.json()
        const text = data?.content?.[0]?.text ?? ''
        return parseAdjustments(text)
    } catch (e) {
        console.error('callClaude error:', e)
        return {}
    }
}

export async function callGPT4Vision(
    base64Image: string,
    instruction: string
): Promise<Partial<ImageAdjustments>> {
    try {
        const apiKey = await window.api.getAPIKey('openai')

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_PROMPT,
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                },
                            },
                            {
                                type: 'text',
                                text: instruction,
                            },
                        ],
                    },
                ],
            }),
        })

        if (!response.ok) {
            console.error('GPT-4 Vision API error:', response.status, await response.text())
            return {}
        }

        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content ?? ''
        return parseAdjustments(text)
    } catch (e) {
        console.error('callGPT4Vision error:', e)
        return {}
    }
}

export async function callGemini(
    base64Image: string,
    instruction: string
): Promise<Partial<ImageAdjustments>> {
    try {
        const apiKey = await window.api.getAPIKey('google')

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: SYSTEM_PROMPT }],
                    },
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: 'image/jpeg',
                                        data: base64Image,
                                    },
                                },
                                {
                                    text: instruction,
                                },
                            ],
                        },
                    ],
                }),
            }
        )

        if (!response.ok) {
            console.error('Gemini API error:', response.status, await response.text())
            return {}
        }

        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        return parseAdjustments(text)
    } catch (e) {
        console.error('callGemini error:', e)
        return {}
    }
}
