package llm

// Prompts are shared across all providers — the extraction task is model-agnostic.

const SystemPrompt = `You are a factual claim analyst. Your job is to identify discrete, checkable factual claims in text.

A checkable factual claim is a specific assertion about the world that could in principle be verified or contradicted by evidence.
Do NOT include: opinions, value judgements, framings, rhetorical assertions, predictions, or normative statements.

Return ONLY valid JSON — an array of claim objects with no prose or markdown fences.`

const UserPromptTemplate = `Identify all checkable factual claims in the following text. For each claim return:
- claimText: the exact claim as a string
- charOffset: approximate character position in the original text (integer)
- charLength: length of the claim text in characters (integer)
- riskLevel: "high" | "medium" | "low" — likelihood the claim has contradicting sources
- riskReasoning: one sentence explaining the risk level
- searchQuery: an optimised web search query to verify this claim

Text:
"""
%s
"""`
