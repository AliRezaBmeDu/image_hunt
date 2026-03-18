const fs = require('fs');
const path = require('path');

// --- 1. CONFIGURATION ---
const C2_CHAPTERS = [
  'পরিবেশ রসায়ন',
  'জৈব যৌগ',
  'পরিমাণগত রসায়ন',
  'তড়িৎ রসায়ন',
  'অর্থনৈতিক রসায়ন'
];

// --- 2. HELPER FUNCTIONS ---

// IMG PLACEHOLDER REPLACER
function replaceImgWithPlaceholder(html, type, pk, optIndex = null, isCorrect = false) {

  if (!html) return "";

  if (!/<img/i.test(html)) return html;

  let imgPath = "";

  if (type === "question") {
    imgPath = `images/chemistry2/question_${pk}.png`;
  }

  if (type === "explanation") {
    imgPath = `images/chemistry2/explanation_${pk}.png`;
  }

  if (type === "option") {
    const tf = isCorrect ? "true" : "false";
    imgPath = `images/chemistry2/option_${tf}_${pk}_${optIndex}.png`;
  }

  return `[img source: ${imgPath}]`;
}

// --- Greek Character Mapping ---
const greekMap = {
  "ɣ": "γ", "ϵ": "ε", "ϑ": "θ", "ϕ": "φ", "ϖ": "π", "ϱ": "ρ", "ϰ": "κ"
};

function replaceGreekChars(text) {
  if (!text) return "";
  return text.replace(/./g, c => greekMap[c] || c);
}

// --- Convert Superscript/Subscript ---
function convertSuperSub(text) {
  if (!text) return "";

  text = text.replace(/<sup[^>]*>(.*?)<\/sup>/gi, (_, content) => {
    content = replaceGreekChars(content);
    return `^{${content}}`;
  });

  text = text.replace(/<sub[^>]*>(.*?)<\/sub>/gi, (_, content) => {
    content = replaceGreekChars(content);
    return `_{${content}}`;
  });

  return text;
}

// --- Handle class="mathy" ---
function handleMathyClass(text) {

  if (!text) return "";

  return text.replace(
    /<[^>]+class\s*=\s*["']mathy["'][^>]*>(.*?)<\/[^>]+>/gi,
    (_, content) => {

      content = content.trim();

      if (/[\u0980-\u09FF]/.test(content)) return content;

      if (content.startsWith('$') && content.endsWith('$')) return content;

      return `$${content}$`;
    }
  );
}

// --- FIX VECTOR NOTATION ---
function fixVectorNotation(text) {

  if (!text) return "";

  const keywordsStr = "vec|hat|bar|nabla|alpha|beta|theta|omega|gamma|delta|pi|rho|sigma|tau|phi|psi|mu|lambda";

  text = text.replace(new RegExp(`([^\\\\]|^)\\b(vec|hat|bar)([a-zA-Z])\\b`, 'g'), "$1\\$2{$3}");

  text = text.replace(new RegExp(`(${keywordsStr})(${keywordsStr})`, 'gi'), "$1 $2");

  text = text.replace(new RegExp(`([^\\\\]|^)\\b(${keywordsStr})\\b`, 'gi'), "$1\\$2");

  const standaloneSymbols = ["nabla","alpha","beta","theta","omega","gamma","delta","pi","rho","sigma","tau","phi","psi","mu","lambda"];

  const standaloneRegex = new RegExp(`\\\\(${standaloneSymbols.join("|")})\\b`, 'gi');

  text = text.replace(standaloneRegex, (match, cmd) => `$\\${cmd.toLowerCase()}$`);

  const functionalCmds = ["vec","hat","bar"];

  const funcRegex = new RegExp(`\\\\(${functionalCmds.join("|")})\\s*(\\{[^\\}]+\\}|\\\\[a-zA-Z]+|[a-zA-Z0-9])`, 'gi');

  text = text.replace(funcRegex, (match, cmd, arg) => {
    let cleanArg = arg.replace(/^\{|\}$/g,"");
    return `$\\${cmd.toLowerCase()}{${cleanArg}}$`;
  });

  return text;
}

// --- Decode HTML Entities ---
function decodeHTMLEntities(text) {

  if (!text) return "";

  const entities = {
    "&nbsp;": " ",
    "&gt;": ">",
    "&lt;": "<",
    "&amp;": "&",
    "&quot;": '"',
    "&apos;": "'"
  };

  return text.replace(/&[a-z]+;/g, match => entities[match] || match);
}

// --- Ordered List Conversion ---
function convertOrderedListToText(html) {

  if (!html) return "";

  const olMatch = html.match(/<ol[^>]*style=["'][^"']*list-style-type:\s*lower-roman;?[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i);

  if (!olMatch) return html;

  const olContent = olMatch[1];

  const liMatches = [...olContent.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];

  const romanNumerals = ["i","ii","iii","iv","v","vi","vii","viii","ix","x"];

  const result = liMatches.map((m, idx) => {

    let liText = m[1].replace(/<[^>]+>/g,"").trim();

    const roman = romanNumerals[idx] || (idx + 1);

    return `${roman}. ${liText}`;

  }).join(" ");

  return html.replace(olMatch[0], result);
}

// --- Remove Question Number ---
function removeQuestionNumber(text) {
  return text.replace(/^\s*(\([^\)]*\))?\s*প্রশ্ন-[\d০-৯]+\s*/i, "").trim();
}

// --- Insert Space ---
function insertSpaceAfterQuestionNumber(text) {
  return text.replace(/(প্রশ্ন-[\d০-৯]+)(\S)/g, "$1 $2");
}

// --- Fix Incorrect Latex ---
function fixIncorrectLatex(text) {
  if (!text) return "";
  return text.replace(/\$([^\$]*[\u0980-\u09FF][^\$]*)\$/g, "$1");
}

// --- Strip HTML ---
function stripHTML(text) {
  if (!text) return "";
  text = decodeHTMLEntities(text);
  text = text.replace(/<[^>]+>/g, "");
  return text.trim();
}

// --- Clean Text Pipeline ---
function cleanText(text) {

  if (!text) return "";

  text = convertOrderedListToText(text);

  text = convertSuperSub(text);

  text = handleMathyClass(text);

  text = insertSpaceAfterQuestionNumber(text);

  text = stripHTML(text);

  text = removeQuestionNumber(text);

  text = fixVectorNotation(text);

  text = fixIncorrectLatex(text);

  text = text.replace(/\+-/g, "±");

  text = text.replace(/\$\$([^\$]+)\$\$/g, "$$1$");

  text = text.replace(/\$\$/g, "");

  return text.replace(/\s+/g, " ").trim();
}

// --- CHAPTER INDEX ---
function getChapterIndex(tags) {

  if (!Array.isArray(tags)) return 0;

  for (const tag of tags) {

    if (tag.type === 'chapter' && tag.tag) {

      const match = tag.tag.match(/C-2\.(\d+)/);

      if (match) return parseInt(match[1], 10) - 1;
    }
  }

  return 0;
}

// --- MATH WRAPPER ---
function wrapMissedMath(text) {

  if (!text) return "";

  const parts = text.split('$');

  for (let i = 0; i < parts.length; i += 2) {

    parts[i] = parts[i]

      .replace(/([a-zA-Z0-9]+)(\^\{[^\}]+\}|_\{[^\}]+\})/g, "$$$1$2$$")

      .replace(/\b([a-zA-Z0-9]+)\s*=\s*([a-zA-Z0-9]+)\b/g, "$$$1=$2$$")

      .replace(/(\d+)\s*([+×÷])\s*(\d+)/g, "$$$1 $2 $3$$");
  }

  return parts.join('$');
}

