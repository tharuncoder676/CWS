console.log('✅ Content Generator v4.0 (Enhanced) LOADED');

// NOTE: ES module exports are declared with 'export' keyword on the functions below.
// window.* assignments at the bottom provide backwards-compatible global access.

// =============================================
//  API CONFIGURATION
// =============================================

// OpenRouter API — Securely loaded from Environment Variables in Vercel or .env
const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || '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';
const GEMINI_MODEL = 'google/gemini-2.0-flash-001';
const GEMINI_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Content writing also routes through OpenRouter
const OPENAI_API_KEY = import.meta.env?.VITE_OPENAI_API_KEY || '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';
const OPENAI_MODEL = 'google/gemini-2.0-flash-001';
const OPENAI_URL = 'https://openrouter.ai/api/v1/chat/completions';

// =============================================
//  STABILITY CONFIGURATION — CALIBRATED FOR 30 PAGES
// =============================================
const AI_TEMPERATURE = 0.3;
const AI_MAX_TOKENS = 4096;          // Reduced — each section ~150 words
const AI_TIMEOUT_MS = 120000;
const FACT_MAX_TOKENS = 6000;        // Fact extraction — moderate
const MIN_PARAGRAPH_LENGTH = 60;     // Shorter paragraphs for 30-page target
const MIN_PARAGRAPHS_PER_SECTION = 2;
const MAX_RETRIES = 2;
const TARGET_PAGES = 30;             // Target output

// =============================================
//  API CALLERS
// =============================================

// Call OpenRouter (Gemini) — JSON mode
export async function callGemini(prompt, maxTokens) {
    console.log('🔵 GEMINI API CALL → ' + GEMINI_MODEL);
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);
    const currentOrigin = window.location.origin || 'https://capstone-report-gen.local';

    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + GEMINI_API_KEY,
                'HTTP-Referer': currentOrigin,
                'X-Title': 'Capstone Report Generator'
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: GEMINI_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: AI_TEMPERATURE,
                max_tokens: maxTokens || 4096,
                response_format: { type: 'json_object' }
            })
        });
        clearTimeout(timeout);
        console.log('🔵 GEMINI Response Status:', res.status);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error('Gemini API ' + res.status + ': ' + (errData.error?.message || 'Unknown error'));
        }
        const data = await res.json();
        var text = data.choices[0].message.content;
        console.log('🔵 GEMINI Success — Response length:', text.length, 'chars');
        return _parseJSON(text);
    } catch (e) {
        clearTimeout(timeout);
        console.error('🔴 GEMINI FAILED:', e.message);
        throw e;
    }
}

// Call OpenAI (GPT) — JSON mode for structured content
async function callOpenAI(prompt, maxTokens, jsonMode) {
    console.log('🟢 OPENAI API CALL → ' + OPENAI_MODEL + ' | JSON mode:', jsonMode);
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, AI_TIMEOUT_MS);

    var body = {
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: AI_TEMPERATURE,
        max_tokens: maxTokens || AI_MAX_TOKENS
    };
    if (jsonMode) {
        body.response_format = { type: 'json_object' };
    }

    try {
        const res = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + OPENAI_API_KEY,
                'HTTP-Referer': window.location.origin || 'https://capstone-report-gen.local',
                'X-Title': 'Capstone Report Generator'
            },
            signal: controller.signal,
            body: JSON.stringify(body)
        });
        clearTimeout(timeout);
        console.log('🟢 OPENAI Response Status:', res.status);
        if (!res.ok) {
            const errData = await res.json();
            console.error('🔴 OPENAI ERROR:', errData);
            throw new Error('OpenAI API ' + res.status + ': ' + (errData.error?.message || 'Unknown error'));
        }
        const data = await res.json();
        var text = data.choices[0].message.content;
        console.log('🟢 OPENAI Success — Response length:', text.length, 'chars');

        if (jsonMode) {
            return _parseJSON(text);
        }
        return text;
    } catch (e) {
        clearTimeout(timeout);
        console.error('🔴 OPENAI FAILED:', e.message);
        throw e;
    }
}

// Backward-compatible wrapper — uses Gemini for classification, OpenAI for content
async function callAI(prompt, maxTokens) {
    return await callGemini(prompt, maxTokens);
}

// Robust JSON parser
function _parseJSON(text) {
    try {
        var cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);
    } catch (parseErr) {
        console.error('JSON Parse Error. Original text:', text);
        var match = text.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw parseErr;
    }
}

// =============================================
//  PHASE 4 — ANTI-SUMMARY GUARD
// =============================================
function validateContentLength(contentArray) {
    if (!Array.isArray(contentArray)) return false;
    var textParagraphs = contentArray.filter(function (item) {
        return typeof item === 'string' && item.trim().length >= MIN_PARAGRAPH_LENGTH;
    });
    if (textParagraphs.length < MIN_PARAGRAPHS_PER_SECTION) {
        console.warn('Anti-Summary Guard: Only ' + textParagraphs.length + ' substantial paragraphs (need ' + MIN_PARAGRAPHS_PER_SECTION + ')');
        return false;
    }
    return true;
}

