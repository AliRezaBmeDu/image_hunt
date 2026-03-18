const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const INPUT_FOLDER = "containing_images";
const OUTPUT_ROOT = "images";

if (!fs.existsSync(OUTPUT_ROOT)) {
    fs.mkdirSync(OUTPUT_ROOT);
}

// extract image src
function extractImg(html) {
    if (!html) return null;

    const $ = cheerio.load(html);
    const src = $("img").attr("src");

    return src || null;
}

// download image
async function downloadImage(url, filepath) {

    // skip if already downloaded
    if (fs.existsSync(filepath)) return;

    try {
        const response = await axios({
            url,
            method: "GET",
            responseType: "stream"
        });

        const writer = fs.createWriteStream(filepath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        console.log("Downloaded:", filepath);

    } catch (err) {
        console.log("Failed:", url);
    }
}

async function processFile(file) {

    if (file === "img_chemistry2.json") {
        console.log("Skipping chemistry2");
        return;
    }

    const filepath = path.join(INPUT_FOLDER, file);
    const raw = JSON.parse(fs.readFileSync(filepath));

    const subject = file.replace("img_", "").replace(".json", "");

    const outputDir = path.join(OUTPUT_ROOT, subject);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    console.log(`\nProcessing ${file}`);

    for (const q of raw.questions) {

        const pk = q.pk;

        // QUESTION IMAGE
        const qImg = extractImg(q.question);

        if (qImg) {

            const savePath = path.join(
                outputDir,
                `question_${pk}.png`
            );

            await downloadImage(qImg, savePath);
        }

        // OPTIONS
        let index = 0;

        for (const opt of q.options) {

            const img = extractImg(opt.option);

            if (img) {

                const type = opt.answer ? "true" : "false";

                const savePath = path.join(
                    outputDir,
                    `option_${type}_${pk}_${index}.png`
                );

                await downloadImage(img, savePath);
            }

            index++;
        }

        // EXPLANATION
        const expImg = extractImg(q.explanation);

        if (expImg) {

            const savePath = path.join(
                outputDir,
                `explanation_${pk}.png`
            );

            await downloadImage(expImg, savePath);
        }
    }
}

async function main() {

    const files = fs.readdirSync(INPUT_FOLDER)
        .filter(f => f.endsWith(".json"));

    for (const file of files) {

        await processFile(file);
    }

    console.log("\nAll downloads complete.");
}

main();