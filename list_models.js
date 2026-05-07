require("dotenv").config();

async function listModels() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    console.log("AVAILABLE MODELS:");
    if (data.models) {
      data.models.forEach(m => console.log(m.name));
    }
  } catch (err) {
    console.error(err);
  }
}
listModels();