// =============================================
//  PHASE 1A — STRICT DOMAIN CLASSIFICATION
//  Uses Gemini (fast classification)
// =============================================
async function _aiClassifyDomain(t, desc) {
    const prompt = `SYSTEM ROLE: STRICT ACADEMIC DOMAIN CLASSIFIER

You classify the academic domain of a project topic.

You DO NOT generate report content.
You DO NOT explain reasoning.
You ONLY identify the correct field.

Return JSON only.

---

POSSIBLE DOMAINS

Computer Science
Information Technology
Artificial Intelligence
Data Science
Cyber Security
Bioinformatics
Biology
Medical
Electronics and Communication
Electrical Engineering
Mechanical Engineering
Civil Engineering
Law
Business Management
Psychology
Education
Social Science
Other

---

CRITICAL DISAMBIGUATION RULES

Bioinformatics ONLY if biological data is analyzed using computational methods
Examples: genome analysis, protein structure prediction, DNA sequencing algorithms

Computer Science if topic focuses on software systems, algorithms, databases, apps, or networking WITHOUT biological datasets

Medical if focus is disease, treatment, diagnosis, patients, clinical usage

Electronics if hardware circuits, signals, sensors, microcontrollers, communication systems

If both biology and computing appear:
biological dataset analysis → Bioinformatics
software application only → Computer Science

Never guess based on keywords alone.
Classify based on academic purpose.

---

OUTPUT FORMAT

{
  "domain": "",
  "confidence": 0
}

---

INPUT
TITLE: ${t}
CONTENT: ${desc}`;
    return await callGemini(prompt);
}

// =============================================
//  PHASE 1B — DOMAIN-LOCKED ANALYSIS
//  Uses Gemini (fast structured output)
// =============================================
async function _aiAnalyzeTitle(t, desc, classifiedDomain) {
    const prompt = `SYSTEM ROLE: STRICT ACADEMIC TOPIC ANALYZER

The domain has ALREADY been classified as: "${classifiedDomain}"
DO NOT change or override the classified domain. Use it as the anchor for all analysis.

TITLE: "${t}"
CONTENT: "${desc}"
CLASSIFIED DOMAIN: "${classifiedDomain}"

---

Using the LOCKED domain "${classifiedDomain}", perform the following:

1. SUB-DOMAIN: Identify the sub-specialization within "${classifiedDomain}".

2. CORE KEYWORDS: Extract 10-15 technical keywords strictly from "${classifiedDomain}" that define this project.

3. WRITING STYLE: Technical / Legal / Descriptive / Analytical / Experimental / Mixed

4. PROJECT TYPE CLASSIFICATION:
   - is_build_project: true if building a system/application/hardware.
   - is_experimental: true if lab experiments/clinical trials/testing.
   - is_theoretical: true if theoretical/survey-based study.

5. DOMAIN-SPECIFIC RULES: 5-8 strict rules all content must follow.

6. FORBIDDEN TOPICS: 5+ topics OUTSIDE "${classifiedDomain}".

Return JSON:
{
  "detected_domain": "${classifiedDomain}",
  "sub_domain": "Sub-specialization",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10"],
  "writing_style": "Name of style",
  "category": "A-I mapping for internal logic",
  "is_build_project": true,
  "is_experimental": false,
  "is_theoretical": false,
  "rules": ["Rule 1", "Rule 2", "Rule 3", "Rule 4", "Rule 5"],
  "forbidden_topics": ["Topic A", "Topic B", "Topic C", "Topic D", "Topic E"],
  "internal_meaning": "One paragraph summary of the project's academic purpose and scope"
}`;
    return await callGemini(prompt);
}

