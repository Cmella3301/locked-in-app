#!/bin/bash
KEY="${GEMINI_API_KEY}"

if [ -z "$KEY" ]; then
  echo "GEMINI_API_KEY is not set"
  exit 1
fi

curl -s -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}"
