import traffic from "@/assets/proj-traffic.jpg";
import lidar from "@/assets/proj-lidar.jpg";

export { EMAIL, GITHUB, LINKEDIN, PHONE, RESUME_URL } from "./contact";

export const ROLES = [
  "AI Engineer",
  "ML Engineer",
  "Computer Vision Engineer",
  "Generative AI Engineer",
  "AI Automation Engineer",
  "Business Automation Engineer",
];

export const HERO_STATS = [
  { label: "AI / ML Projects", value: 10, suffix: "+" },
  { label: "Best Detection Accuracy", value: 98, suffix: "%" },
  { label: "Inference Latency Reduction", value: 71, suffix: "%" },
  { label: "Images Annotated", value: 2500, suffix: "+" },
];

export const INTERESTS = [
  "Computer Vision",
  "Machine Learning",
  "Generative AI",
  "Large Language Models",
  "AI Agents & RAG",
  "AI & Business Automation",
  "AI Product Development",
];

export const QUICK_FACTS = [
  { label: "Location", value: "Dubai, UAE" },
  { label: "Languages", value: "English, Malayalam, Hindi, Tamil" },
  { label: "Open to", value: "AI / ML / Computer Vision roles in the UAE" },
];

export const SKILL_GROUPS = [
  {
    title: "Computer Vision",
    skills: [
      "YOLO",
      "OpenCV",
      "Object Detection",
      "Image Processing",
      "Tracking",
      "Pose Estimation",
      "Real-time Inference",
    ],
  },
  {
    title: "Machine Learning",
    skills: ["PyTorch", "TensorFlow", "Scikit-Learn", "NumPy", "Pandas", "Model Evaluation"],
  },
  {
    title: "Generative AI",
    skills: ["LLMs", "RAG", "LangChain", "AI Agents", "Prompt Engineering", "NLP", "Chatbots"],
  },
  {
    title: "Embedded & AI Deployment",
    skills: [
      "Raspberry Pi",
      "TensorRT",
      "ONNX",
      "GPU Optimization",
      "LiDAR",
      "Real-time Deployment",
    ],
  },
  {
    title: "Software & Automation",
    skills: [
      "Python",
      "Flask",
      "REST APIs",
      "Databases",
      "Google Apps Script",
      "Git / GitHub",
      "Linux",
      "Workflow Automation",
    ],
  },
];

export const EXPERIENCE = [
  {
    role: "Freelance AI & Automation Engineer",
    company: "Independent (remote)",
    website: "https://sreehari-developer.vercel.app",
    period: "Aug 2025 — Jul 2026",
    highlights: [
      "Built automation systems and data pipelines for small businesses, end to end: requirements, build, launch and support",
      "Deckup Nutrition: WhatsApp lead handling and customer service with QuickReply, Google Apps Script and Google Sheets, handling 20–30 inbound leads a day with 24/7 automated replies",
      "Integrated Shopify so customers get order and shipping updates on WhatsApp automatically",
      "Car dealership: a Python pipeline reconciling the stock sheet against QuickBooks exports and bank statements per VIN and deal cycle, matching hand-verified results on 99.5% of purchase references",
    ],
  },
  {
    role: "AI Intern",
    company: "Campervan Factory Pvt Ltd, Chennai",
    website: "https://campervanfactory.com/",
    period: "Nov 2024 — Jul 2025",
    highlights: [
      "Designed a hybrid LiDAR + camera obstacle warning system for caravan safety, built as a Raspberry Pi prototype",
      "Separates real hazards from false alarms such as leaves, judging damage risk by obstacle type and height",
      "Visual and audio alerts to the driver, with real-time on-device inference",
      "92% detection accuracy in field validation across urban and forest environments",
      "Cut power consumption by 25–35% with event-triggered camera activation",
    ],
  },
  {
    role: "AI Intern",
    company: "ISMO Bio-Photonics Pvt Ltd, Chennai",
    website: "https://ismobiophotonics.com/",
    period: "Aug 2024 — Nov 2024",
    highlights: [
      "Worked on real-time particle counting from line-scan camera imagery",
      "Benchmarked YOLOv8–v11 on accuracy versus speed and chose YOLOv11s for the prototype",
      "Annotated 2,500+ line-scan images with segmentation masks and fine-tuned the model on them",
      "Cut median inference latency from 14 ms to 4 ms (71% faster) on an NVIDIA Jetson Nano with ONNX and TensorRT",
      "The optimised prototype was used for an investor demo",
    ],
  },
  {
    role: "Data Analyst Intern",
    company: "Kanini Software Solutions, Coimbatore",
    website: "https://www.kanini.com/",
    period: "Jul 2022 — Aug 2022",
    highlights: [
      "Cleaned and analysed datasets in R and Excel to support internal reporting and visualisation",
    ],
  },
];

