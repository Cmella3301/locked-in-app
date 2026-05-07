const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    const result = await model.generateContent("Say hello");
    const response = await result.response;
    console.log("Success:", response.text());
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

test();
