// Vision API Module
// Provides diagnostic file extraction using GPT-4o Vision

export { extractFromImage, extractFromMultipleImages, extractFrequencyNames } from './vision-client'
export { extractDiagnosticValues } from './extractors'

// Re-export prompts for customization
export { D_PULSE_SYSTEM_PROMPT, D_PULSE_USER_PROMPT } from './prompts/d-pulse-prompt'
export { UA_SYSTEM_PROMPT, UA_USER_PROMPT } from './prompts/ua-prompt'
export { VCS_SYSTEM_PROMPT, VCS_USER_PROMPT } from './prompts/vcs-prompt'
export { HRV_SYSTEM_PROMPT, HRV_USER_PROMPT } from './prompts/hrv-prompt'
export { BRAINWAVE_SYSTEM_PROMPT, BRAINWAVE_USER_PROMPT } from './prompts/brainwave-prompt'