/** Featured projects: shown with an image; `codeLabel` says why the code isn't on GitHub. */
export type WorkProject = {
  title: string;
  /** Small label shown above the title (rendered upper-case). */
  category: string;
  image: string;
  tags: string[];
  metric?: string;
  /** Shown on the right of the card instead of a GitHub link. */
  codeLabel: "Private code" | "Academic project";
  summary: string;
  detail: string;
};

/** Public repositories. Text is written only from each repo's README and code. */
export type OpenSourceProject = {
  title: string;
  category: string;
  url: string;
  language: string;
  tags: string[];
  summary: string;
  detail: string;
};

const GITHUB_REPO = (name: string) => `https://github.com/SreehariSureshGithub/${name}`;

export const GITHUB_REPOSITORIES_URL = "https://github.com/SreehariSureshGithub?tab=repositories";

export const WORK_PROJECTS: WorkProject[] = [
  {
    title: "Hybrid LiDAR + Camera Safety System",
    category: "Embedded AI",
    image: lidar,
    tags: ["YOLO", "OpenCV", "Raspberry Pi", "LiDAR"],
    metric: "92% accuracy",
    codeLabel: "Private code",
    summary: "Real-time obstacle warning prototype for caravans, built at Campervan Factory.",
    detail:
      "A real-time obstacle warning prototype for caravans on a Raspberry Pi, built during his internship at Campervan Factory. The LiDAR watches for obstacles and the camera switches on only when it detects something; the system then judges from the obstacle's type and height whether it could cause damage, and warns the driver with visual and audio alerts. It reached 92% detection accuracy in field validation across urban and forest environments, and the event-triggered camera cut power consumption by 25–35%.",
  },
  {
    title: "Intelligent Traffic Signal Control",
    category: "Computer Vision",
    image: traffic,
    tags: ["YOLO", "OpenCV", "Python"],
    metric: "98% detection accuracy",
    codeLabel: "Academic project",
    summary: "Counts vehicles per lane in live video and adjusts signal timing.",
    detail:
      "An academic project: a live-video prototype that counts vehicles in each lane with YOLO and adjusts traffic-signal timing dynamically. It gives more green time to high-volume lanes while enforcing a minimum wait time for every lane, so no lane is starved. It reached 98% vehicle detection accuracy in controlled tests.",
  },
];

