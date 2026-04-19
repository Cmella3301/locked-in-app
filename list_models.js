// Removed SDK require.

async function listModels() {
  try {
    // This is a direct REST call because listModels might be annoying in v0.21.0
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA-Vt0fA85tFGkowJ_kdr7f21RGtqxmMcM`);
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
