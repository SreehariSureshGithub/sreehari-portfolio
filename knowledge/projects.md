# Sreehari Suresh – Projects

## Project: Portfolio AI Assistant (RAG chatbot) – overview
Sreehari built the AI assistant on his own portfolio website. This assistant, the chatbot visitors are talking to right now ("you", "this chatbot", "this bot", "this assistant"), is that project. Recruiters can ask it about his experience, skills and projects, and it answers only from a knowledge base Sreehari wrote himself. It uses Retrieval-Augmented Generation (RAG): his resume and project notes are split into chunks, the most relevant chunks are retrieved for each question, and an LLM answers only from that context. It runs entirely on free tiers, at $0 a month.
- Link: https://sreeharisuresh.vercel.app
- Code: https://github.com/SreehariSureshGithub/sreehari-portfolio

## Portfolio AI Assistant – how retrieval and generation work
- Retrieval is hybrid: open-source bge-small-en-v1.5 embeddings (384 dimensions) run inside the server function with transformers.js and ONNX Runtime, so no embedding API is needed. They are combined with BM25 keyword search, and the two ranked lists are merged with reciprocal rank fusion. The top chunks are passed to the model as its only source of facts.
- A small router model reads each message first: it rewrites follow-up questions into standalone search queries (resolving "it", "that" and "you" from the conversation) and turns away off-topic messages.
- Answers come from open-weight LLMs hosted on Groq, with gpt-oss-120b as the primary model and fallback models when it is unavailable. Answers are streamed token by token through an output guard.
- The four suggested questions in the chat window have answers prepared in advance, so they appear instantly.

## Portfolio AI Assistant – safety, honesty and testing
- It is designed to be honest about Sreehari: it answers only from his notes, and when the notes don't cover something it says so and offers his contact details instead of guessing. It never states that he has not done something unless his notes say so.
- Guardrails refuse off-topic requests and resist prompt-injection attempts, such as asking it to ignore its rules or reveal its instructions.
- Per-visitor rate limits, a daily usage cap and an answer cache run on Upstash Redis. These keep it within the free tiers and protect it from abuse.
- It is tested with an evaluation suite of questions and conversations, plus red-team security tests, which are rerun after changes.
- The site is built with TanStack Start (React 19, TypeScript) and deployed on Vercel. The server function runs in Frankfurt, next to the Upstash database.

## When did Sreehari build this AI assistant (this chatbot)?
Sreehari built this AI assistant, the chatbot on his portfolio, in November 2026.

## How did Sreehari build this AI assistant (this chatbot)?
Sreehari built this assistant: he set its goals and constraints ($0 to run, secure, honest about facts), chose its design, and tested it with an evaluation suite and red-team security tests.

## Project: Hybrid LiDAR + Camera Safety System – work project at Campervan Factory
A real-time obstacle warning prototype for caravans, built during Sreehari's internship at Campervan Factory (Nov 2024 – Jul 2025) on a Raspberry Pi.
- The problem: ultrasonic sensors alone raise false alarms on harmless objects such as leaves. The system separates real hazards from these false alarms.
- How it works: the LiDAR watches for obstacles, and the camera switches on only when the LiDAR detects something (event-triggered activation). The system then judges whether the obstacle could cause damage, based on its type and height, and warns the driver with visual and audio alerts.
- Results: 92% detection accuracy in field validation across urban and forest environments, and 25–35% lower power consumption thanks to the event-triggered camera.
- He validated the prototype in real-world conditions and tuned it iteratively.
- Stack: Python, OpenCV, YOLO, Raspberry Pi, LiDAR, camera modules.
- Code: private (company work).

## Project: Intelligent Traffic Signal Control – academic project, Computer Vision
An academic project: a live-video prototype that counts vehicles in each lane and adjusts traffic-signal timing dynamically. It gives more green time to high-volume lanes while enforcing a minimum wait time for every lane, so no lane is starved.
- Stack: Python, YOLO, OpenCV.
- Result: 98% vehicle detection accuracy in controlled tests.
- Code: not public.