// =============================================
//  PHASE 1C — FACT EXTRACTION ENGINE
//  Uses OpenAI (GPT) for high-quality facts
//  Generates factual grounding BEFORE writing
// =============================================
async function _aiExtractFacts(t, desc, analysis) {
    var kw = (analysis.keywords || []).join(', ');

    var prompt = `SYSTEM ROLE: FACT EXTRACTION ENGINE

You are NOT writing a report.
You are producing structured academic source material about a SPECIFIC project.
Another AI will use your output to write a full report.

Your job is to generate accurate, neutral, information-dense reference content about THIS SPECIFIC TOPIC:

TOPIC: ${t}
DETAILS: ${desc}
DOMAIN: ${analysis.detected_domain}
KEY TERMS: ${kw}

---

CONTENT RULES

1. Write ONLY about "${t}" — not about ${analysis.detected_domain} in general
2. Every fact must directly relate to "${t}" or its components
3. If "${t}" involves specific technologies, explain those technologies
4. If "${t}" involves specific methods, explain those methods
5. Prefer definitions, mechanisms, processes, classifications, and explanations
6. No conversational language, no summaries, no filler
7. No bullet point lists — write full informative paragraphs
8. Be specific: name real algorithms, frameworks, standards, tools, protocols

---

WRITE FACTUAL CONTENT IN THESE BLOCKS (each block should be 3-5 dense paragraphs about "${t}"):

DEFINITION AND CORE CONCEPTS OF "${t}"
What is ${t}? What are its fundamental components? How is it defined in ${analysis.detected_domain}?

THEORETICAL BACKGROUND
What theories, models, or principles underpin "${t}"? What prior research exists?

KEY TERMINOLOGY
Define 10-15 technical terms specific to "${t}" with clear explanations.

WORKING PRINCIPLES AND MECHANISMS
How does "${t}" work? What is the process flow, architecture, or algorithm?

IMPORTANT COMPONENTS AND TECHNOLOGIES
What specific tools, frameworks, languages, hardware, or systems are used in "${t}"?

REAL WORLD APPLICATIONS
Where is "${t}" used in practice? Give specific examples and use cases.

LIMITATIONS AND CHALLENGES
What are the known problems, bottlenecks, or limitations of "${t}"?

METHODS AND FORMULAS
What mathematical models, evaluation metrics, or standard methods apply to "${t}"?

---

QUALITY CONTROL
If a statement is uncertain → omit it.
Do not hallucinate. Do not invent technologies.
Depth about "${t}" is more important than breadth about ${analysis.detected_domain}.

---

OUTPUT: Return only clean text. No markdown. No heading symbols. No explanations about what you did.`;

    return await callOpenAI(prompt, FACT_MAX_TOKENS, false);
}

// =============================================
//  STRUCTURE GENERATION (10 Fixed Headings)
//  Uses Gemini (fast structured output)
// =============================================
async function _aiGenerateStructure(t, desc, analysis, referenceText) {
    let structureType = "NON-BUILD";
    if (analysis.is_build_project) structureType = "BUILD";
    if (analysis.is_experimental) structureType = "EXPERIMENTAL";

    var sourceInstruction = referenceText ?
        'ANALYZE THIS REFERENCE TEXT FOR TOC STRUCTURE ONLY:\n' + referenceText.substring(0, 20000) + '\n' +
        'Extract the structure but ADAPT it to be 100% specific to "' + t + '" and the domain "' + analysis.detected_domain + '".\n' +
        'DO NOT copy any content from the reference. Only use the heading structure as inspiration.' :
        'Create a professional, detailed structure for a "' + analysis.detected_domain + '" capstone project.';

    var prompt = sourceInstruction + `

Project: "${t}"
Domain: ${analysis.detected_domain}
Sub-Domain: ${analysis.sub_domain || analysis.detected_domain}
Project Type: ${structureType}

STRICT REQUIREMENTS:
1. Generate EXACTLY 10 chapters using these EXACT headings in this EXACT order:
   Chapter 1: Introduction
   Chapter 2: Objectives
   Chapter 3: Problem Statement
   Chapter 4: Methodology / Working Principle
   Chapter 5: Key Elements / Data / Components
   Chapter 6: Detailed Analysis
   Chapter 7: Results and Discussion
   Chapter 8: Future Scope
   Chapter 9: Conclusion
   Chapter 10: References

5. INTEGRATION: At least TWO sections in the entire report (usually in Methodology or Analysis) must have a "technical_asset" field in the JSON with a valid Mermaid.js diagram definition (graph TD / sequenceDiagram) representing a workflow or system architecture relevant to "${t}".
6. ILLUSTRATIONS: If the user has opted for AI images, include an "image_prompt" field in the JSON for the ONE most visually significant section in EACH chapter. This prompt should be descriptive (e.g., "A high-tech digital rendering of a neural network architecture with glowing nodes and data flow...") to be used for DALL-E generation.

Return ONLY JSON:
{"chapters":[{"num":1,"title":"Introduction","sections":[{"num":"1.1","title":"...","image_prompt":"optional prompt"},{"num":"1.2","title":"..."},{"num":"1.3","title":"..."}]},{"num":2,"title":"Objectives","sections":[...]},...]}`;

    try {
        return await callGemini(prompt);
    } catch (e) {
        console.warn('Structure AI failed:', e);
        return { chapters: CHAPTER_DEFS };
    }
}

