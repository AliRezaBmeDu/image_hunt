const fs = require("fs");
const path = require("path");

const inputDir = "./adqb_input";
const outputDir = "./containing_images";

// create output folder if not exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// function to check img tag
function hasImgTag(text) {
    if (!text) return false;
    return /<img\b[^>]*>/i.test(text);
}

// read all files in folder
const files = fs.readdirSync(inputDir).filter(f => f.endsWith(".json"));

files.forEach(file => {
    const filePath = path.join(inputDir, file);

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!data.questions) return;

    const filtered = data.questions.filter(q => {

        // check question
        if (hasImgTag(q.question)) return true;

        // check explanation
        // if (hasImgTag(q.explanation)) return true;

        // check options
        if (q.options && q.options.some(opt => hasImgTag(opt.option))) return true;

        return false;
    });

    const outputData = {
        subject: data.subject,
        count: filtered.length,
        questions: filtered
    };

    const baseName = path.basename(file, ".json");
    const outFile = path.join(outputDir, `img_${baseName}.json`);

    fs.writeFileSync(outFile, JSON.stringify(outputData, null, 2), "utf8");

    console.log(`${file} → ${filtered.length} questions with images`);
});