// --- UNIVERSITY ---
function getUniversity(firstTags) {

  if (!Array.isArray(firstTags)) return null;

  const uni = firstTags.find(t => t.type === "university" && t.tag);

  return uni ? uni.tag : null;
}

// --- YEAR ---
function getYear(firstTags) {

  if (!Array.isArray(firstTags)) return null;

  const yr = firstTags.find(t => t.type === "year" && t.tag);

  return yr ? yr.tag : null;
}

// --- DONE/SKIP FILTER ---
function isDoneSkipOnly(options = []) {

  if (options.length !== 2) return false;

  const texts = options.map(o => (o.option || "").toLowerCase().trim());

  return texts.includes("done") && texts.includes("skip");
}

// --- MAIN PROCESS ---
function processC2Data() {

  const inputFile = 'containing_images/img_chemistry2.json';

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  const questions = data.questions || [];

  const chem2DecksMap = {};
  const chemmcq2DecksMap = {};

  C2_CHAPTERS.forEach((title, index) => {

    const id = index + 1;

    const deck = { id, title, accessibility: "regular", cards: [] };

    chem2DecksMap[id] = JSON.parse(JSON.stringify(deck));

    chemmcq2DecksMap[id] = JSON.parse(JSON.stringify(deck));
  });

  questions.forEach(q => {

    const universityTag = getUniversity(q.first_tags);

    const yearTag = getYear(q.first_tags);

    if (universityTag === "Nursing") return;

    const allTags = [...(q.first_tags || []), ...(q.second_tags || [])];

    let chapterIdx = getChapterIndex(allTags);

    if (chapterIdx < 0 || chapterIdx >= C2_CHAPTERS.length) chapterIdx = 0;

    const deckId = chapterIdx + 1;

    // QUESTION
    let questionText = replaceImgWithPlaceholder(q.question, "question", q.pk);

    let cleanQuestion = wrapMissedMath(cleanText(questionText));

    // OPTIONS
    let cleanedOptions = (q.options || []).map((opt, index) => {

      let optText = replaceImgWithPlaceholder(
        opt.option,
        "option",
        q.pk,
        index,
        opt.answer
      );

      return {
        answer: opt.answer,
        option: wrapMissedMath(cleanText(optText))
      };
    });

    if (isDoneSkipOnly(cleanedOptions)) return;

    let correctAnswerText = "";

    cleanedOptions.forEach(o => {
      if (o.answer) correctAnswerText = o.option;
    });

    const hasMath =
      cleanQuestion.includes('$') ||
      cleanedOptions.some(o => o.option.includes('$'));

    const tag = hasMath ? "math" : "non_math";

    chem2DecksMap[deckId].cards.push({

      id: chem2DecksMap[deckId].cards.length + 1,

      question: cleanQuestion,

      answer: correctAnswerText,

      tag,

      history: [],

      university: universityTag,

      year: yearTag
    });

    chemmcq2DecksMap[deckId].cards.push({

      pk: q.pk,

      id: chemmcq2DecksMap[deckId].cards.length + 1,

      question: cleanQuestion,

      options: cleanedOptions,

      tag,

      history: [],

      university: universityTag,

      year: yearTag
    });
  });

  if (!fs.existsSync('text_output')) fs.mkdirSync('text_output');

  if (!fs.existsSync('mcq_output')) fs.mkdirSync('mcq_output');

  fs.writeFileSync(
    'text_output/text_chem2.json',
    JSON.stringify({ decks: Object.values(chem2DecksMap) }, null, 2)
  );

  fs.writeFileSync(
    'mcq_output/mcq_chem2_mcq.json',
    JSON.stringify({ decks: Object.values(chemmcq2DecksMap) }, null, 2)
  );

  console.log("✅ Chemistry-2 processing complete.");
}

processC2Data();