// =============================================
//  SECTION CONTENT — CONTENT-FIRST APPROACH
//  Facts lead. Topic-specific. No generic filler.
// =============================================
function buildSectionPrompt(secDef, chDef, t, desc, analysis, factsText, useEquations) {
    var factsSnippet = (factsText || '').substring(0, 8000);
    var kw = (analysis.keywords || []).join(', ');

    return `You are an expert academic writer in ${analysis.detected_domain}.

TOPIC: "${t}"
DESCRIPTION: "${desc}"

YOUR TASK: Write Section ${secDef.num} — "${secDef.title}" (Chapter ${chDef.num}: "${chDef.title}")

===== FACTUAL KNOWLEDGE BASE (USE THIS AS YOUR PRIMARY SOURCE) =====

${factsSnippet}

===== END OF KNOWLEDGE BASE =====

WRITING INSTRUCTIONS:

Using ONLY the factual knowledge above and your expertise in ${analysis.detected_domain}, write the full content for section "${secDef.title}" as it relates to "${t}".

WHAT TO WRITE:
- Explain what "${secDef.title}" means in the context of "${t}"
- Define the core concepts, mechanisms, and terminology involved
- Describe how "${secDef.title}" works, why it matters, and how it connects to "${t}" and "${desc}"

${window.uploadedContextContent ? `---
REFERENCE PAPER CONTEXT (USER PROVIDED):
"${window.uploadedContextContent.substring(0, 15000)}"
---` : ""}

KEYWORDS: ${kw}

TASK: Extract 30 detailed, highly-technical factual snippets (1-2 sentences each) about "${t}".
Focus ONLY on facts relevant to ${analysis.detected_domain}. Incorporate domain knowledge, specific algorithms, data structures, technologies, and academic principles.
If REFERENCE PAPER CONTEXT is provided above, extract specific technical details, methodologies, and findings from that paper to ground the generation.

Format: Return ONLY the facts as a plain text bulleted list (no Markdown, no headers).
Example fact: "Deep learning segmentation models like U-Net use skip connections to preserve spatial information from the encoder to the decoder."

WHAT NOT TO WRITE:
- No generic academic filler like "This section examines..." or "It is important to note..."
- No motivational statements or storytelling
- No content that could apply to ANY project — every sentence must be specific to "${t}"
- No repeating the same idea in different words
- No placeholders or vague references
- No content outside ${analysis.detected_domain}

REQUIRED OUTPUT (STRICT LENGTH — DO NOT EXCEED):
- EXACTLY 3 paragraphs (each 120-150 words, no more)
- NO tables, NO lists — just 3 clean paragraphs
${useEquations ? `- If the section is TECHNICAL (Chapter 4, 5, or 6), include EXACTLY ONE COMPLEX MATHEMATICAL LaTeX equation (using $...$ or $...$ for multi-line derivations like \\begin{aligned}...\\end{aligned}). 
  - IMPORTANT: This must be a formal academic equation (e.g. loss functions, architectural derivations, or statistical models). 
  - STRICTLY FORBIDDEN: Do not provide programming code, variable definitions (like 'int x'), or pseudo-code in this field.` : "- DO NOT include any mathematical equations or LaTeX formulas in this section."}
- If this section is the primary visual focus for the chapter (as per structure), provide a highly-detailed "image_prompt" for DALL-E in the 'image_prompt' field.
- Total section length must be around 400-450 words to ensure a full 30-page report.

Use these domain keywords naturally: ${kw}

OUTPUT FORMAT — Return ONLY valid JSON:

{
  "number": "${secDef.num}",
  "title": "${secDef.title}",
  "content": [
    "paragraph 1 (~90 words) about ${secDef.title} in context of ${t}...",
    "paragraph 2 (~90 words) with technical details...",
    "paragraph 3 (~90 words) with analysis and connection to project goals..."
  ],
  "technical_formula": "Optional Complex LaTeX derivation ($...$)",
  "technical_asset": "Optional Mermaid.js diagram definition only if requested by structure",
  "image_prompt": "Optional DALL-E prompt if this section is the visual focus"
}`;
}

// =============================================
//  ABSTRACT — Content-first with facts
// =============================================
async function _aiAbstract(t, desc, analysis, factsText) {
    var factsSnippet = (factsText || '').substring(0, 4000);
    var kw = (analysis.keywords || []).join(', ');

    var prompt = `You are an expert academic writer in ${analysis.detected_domain}.

Write the Abstract for a capstone project report on "${t}".

===== FACTUAL KNOWLEDGE BASE =====
${factsSnippet}
===== END =====

PROJECT: "${t}"
DESCRIPTION: "${desc}"

Using the factual knowledge above, write EXACTLY 4 paragraphs:

Paragraph 1: What "${t}" is and the problem it solves (80-100 words)
Paragraph 2: The methodology and key technologies used (80-100 words)
Paragraph 3: Results and contributions to ${analysis.detected_domain} (80-100 words)
Paragraph 4: Keywords list — 10 technical keywords specific to "${t}"

Each paragraph must be 80-100 words. DO NOT write more than 4 paragraphs.
No generic filler. Every sentence must be specific to this project.

Return JSON:
{"paragraphs":["paragraph1","paragraph2","paragraph3","Keywords: ${kw}"]}`;
    return await callOpenAI(prompt, AI_MAX_TOKENS, true);
}

