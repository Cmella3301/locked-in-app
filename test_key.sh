#!/bin/bash
KEY="AIzaSyA-Vt0fA85tFGkowJ_kdr7f21RGtqxmMcM"
curl -s -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}"
