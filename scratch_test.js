const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Hello?");
    console.log(result.response.text());
  } catch (err) {
    console.error(err);
  }
}
run();