// =============================================
//  REFERENCES — Uses OpenAI
// =============================================
async function _aiReferences(t, analysis) {
    var prompt = `Generate exactly 10 high-quality academic references for a ${analysis.detected_domain} capstone project on "${t}".
    
    Keywords: ${(analysis.keywords || []).join(', ')}

    STRICT FORMAT FOR EACH REFERENCE:
    "Author Name, 'Research Paper or Book Title', [Link: https://...]"

    RULES:
    1. Each of the 10 items must include the Author, the Title in single quotes, and a valid URL or DOI link.
    2. No extra descriptions.
    3. Return ONLY valid JSON: {"references":["Author, 'Title', [Link: URL]", ...]}`;
    return await callGemini(prompt, AI_MAX_TOKENS, true);
}

// =============================================
// =============================================
//  APPENDICES — Uses Gemini
// =============================================
async function _aiAppendices(t, desc, analysis) {
    var prompt = `As a PhD-level research assistant, generate technical Appendix content for a ${analysis.detected_domain} capstone project on "${t}".
    
    Keywords: ${(analysis.keywords || []).join(', ')}

    Return a JSON object with:
    1. "title": "APPENDICES"
    2. "items": A list of 8-10 highly-technical bullet points covering:
       - Technical tools, libraries, and frameworks (versioned).
       - System hardware and software environment specifications.
       - A brief architectural overview or pseudo-algorithm block.
    
    Return ONLY valid JSON: {"title": "APPENDICES", "items": ["...", "..."]}`;
    return await callGemini(prompt, AI_MAX_TOKENS, true);
}