export const OPEN_SOURCE_PROJECTS: OpenSourceProject[] = [
  {
    title: "Sreehari Portfolio",
    category: "GenAI",
    url: GITHUB_REPO("sreehari-portfolio"),
    language: "TypeScript",
    tags: ["RAG", "React", "TanStack Start", "Vercel"],
    summary: "This portfolio, with a RAG assistant that answers recruiters' questions about me.",
    detail:
      "The site you are on, with a floating chat assistant that answers questions about me using only a knowledge base I wrote myself. Each question goes through hybrid retrieval (local bge-small embeddings plus BM25, merged with rank fusion), and the top chunks go to Groq's gpt-oss-120b, with fallback models when it is unavailable. A small router model rewrites follow-up questions into standalone queries and turns away off-topic messages. Answers stream through an output guard, with per-visitor rate limits and an answer cache on Upstash Redis, all on free tiers.",
  },
  {
    title: "VIN Reconciliation Pipeline",
    category: "Automation",
    url: GITHUB_REPO("vin-reconciliation-pipeline"),
    language: "Python",
    tags: ["Data pipeline", "pandas", "QuickBooks", "Reconciliation"],
    summary:
      "Reconciles a car dealer's stock sheet against QuickBooks exports and bank statements, per VIN.",
    detail:
      "A Python command-line tool that reads raw QuickBooks report exports, a dealer's stock sheet and optional bank statements, and reconciles them per VIN and per deal cycle, so a car bought back and resold under the same VIN is handled cycle by cycle. Every link to a QuickBooks bill or invoice is labelled with how it was made (document reference, VIN, or VIN plus amount), and ambiguous cases go to a review queue instead of being guessed. It calculates consignment settlements and writes one Excel workbook with summary, reconciliation, settlement, discrepancy and review sheets. On the real dealership dataset it was built from (about 4,000 deal cycles), it matched the hand-verified results on 99.5% of purchase references and 100% of purchase values.",
  },
  {
    title: "Fake Currency Detection",
    category: "Computer Vision",
    url: GITHUB_REPO("Fake-Currency-Detection-System"),
    language: "Jupyter Notebook",
    tags: ["OpenCV", "ORB", "SSIM", "Image processing"],
    summary: "Checks Indian ₹500 and ₹2000 notes for counterfeits using image processing.",
    detail:
      "Jupyter notebooks that check a photo of an Indian ₹500 or ₹2000 note against 10 security features. Seven features are located with ORB keypoint matching and compared with reference templates using SSIM scores, the left and right bleed lines are counted from a thresholded image, and the serial number panel passes if contour detection finds 9 characters. A Tkinter GUI takes the image and denomination, then shows each feature's score, its pass or fail status, and how many of the 10 features were verified.",
  },
  {
    title: "Tiny Keyword Spotting",
    category: "Audio ML",
    url: GITHUB_REPO("tiny-keyword-spotting"),
    language: "Python",
    tags: ["PyTorch", "Keyword spotting", "torchaudio", "Edge AI"],
    summary: "A lightweight CNN that detects the spoken word “stop”, trained on Speech Commands.",
    detail:
      "A keyword-spotting model built from scratch in PyTorch that listens to a one-second clip and decides whether someone said “stop”. Audio at any sample rate is converted to 16 kHz mono and a 40-band log-mel spectrogram, then classified by a 3-layer CNN with about 23k parameters (a 97 KB checkpoint). It is trained on Google Speech Commands with speaker-independent splits, a weighted loss for class imbalance, and time-shift, gain and noise augmentation. On 900 test clips from unseen speakers it reaches 96.9% accuracy with 98.4% recall, and the repo includes scripts for data preparation, training, evaluation and prediction.",
  },
  {
    title: "Traffic Sign Recognition",
    category: "Computer Vision",
    url: GITHUB_REPO("Traffic-Sign-Detection"),
    language: "Jupyter Notebook",
    tags: ["TensorFlow", "Keras", "CNN", "Image classification"],
    summary: "A CNN that classifies traffic sign images, with a desktop GUI for uploads.",
    detail:
      "A Keras/TensorFlow convolutional neural network that classifies traffic sign images into 43 classes, such as speed limits, no entry, yield and pedestrian crossings. Images are resized to 30×30 pixels and passed through four convolutional layers with max pooling and dropout, trained for 15 epochs with a held-out validation split. A Tkinter desktop app loads the trained model, so you can upload a sign image and see the predicted class.",
  },
];

export const ACHIEVEMENTS = [
  { value: 92, suffix: "%", label: "Detection Accuracy" },
  { value: 98, suffix: "%", label: "Traffic Detection Accuracy" },
  { value: 71, suffix: "%", label: "Inference Latency Reduction" },
  { value: 2500, suffix: "+", label: "Images Annotated" },
  { value: 4, suffix: "ms", label: "Optimized Inference" },
];

export const EDUCATION = [
  {
    degree: "M.Sc Artificial Intelligence",
    school: "Sri Ramachandra Institute of Higher Education and Research",
    website: "https://sriramachandra.edu/",
    period: "2023 — 2025",
  },
  {
    degree: "B.Sc Artificial Intelligence and Machine Learning",
    school: "Sri Saraswathi Thyagaraja College",
    website: "https://www.stc.ac.in/",
    period: "2020 — 2023",
  },
];

export const CERTIFICATIONS = [
  "Deloitte Data Analytics Job Simulation",
  "Generative AI Mastermind",
  "Microsoft AI Classroom",
  "NUNNARI ML & DL Workshop",
  "GUVI AI Learnathon",
  "DevFest Google Developer Group",
];
