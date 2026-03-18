const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// --- 1. PATH CONFIGURATION ---
// Since this file is in /chemistryFiles, we go up one level to reach the root
const rootDir = path.resolve(__dirname, '..'); 
const jsonInputPath = path.join(rootDir, 'mcq_output', 'mcq_chem2_mcq.json');
const pdfOutputPath = path.join(rootDir, 'chemistry2_mcq_bank.pdf');

// --- 2. HELPER FUNCTIONS ---

// Converts the [img source: ...] placeholder into an actual HTML image tag using local file paths
function formatContentWithImages(text) {
    if (!text) return "";

    // Regex to find the image placeholder
    const imgRegex = /\[img source:\s*([^\]]+)\]/gi;

    return text.replace(imgRegex, (match, imageRelPath) => {
        // Create an absolute path for the local image
        const absoluteImagePath = path.join(rootDir, imageRelPath);
        
        // Check if the image file actually exists on your hard drive
        if (fs.existsSync(absoluteImagePath)) {
            // Convert Windows backslashes to forward slashes for the HTML file URI
            const fileUri = `file:///${absoluteImagePath.replace(/\\/g, '/')}`;
            
            // Inject using standard src without <br> tags to save vertical space
            return `<img src="${fileUri}" class="inline-img">`;
        } else {
            // If the file is missing, log a warning and put an inline placeholder text
            console.warn(`⚠️ Warning: Image not found at ${absoluteImagePath}`);
            return `<span style="color: red; font-size: 10px;">[Missing: ${imageRelPath}]</span>`;
        }
    });
}

// Check if file exists
if (!fs.existsSync(jsonInputPath)) {
    console.error(`❌ Error: JSON file not found at ${jsonInputPath}`);
    process.exit(1);
}

// --- 3. MAIN EXECUTION ---
async function generatePDF() {
    console.log("⏳ Reading JSON data...");
    const rawData = fs.readFileSync(jsonInputPath, 'utf8');
    const data = JSON.parse(rawData);

    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Chemistry MCQ Bank</title>
        <script>
            MathJax = {
              tex: { inlineMath: [['$', '$']] }
            };
        </script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
        
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600&display=swap');
            
            body {
                font-family: 'Noto Sans Bengali', sans-serif;
                font-size: 11px; /* Small font to fit 6 questions easily */
                line-height: 1.4;
                color: #333;
                margin: 0;
                padding: 0;
            }
            /* The 2-column layout */
            .two-column-container {
                column-count: 2;
                column-gap: 30px;
            }
            /* Prevents a question block from splitting in half across columns or pages */
            .question-block {
                break-inside: avoid;
                page-break-inside: avoid;
                margin-bottom: 25px;
                padding: 10px;
                border: 1px solid #eee;
                border-radius: 5px;
                background-color: #fafafa;
            }
            .question-title {
                font-weight: bold;
                font-size: 12px;
                color: #2c3e50;
                margin-bottom: 8px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 3px;
            }
            .options-list {
                list-style-type: none;
                padding-left: 10px;
                margin: 8px 0;
            }
            .option-item {
                margin-bottom: 4px;
            }
            .correct-answer {
                font-weight: bold;
                color: #27ae60;
            }
            .explanation {
                margin-top: 10px;
                padding-top: 5px;
                border-top: 1px dashed #ccc;
                font-style: italic;
                color: #555;
            }
            
            /* --- IMAGE SIZING RULES --- */
            /* Default image behavior */
            .inline-img {
                max-width: 100%;
                border-radius: 4px;
                vertical-align: middle; /* Keeps inline images aligned with text */
            }
            
            /* Images inside the main question */
            .question-text .inline-img {
                max-height: 100px; 
                display: block; /* Puts question images on their own line */
                margin: 5px 0;
            }
            
            /* Images inside the A, B, C, D options */
            .options-list .inline-img {
                max-height: 25px; /* Reduced from 35px to take slightly less space */
                display: inline-block; 
                margin: 0 5px;
            }
            
            /* Images inside the explanation */
            .explanation .inline-img {
                width: 100%; /* Forces the image to take full column width */
                height: auto; /* Maintains proportional aspect ratio */
                display: block;
                margin: 10px 0;
            }

            h1.chapter-title {
                column-span: all; /* Makes the chapter title span across both columns */
                text-align: center;
                background-color: #34495e;
                color: white;
                padding: 10px;
                border-radius: 5px;
                margin-top: 30px;
            }
        </style>
    </head>
    <body>
        <div class="two-column-container">
    `;

    console.log("🏗️ Building HTML layout...");

    // Iterate through decks and cards
    data.decks.forEach(deck => {
        if (!deck.cards || deck.cards.length === 0) return;

        // Add Chapter Title
        htmlContent += `<h1 class="chapter-title">${deck.title}</h1>`;

        deck.cards.forEach(card => {
            htmlContent += `<div class="question-block">`;
            
            // 1. Title (PK) + Meta Info
            let uniYear = (card.university && card.year) ? ` (${card.university} ${card.year})` : '';
            htmlContent += `<div class="question-title">ID: ${card.pk}${uniYear}</div>`;

            // 2. Question
            htmlContent += `<div class="question-text">${formatContentWithImages(card.question)}</div>`;

            // 3. Options
            if (card.options && card.options.length > 0) {
                htmlContent += `<ul class="options-list">`;
                const labels = ['A', 'B', 'C', 'D', 'E'];
                card.options.forEach((opt, index) => {
                    let optClass = opt.answer ? 'correct-answer' : '';
                    let optLabel = labels[index] || '•';
                    htmlContent += `<li class="option-item ${optClass}">${optLabel}) ${formatContentWithImages(opt.option)}</li>`;
                });
                htmlContent += `</ul>`;
            }

            // 4. Explanation
            if (card.explanation && card.explanation.trim() !== '') {
                htmlContent += `<div class="explanation"><strong>Explanation:</strong><br> ${formatContentWithImages(card.explanation)}</div>`;
            }

            htmlContent += `</div>`; // Close question-block
        });
    });

    htmlContent += `
        </div>
    </body>
    </html>`;

    // --- Write HTML to a temporary file ---
    console.log("📝 Writing temporary HTML file to disk...");
    const tempHtmlPath = path.join(rootDir, 'temp_render.html');
    fs.writeFileSync(tempHtmlPath, htmlContent);

    console.log("🌐 Launching headless browser to generate PDF...");
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    console.log("⏳ Loading physical HTML file and waiting for MathJax to render (this may take a minute or two)...");
    
    // Convert the path to a file URL so Chrome can load the local images securely
    const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;

    // Use page.goto instead of page.setContent
    await page.goto(fileUrl, { 
        waitUntil: 'networkidle2', // Allows up to 2 background network connections
        timeout: 0 // 0 entirely disables the 30-second timeout limit
    });

    // Explicit extra buffer to finish typesetting the equations visually
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Generate PDF
    await page.pdf({
        path: pdfOutputPath,
        format: 'A4',
        margin: { top: '20mm', right: '10mm', bottom: '20mm', left: '10mm' },
        printBackground: true // Ensures CSS backgrounds (like the grey boxes) show up
    });

    await browser.close();

    // Clean up the temporary HTML file
    console.log("🧹 Cleaning up temporary files...");
    if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
    }

    console.log(`✅ Success! PDF generated at: ${pdfOutputPath}`);
}

generatePDF().catch(err => {
    console.error("❌ An error occurred:", err);
});