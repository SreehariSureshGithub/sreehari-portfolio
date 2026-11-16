# Sreehari Suresh – Projects

<!-- Fill the [FILL] lines (how it works, your role, hardest problem, GitHub link). This is where the bot gets depth. Delete any [FILL] you don't want answered. -->

## Project: Portfolio AI Assistant (RAG chatbot) – Generative AI
Sreehari built the AI assistant on his own portfolio website. This assistant, the chatbot visitors are talking to right now ("you", "this chatbot", "this bot", "this assistant"), is that project. Recruiters can ask it about his experience, skills and projects. It uses Retrieval-Augmented Generation (RAG): his resume and project notes are split into chunks and embedded with an open-source embedding model; the most relevant chunks are retrieved for each question and passed to an LLM that answers only from that context. Guardrails refuse off-topic questions, resist prompt injection and rate-limit usage, and the whole system runs on free tiers.
- Stack: TanStack Start (React 19, TypeScript) on Vercel; open-source bge-small-en-v1.5 embeddings running inside the server function (transformers.js, ONNX) combined with BM25 keyword search; Groq-hosted gpt-oss-120b with gpt-oss-20b as fallback, streamed token by token through an output guard; Upstash Redis for rate limiting and a semantic answer cache.
- Link: https://sreeharisuresh.vercel.app

## When did Sreehari build this AI assistant (this chatbot)?
Sreehari built this AI assistant, the chatbot on his portfolio, in November 2026.

## How long did it take Sreehari to build this AI assistant (this chatbot)?
[FILL: your wording, e.g. "Sreehari built it in about X days of focused work."]

## How did Sreehari build this AI assistant (this chatbot)?
Sreehari built this assistant: he set its goals and constraints ($0 to run, secure, honest about facts), chose its design, and tested it with an evaluation suite and red-team security tests.

## Project: Intelligent Traffic Signal Control – Computer Vision
A live-video prototype that counts vehicles per lane and adjusts traffic-signal timing dynamically, prioritising high-volume lanes while enforcing minimum wait times for every lane.
- Stack: YOLO, OpenCV, Python
- Result: 98% vehicle detection accuracy in controlled tests
- [FILL: how timing is decided, dataset, academic or personal project, GitHub link]

## Project: Hybrid LiDAR + Camera Safety System – Embedded AI
A real-time obstacle detection and alerting system for caravans, built during Sreehari's internship at Campervan Factory. The LiDAR detects obstacles and triggers the camera only when needed, which saves power.
- Stack: YOLO, OpenCV, Python, Raspberry Pi, LiDAR
- Results: 92% detection accuracy in field validation across urban and forest environments; 25–35% lower power consumption
- [FILL: biggest challenge, e.g. sensor fusion or running on limited hardware]

## Project: Currency Authentication by Security-Feature Matching – Computer Vision
Verifies Indian banknotes by matching security features using ORB keypoints and SSIM (Structural Similarity Index) comparison. The approach extends to document and ID verification.
- Stack: Python, OpenCV, ORB, SSIM
- Result: 94% detection accuracy
- [FILL: GitHub link]

## Project: AI Voicebot – Generative AI
A conversational assistant supporting text and voice interaction, combining an LLM with text-to-speech, served through a Flask API for local deployment and testing.
- Stack: LLM, Flask, text-to-speech, Python
- [FILL: which LLM and speech-to-text, GitHub link]

## Sreehari Suresh's computer vision projects
Sreehari's computer vision projects are:
- Intelligent Traffic Signal Control: counts vehicles per lane in live video with YOLO and adjusts signal timing (98% vehicle detection accuracy in controlled tests).
- Hybrid LiDAR + Camera Safety System for caravans, built during his internship at Campervan Factory (92% detection accuracy in field validation, 25–35% lower power consumption).
- Currency Authentication: verifies Indian banknotes by matching security features with ORB keypoints and SSIM (94% detection accuracy).
- Traffic Sign Detection (YOLO, OpenCV, live video).
- Medical Image Analyzer (deep learning on medical images).
- Bone Break Classification.
- Game Avatar Control and AirMouse Cursor Control (gesture-based computer vision control).
[FILL (optional): one line each on how the smaller prototypes work, plus GitHub links]

## Sreehari Suresh's machine learning, NLP and Generative AI projects
Besides computer vision, Sreehari has built:
- Generative AI: the AI Voicebot (LLM with text-to-speech) and the RAG assistant on his portfolio.
- NLP: a Sentiment Analysis engine (text classification).
- Machine learning: Heart Health Prediction.
- Image processing: Image Steganography.