## Project: VIN Reconciliation Pipeline – overview
A Python command-line tool (vinrecon) that Sreehari built as freelance work for a car dealership. Dealers track vehicles in a stock spreadsheet while their accounts live in QuickBooks, and the two drift apart: invoice numbers get typed with stray spaces, suppliers are left blank, a car is bought back and resold under the same VIN, and consignment owners need to know what they are owed. The tool reads the raw QuickBooks exports, the stock sheet and optional bank statements, and produces one Excel workbook that shows, for every deal: which QuickBooks bill and invoice it belongs to and how that link was made, value differences between the stock sheet and the books, open payables and receivables, the settlement owed for consignment deals, and a review queue for ambiguous cases.
- Stack: Python, pandas, openpyxl, PyYAML, pytest, ruff, GitHub Actions.
- Code: https://github.com/SreehariSureshGithub/vin-reconciliation-pipeline

## VIN Reconciliation Pipeline – how it works and design decisions
- One generic parser reads every QuickBooks "detail" report layout (General Ledger, supplier and customer balance detail, A/P and A/R ageing, purchases and sales detail).
- Each deal cycle is reconciled separately, so a VIN bought and sold several times never mixes values or reuses a bill or invoice across cycles.
- Every link is explainable and labelled: exact document reference, VIN (the VIN appears in exactly one document), or VIN plus amount.
- Stock-sheet and QuickBooks party names are kept side by side as independent facts and never "corrected" into each other. Fallback labels like "Cash Customer" are applied only as the very last step.
- Consignment settlement = collected amount − (dealer margin + VAT), using VIN-tagged bank receipts.
- Everything configurable (column names, keywords, tolerances, VAT rate) lives in one YAML file.
- Ambiguity is treated as output: if two invoices fit equally well, the cycle goes to the review queue with both candidates listed.

## VIN Reconciliation Pipeline – results and engineering quality
- Built from and validated against a real dealership's dataset of about 4,000 deal cycles and 4 years of ledgers.
- Agreement with the hand-verified results: purchase reference 99.5%, sale reference 99.2%, supplier 100%, buyer 99.2%, purchase value 100%, open payables 99.5%, open receivables 98.5%, final status 91.4% (100% for consignment, cancelled and purchase-only deals).
- About 450 lines of library code, a rewrite of an earlier 44-script version, with 19 end-to-end tests (one per business rule) and CI on Python 3.10–3.13. A synthetic dataset ships with the code; no real client data is published.
- Known limitations: party names are compared without fuzzy matching, bank receipts are matched only by the full 17-character VIN, and only Excel inputs and a single currency are supported.

## Project: Tiny Keyword Spotting – overview
A lightweight wake-word model Sreehari built from scratch in PyTorch. It listens to a one-second audio clip and decides whether someone said "stop". The model, TinyKWS, is a 3-layer CNN with 23,361 parameters (a 97 KB checkpoint), small enough for a Raspberry Pi or other edge devices.
- Results on 900 test clips from speakers never heard in training: 96.9% accuracy, 98.4% recall, 91.1% precision, F1 0.946, 3.7% false-alarm rate. It missed only 4 of 249 real "stop" clips.
- Speed: about 0.6 ms per clip for the model on a laptop CPU.
- Stack: Python, PyTorch, torchaudio, soundfile, Jupyter.
- Code: https://github.com/SreehariSureshGithub/tiny-keyword-spotting

## Tiny Keyword Spotting – how it works
- Audio preprocessing: any file (any sample rate, mono or stereo, WAV/FLAC/OGG) is converted to 16 kHz mono, padded or trimmed to exactly one second, and turned into a 40-band log-mel spectrogram (40 × 101).
- Model: three 3×3 convolution layers (16, 32 and 64 filters) with ReLU and max pooling, then global average pooling and a single output. Global average pooling instead of a large fully connected layer keeps the model tiny and tolerant to where the word appears in the clip.
- Data: Google Speech Commands, using the official speaker-independent splits, so no test speaker was heard during training.
- Training: "stop" is the minority class, so he used a weighted loss (pos_weight ≈ 2.7); without it the model learns to always answer "no". Augmentation adds random time shifts, gain changes and noise. Adam with a learning-rate scheduler and early stopping.
- A hard test: the word "step", which sounds like "stop", is correctly rejected.
- Next steps he identified: streaming over live microphone input, a noise/silence class, tuning the threshold, and exporting to ONNX with int8 quantisation for microcontrollers.