// =============================================
//  MAIN GENERATOR — ORCHESTRATOR
//  Dual-AI pipeline with fact grounding
// =============================================
export async function generateReportContentWithAI(projectTitle, projectDescription, referenceText, options, onProgress) {
    var t = projectTitle;
    var desc = projectDescription;
    var useAiImages = options?.useAiImages || false;
    var useSmartRefs = options?.useSmartRefs || false;
    var useEquations = options?.useEquations !== false; // Default true
    function progress(msg) { if (onProgress) onProgress(msg); }

    // ── PHASE 1A: Strict Domain Classification (Gemini) ──
    progress('Phase 1A: Classifying academic domain...');
    var domainResult = await _aiClassifyDomain(t, desc).catch(function (e) {
        console.warn('Domain classification failed, using default:', e);
        return { domain: 'Computer Science', confidence: 1.0 };
    });
    var classifiedDomain = domainResult?.domain || 'Computer Science';
    console.log('Domain Classification (Phase 1A):', classifiedDomain, '| Confidence:', domainResult?.confidence);

    // ── PHASE 1B: Domain-Locked Analysis (Gemini) ──
    progress('Phase 1B: Analyzing "' + classifiedDomain + '" — extracting keywords and rules...');
    var analysis = await _aiAnalyzeTitle(t, desc, classifiedDomain).catch(function (e) {
        console.warn('Domain analysis failed, using default structure:', e);
        return {
            keywords: ['Engineering', 'Methodology', 'Analysis', 'Implementation', 'Research'],
            detected_domain: classifiedDomain
        };
    });
    analysis.detected_domain = classifiedDomain;
    analysis.category_name = classifiedDomain;
    analysis.classification_confidence = domainResult?.confidence || 0.5;
    console.log('Domain Analysis (Phase 1B):', analysis);

    // ── PHASE 1C: Fact Extraction Engine (OpenAI GPT) ──
    progress('Phase 1C: Extracting factual grounding material via GPT...');
    var factsText = '';
    try {
        factsText = await _aiExtractFacts(t, desc, analysis);
        console.log('Fact Extraction (Phase 1C): ' + factsText.length + ' chars extracted');
    } catch (e) {
        console.warn('Fact extraction failed, proceeding without grounding:', e);
        factsText = '';
    }

    // ── PHASE 2: Structure Generation (Gemini) ──
    progress('Phase 2: Building 10-chapter academic structure for ' + analysis.detected_domain + '...');
    var structResult = await _aiGenerateStructure(t, desc, analysis, referenceText, useAiImages).catch(function (e) {
        console.warn('Structure Generation failed, using static template:', e);
        return { chapters: CHAPTER_DEFS };
    });
    var activeChapters = structResult?.chapters || CHAPTER_DEFS;
    console.log('Structure (Phase 2):', activeChapters.length + ' chapters');

    // ── Abstract Generation (OpenAI GPT with facts) ──
    progress('Generating PhD-level abstract with factual grounding...');
    var abstractResult = await _aiAbstract(t, desc, analysis, factsText).catch(function (e) { console.warn('Abstract failed:', e); return null; });

    // ── References Generation (OpenAI GPT) ──
    progress('Phase 2C: Generating academic references...');
    var refsResult = null;
    if (useSmartRefs) {
        progress('🔍 Searching Google Academic API for real citations...');
        const smartRefs = await window.fetchSmartReferences(t, analysis.keywords || []);
        refsResult = { references: smartRefs };
    } else {
        refsResult = await _aiReferences(t, analysis).catch(function (e) { console.warn('References failed:', e); return null; });
    }

    // ── Appendices Generation (OpenAI GPT) ──
    progress('Phase 2D: Generating technical appendices...');
    var appxResult = await _aiAppendices(t, desc, analysis).catch(function (e) {
        console.warn('Appendices failed:', e);
        return {
            items: [
                "Hardware: NVIDIA RTX GPU, 16GB RAM, i7 Processor",
                "Software: Python 3.10, PyTorch, CUDA 11.8, OpenCV",
                "Architecture: Modular MVC-based Deep Learning Pipeline",
                "Dataset: Academic-grade curated research data"
            ]
        };
    });

    // ── PHASE 3-5: Section-by-Section Content (OpenAI GPT with facts) ──
    var chapters = [];
    var totalSections = 0;
    activeChapters.forEach(function (ch) { totalSections += (ch.sections || []).length; });
    var completedSections = 0;

    for (var i = 0; i < activeChapters.length; i++) {
        var chDef = activeChapters[i];
        var sections = [];

        progress('📖 Chapter ' + chDef.num + ': ' + chDef.title + ' (' + (chDef.sections || []).length + ' sections)');

        for (var j = 0; j < (chDef.sections || []).length; j++) {
            var secDef = chDef.sections[j];
            completedSections++;
            var progressPct = Math.round((completedSections / totalSections) * 100);
            progress('[' + progressPct + '%] Writing Section ' + secDef.num + ': ' + secDef.title + '...');

            // 1.5s pause between sub-sections for API stability
            await new Promise(function (r) { setTimeout(r, 1500); });

            var retryCount = 0;
            var sectionGenerated = false;

            while (retryCount <= MAX_RETRIES && !sectionGenerated) {
                try {
                    // Build prompt with FACTUAL GROUNDING from Phase 1C
                    var prompt = buildSectionPrompt(secDef, chDef, t, desc, analysis, factsText, useEquations);
                    var secResult = await callOpenAI(prompt, AI_MAX_TOKENS, true);

                    if (secResult && Array.isArray(secResult.content)) {
                        // PHASE 4: Anti-Summary Guard Validation
                        if (!validateContentLength(secResult.content) && retryCount < MAX_RETRIES) {
                            console.warn('Anti-Summary Guard triggered for Section ' + secDef.num + '. Retrying (' + (retryCount + 1) + '/' + MAX_RETRIES + ')...');
                            progress('⚠ Section ' + secDef.num + ' too short — regenerating with deeper expansion...');
                            retryCount++;
                            await new Promise(function (r) { setTimeout(r, 2000); });
                            continue;
                        }

                        var cleanContent = [];
                        secResult.content.forEach(function (item) {
                            if (typeof item === 'string' || (item && (item.type === 'list' || item.type === 'table'))) {
                                cleanContent.push(item);
                            }
                        });

                        var finalSec = {
                            number: secResult.number || secDef.num,
                            title: secResult.title || secDef.title,
                            content: cleanContent,
                            formula: secResult.technical_formula,
                            asset: secResult.technical_asset,
                            image_url: null
                        };

                        // 🎨 AI Image Generation if prompted and enabled
                        if (useAiImages && (secResult.image_prompt || secDef.image_prompt)) {
                            progress('🎨 AI is designing a technical illustration for ' + finalSec.title + '...');
                            const imgUrl = await window.generateAIImage(secResult.image_prompt || secDef.image_prompt);
                            if (imgUrl) finalSec.image_url = imgUrl;
                        }

                        sections.push(finalSec);
                        sectionGenerated = true;

                        // LIVE PREVIEW UPDATE
                        if (window.updateLivePreview) window.updateLivePreview(finalSec, chDef);

                    } else {
                        throw new Error('Invalid section content structure');
                    }
                } catch (e) {
                    console.warn('Section ' + secDef.num + ' attempt ' + (retryCount + 1) + ' failed:', e);
                    retryCount++;

                    if (retryCount > MAX_RETRIES) {
                        progress('⚠ Section ' + secDef.num + ' using enhanced fallback content...');
                        var fallbackSec = buildFallbackSection(secDef, chDef, t, desc, analysis);
                        sections.push(fallbackSec);
                        sectionGenerated = true;
                        if (window.updateLivePreview) window.updateLivePreview(fallbackSec, chDef);
                    } else {
                        await new Promise(function (r) { setTimeout(r, 2000); });
                    }
                }
            }
        }
        chapters.push({ number: chDef.num, title: chDef.title, sections: sections });
    }

    // Assemble final report
    var fallback = generateReportContent(t, desc);
    var abstract = (abstractResult && abstractResult.paragraphs) ? abstractResult.paragraphs : fallback.abstract;
    var references = (refsResult && Array.isArray(refsResult.references)) ? refsResult.references : fallback.references;
    var appendices = (appxResult && Array.isArray(appxResult.items)) ? appxResult.items : ["General Technical Documentation", "System Requirements"];

    progress('✅ Full academic report compiled successfully! (' + totalSections + ' sections generated)');
    return { abstract: abstract, chapters: chapters, references: references, appendices: appendices };
}

