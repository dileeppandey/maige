import type { ImageAdjustments } from '../../shared/types'
import { callClaude, callGPT4Vision, callGemini } from '../api/aiProviders'

export async function getEditSuggestions(
    filePath: string,
    instruction: string,
    provider: 'claude' | 'gpt4vision' | 'gemini'
): Promise<Partial<ImageAdjustments>> {
    // Read image as base64 via window.api.readImageAsBase64
    const base64 = await window.api.readImageAsBase64(filePath)

    let result: Partial<ImageAdjustments>
    if (provider === 'claude') result = await callClaude(base64, instruction)
    else if (provider === 'gpt4vision') result = await callGPT4Vision(base64, instruction)
    else result = await callGemini(base64, instruction)

    return result
}

export async function batchEdit(
    filePath: string,
    instruction: string,
    _operations: Record<string, boolean>,
    provider: 'claude' | 'gpt4vision' | 'gemini'
): Promise<Partial<ImageAdjustments>> {
    return getEditSuggestions(filePath, instruction, provider)
}