## Project: Fake Currency Detection – Computer Vision
A system that checks whether an Indian ₹500 or ₹2000 note is genuine from a photo, using classical image processing rather than deep learning. It was built in Python with Jupyter notebooks, OpenCV for image processing and Tkinter for the interface, using a custom-built dataset of real and fake note images that Sreehari also published on Kaggle.
- How it works: the note is checked against 10 security features. Seven are located with ORB keypoint matching and compared with reference templates using SSIM (structural similarity) scores; the bleed lines are counted from a thresholded image; and the serial-number panel is checked with contour detection.
- Interface: the user selects an image and its denomination in a GUI. A progress window follows, and the result window shows each feature's image, its average and maximum SSIM score, whether it passed or failed, and how many of the 10 features were verified.
- Stack: Python, OpenCV, NumPy, Matplotlib, Tkinter, Jupyter.
- Code: https://github.com/SreehariSureshGithub/Fake-Currency-Detection-System

## Project: Traffic Sign Recognition – Computer Vision
A Keras/TensorFlow convolutional neural network that classifies traffic sign images into 43 classes, such as speed limits, no entry, yield and pedestrian crossings. Images are resized to 30×30 pixels and passed through four convolutional layers with max pooling and dropout, trained for 15 epochs with a held-out validation split. A Tkinter desktop app loads the trained model, so a user can upload a sign image and see the predicted class. It classifies uploaded images; it does not run on live video.
- Stack: Python, TensorFlow, Keras, CNN, Tkinter.
- Code: https://github.com/SreehariSureshGithub/Traffic-Sign-Detection

## Project: Talking Chatbot – NLP
A desktop chatbot that understands typed messages, picks a reply and speaks it aloud. A small TensorFlow/Keras network (128 → 64 → softmax, with dropout) classifies each message into one of 26 intents, such as greetings, small talk, hobbies, movies, food and technology, using bag-of-words features. NLTK tokenisation, WordNet lemmatisation and WordNet synonym expansion help it understand phrasings it never saw. Predictions below 0.25 confidence are filtered out rather than answered at random. Replies are shown in a Tkinter chat window and spoken offline with pyttsx3.
- Stack: Python, TensorFlow/Keras, NLTK, NumPy, pyttsx3, Tkinter.
- Code: https://github.com/SreehariSureshGithub/Talking-Chatbot

## Sreehari Suresh's computer vision projects
- Hybrid LiDAR + Camera Safety System (Campervan Factory internship): 92% detection accuracy in field validation, 25–35% lower power consumption.
- Real-time particle counting at ISMO Bio-Photonics: YOLOv11s on line-scan imagery, optimised from 14 ms to 4 ms per frame on an NVIDIA Jetson Nano with ONNX and TensorRT.
- Intelligent Traffic Signal Control: counts vehicles per lane in live video with YOLO and adjusts signal timing (98% vehicle detection accuracy in controlled tests).
- Fake Currency Detection: checks Indian banknotes against 10 security features with ORB and SSIM.
- Explored but not completed: Bone Break Classification and gesture-based control ideas (Game Avatar Control and AirMouse Cursor Control). He researched these and analysed their feasibility, but did not build them to completion.
- Smaller learning projects: LeNet-5 implemented from scratch for MNIST digit classification, and Image Steganography.

## Sreehari Suresh's machine learning, NLP, audio and Generative AI projects
- Generative AI: the RAG assistant on his portfolio.
- Audio machine learning and edge AI: Tiny Keyword Spotting.
- Automation and data engineering: the VIN Reconciliation Pipeline.
- NLP: the Talking Chatbot (voice-enabled intent classifier).
- Machine learning: Heart Health Prediction.

## Where can I see Sreehari's projects?
His public code is on GitHub: https://github.com/sreeharisureshgithub. The LiDAR safety system and the traffic signal control project are not public.