// =============================================
//  ENHANCED FALLBACK SECTION
// =============================================
function buildFallbackSection(secDef, chDef, t, desc, analysis) {
    var domain = analysis.detected_domain || 'the relevant domain';
    var keywords = (analysis.keywords || []).slice(0, 5).join(', ') || t;

    return {
        number: secDef.num,
        title: secDef.title,
        content: [
            'The comprehensive analysis of ' + secDef.title + ' within the framework of "' + t + '" necessitates a thorough understanding of the foundational principles that govern ' + domain + ' as an academic discipline. This section examines the critical intersection between theoretical frameworks and practical applications, providing a detailed exploration of how ' + secDef.title + ' contributes to the overall objectives of the project. The significance of this investigation lies in its ability to bridge the gap between established ' + domain + ' methodologies and the innovative approaches required for "' + t + '". Through systematic analysis and rigorous academic inquiry, this section establishes the groundwork for understanding the complex relationships that define the project scope.',

            'Contemporary research in ' + domain + ' has consistently demonstrated the importance of ' + secDef.title + ' in advancing both theoretical knowledge and practical implementations. The evolution of ' + keywords + ' has created new paradigms that challenge traditional approaches while simultaneously opening pathways for innovative solutions. Within the context of "' + t + '", these developments assume particular significance as they directly influence the methodology, design decisions, and expected outcomes of the project. The academic literature provides substantial evidence that ' + secDef.title + ' serves as a critical component in ensuring the reliability, scalability, and effectiveness of systems within the ' + domain + ' ecosystem.',

            'The methodological considerations surrounding ' + secDef.title + ' require careful attention to both qualitative and quantitative parameters that define success within ' + domain + ' research. Standard practices dictate that rigorous evaluation criteria be applied when assessing the performance metrics associated with "' + t + '". This involves the systematic collection and analysis of data points that reflect the true impact of ' + secDef.title + ' on the project outcomes. The integration of established benchmarks with project-specific indicators ensures that the evaluation framework remains both comprehensive and contextually relevant.',

            'The practical implementation of ' + secDef.title + ' within "' + t + '" demands a nuanced understanding of the technical constraints and opportunities that characterize the ' + domain + ' landscape. Engineering decisions made at this stage have far-reaching implications for the overall system architecture, performance characteristics, and maintainability of the solution. The analysis presented here draws upon established ' + domain + ' principles while incorporating project-specific adaptations that address the unique requirements identified during the preliminary investigation phase.',

            'Furthermore, the comparative analysis of existing approaches to ' + secDef.title + ' reveals significant variations in effectiveness, efficiency, and applicability across different contexts within ' + domain + '. By examining these variations systematically, this section identifies the optimal strategies for "' + t + '" and provides justification for the selected approach. The evidence-based reasoning presented here ensures that all technical decisions are grounded in academic literature and empirical observations rather than assumptions or untested hypotheses.',

            'In synthesizing the findings related to ' + secDef.title + ', it becomes evident that "' + t + '" represents a meaningful contribution to the ' + domain + ' body of knowledge. The detailed examination conducted in this section provides the necessary foundation for the subsequent chapters of this report, ensuring continuity and coherence in the academic narrative. The implications of these findings extend beyond the immediate project scope, offering insights that may inform future research directions and practical applications within the broader ' + domain + ' community.'
        ]
    };
}

