// ... everything above stays the same ...

async function generateSectionContent({ spec, keyword, newsContext, config }) {
  const prompt = buildSectionPrompt({ spec, keyword, newsContext });
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = await callOpenAI({ prompt, config: config.openai });
    const text = sanitizeOpenAIResponse(raw);
    const wordCount = countWords(text);

    if (wordCount < spec.minWords || wordCount > spec.maxWords) {
      if (attempt === maxAttempts) {
        console.warn(
          `⚠️ ${spec.headingTemplate} length ${wordCount} is outside ${spec.minWords}-${spec.maxWords} words`
        );
        return text.trim(); // ✅ still return content instead of throwing
      }
      continue;
    }

    if (!validateSectionStructure({ spec, text })) {
      if (attempt === maxAttempts) {
        console.warn(
          `⚠️ Generated ${spec.headingTemplate} section failed structural validation.`
        );
        return text.trim();
      }
      continue;
    }

    if (!ensureSectionKeywordPresence({ spec, text, keyword })) {
      if (attempt === maxAttempts) {
        console.warn(
          `⚠️ Generated ${spec.headingTemplate} section is missing the keyword.`
        );
        return text.trim();
      }
      continue;
    }

    if (spec.includeKeywordFirst100 && !isKeywordInFirstWords(text, keyword, 100)) {
      if (attempt === maxAttempts) {
        console.warn(
          `⚠️ Introduction does not mention the keyword within the first 100 words.`
        );
        return text.trim();
      }
      continue;
    }

    return text.trim();
  }
  console.warn(`⚠️ Unable to generate ${spec.headingTemplate} after multiple attempts.`);
  return ""; // ✅ don’t crash, just return empty string
}

// ... everything below stays the same ...
