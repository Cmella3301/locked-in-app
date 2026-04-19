const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyA-Vt0fA85tFGkowJ_kdr7f21RGtqxmMcM");

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