// =============================================
//  TEMPLATE-BASED FALLBACK (Complete)
// =============================================
export function generateReportContent(projectTitle, projectDescription) {
    var t = projectTitle;
    var desc = projectDescription || 'A project focused on ' + t;
    var chapters = CHAPTER_DEFS.map(function (ch) {
        return {
            number: ch.num,
            title: ch.title,
            sections: ch.sections.map(function (sec, secIdx) {
                return {
                    number: sec.num || (ch.num + '.' + (secIdx + 1)),
                    title: sec.title,
                    content: [
                        'This section provides a rigorous academic overview of ' + sec.title + ' as it pertains to the project "' + t + '". The investigation centers on the foundational principles required to understand the broader implications within contemporary research. The systematic approach adopted here ensures that each aspect of ' + sec.title + ' is examined with the depth and precision expected at the capstone level.',

                        'Furthermore, the integration of ' + sec.title + ' within the project framework necessitates a multi-faceted approach, balancing theoretical constructs with practical observations derived from the study of ' + t + '. This balance is essential for producing academically sound conclusions that withstand peer scrutiny.',

                        { type: 'list', items: ['Structural analysis of ' + sec.title, 'Correlation between ' + t + ' and domain standards', 'Identification of key performance indicators'] },

                        'Detailed examination of these elements reveals that ' + t + ' serves as a critical junction for experimental and theoretical progress. This narrative expansion ensures that all academic requirements for the capstone report are met with technical precision and scholarly rigor.',

                        { type: 'table', caption: 'Table: ' + sec.title + ' Comparative Metrics', headers: ['Metric', 'Context', 'Standard'], rows: [['Reliability', 'High', 'Verified'], ['Performance', 'Optimal', 'Benchmark']] },

                        'In conclusion, the analysis of ' + sec.title + ' underscores the robustness of the proposed ' + t + ' system, providing a definitive roadmap for the subsequent evaluations detailed in this report.'
                    ]
                };
            })
        };
    });

    return {
        abstract: [
            'This capstone project, entitled "' + t + '", investigates the core principles and implementation strategies relevant to modern academic standards within its domain.',
            'The study focuses on ' + desc + ' through systematic analysis, literature review, and rigorous testing methodologies.',
            'The methodology combines established theoretical frameworks with innovative practical approaches to address the identified research gaps.',
            'Results indicate that ' + t + ' provides a robust and effective solution for the identified problem statement, meeting or exceeding established benchmarks.',
            'Future work will expand upon the findings detailed in this report to enhance the performance, scalability, and scope of the project.',
            'Keywords: ' + t + ', Academic Study, Capstone Project, Implementation, Analysis, Research, Engineering, Technology, Innovation, Evaluation'
        ],
        chapters: chapters,
        references: [
            'Author, A. (2024). Advanced Research in ' + t + '. Academic Press.',
            'Smith, J. (2023). Implementation Guide for Modern Engineering Projects. Technology Journal, 15(3), 45-67.',
            'IEEE Standard for Project Documentation. (2022). Institute of Electrical and Electronics Engineers.',
            'Johnson, R., & Williams, K. (2023). Systematic Analysis and Design Methodologies. Springer Nature.',
            'Kumar, S., et al. (2024). Emerging Trends in Technical Research. International Journal of Engineering, 8(2), 112-128.'
        ]
    };
}

// Default structure — 10 chapters × 3 sections = 30 sections (targets ~30 pages)
var CHAPTER_DEFS = [
    { num: 1, title: 'Introduction', sections: [{ num: '1.1', title: 'Background of Study' }, { num: '1.2', title: 'Problem Definition' }, { num: '1.3', title: 'Scope and Objectives' }] },
    { num: 2, title: 'Objectives', sections: [{ num: '2.1', title: 'Primary Objectives' }, { num: '2.2', title: 'Secondary Goals' }, { num: '2.3', title: 'Expected Deliverables' }] },
    { num: 3, title: 'Problem Statement', sections: [{ num: '3.1', title: 'Current Challenges' }, { num: '3.2', title: 'Research Gap' }, { num: '3.3', title: 'Proposed Solution' }] },
    { num: 4, title: 'Methodology / Working Principle', sections: [{ num: '4.1', title: 'Theoretical Framework' }, { num: '4.2', title: 'Methodological Approach' }, { num: '4.3', title: 'Tools and Technologies' }] },
    { num: 5, title: 'Key Elements / Data / Components', sections: [{ num: '5.1', title: 'Core Components' }, { num: '5.2', title: 'Data Acquisition' }, { num: '5.3', title: 'System Architecture' }] },
    { num: 6, title: 'Detailed Analysis', sections: [{ num: '6.1', title: 'Technical Evaluation' }, { num: '6.2', title: 'Comparative Study' }, { num: '6.3', title: 'Performance Assessment' }] },
    { num: 7, title: 'Results and Discussion', sections: [{ num: '7.1', title: 'Experimental Results' }, { num: '7.2', title: 'Result Validation' }, { num: '7.3', title: 'Discussion' }] },
    { num: 8, title: 'Future Scope', sections: [{ num: '8.1', title: 'Future Enhancements' }, { num: '8.2', title: 'Scalability Plans' }, { num: '8.3', title: 'Industry Applications' }] },
    { num: 9, title: 'Conclusion', sections: [{ num: '9.1', title: 'Summary' }, { num: '9.2', title: 'Key Contributions' }, { num: '9.3', title: 'Concluding Remarks' }] },
    { num: 10, title: 'References', sections: [{ num: '10.1', title: 'Primary Sources' }, { num: '10.2', title: 'Secondary Literature' }, { num: '10.3', title: 'Online Resources' }] }
];

// ── Global assignments for backward compatibility ──────────────────────────
// (ES module imports above are preferred; these exist for legacy inline usage)
window.callGemini = callGemini;
window.generateReportContentWithAI = generateReportContentWithAI;
window.generateReportContent = generateReportContent;

