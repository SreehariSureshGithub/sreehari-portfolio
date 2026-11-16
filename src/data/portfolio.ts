import traffic from "@/assets/proj-traffic.jpg";
import lidar from "@/assets/proj-lidar.jpg";
import currency from "@/assets/proj-currency.jpg";
import voicebot from "@/assets/proj-voicebot.jpg";
import medical from "@/assets/proj-medical.jpg";
import sentiment from "@/assets/proj-sentiment.jpg";
import signs from "@/assets/proj-signs.jpg";

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

export const SKILL_GROUPS = [
  {
    title: "Computer Vision",
    icon: "Eye",
    skills: [
      { name: "YOLO", level: 95 },
      { name: "OpenCV", level: 93 },
      { name: "Object Detection", level: 94 },
      { name: "Image Processing", level: 90 },
      { name: "Tracking", level: 86 },
      { name: "Pose Estimation", level: 78 },
      { name: "Real-time Inference", level: 91 },
    ],
  },
  {
    title: "Machine Learning",
    icon: "Brain",
    skills: [
      { name: "PyTorch", level: 90 },
      { name: "TensorFlow", level: 85 },
      { name: "Scikit-Learn", level: 88 },
      { name: "NumPy", level: 92 },
      { name: "Pandas", level: 90 },
      { name: "Model Evaluation", level: 89 },
    ],
  },
  {
    title: "Generative AI",
    icon: "Sparkles",
    skills: [
      { name: "LLMs", level: 85 },
      { name: "RAG", level: 80 },
      { name: "LangChain", level: 78 },
      { name: "AI Agents", level: 76 },
      { name: "Prompt Engineering", level: 88 },
      { name: "NLP", level: 84 },
      { name: "Chatbots", level: 87 },
    ],
  },
  {
    title: "Embedded & AI Deployment",
    icon: "Cpu",
    skills: [
      { name: "Raspberry Pi", level: 90 },
      { name: "TensorRT", level: 84 },
      { name: "ONNX", level: 86 },
      { name: "GPU Optimization", level: 82 },
      { name: "LiDAR", level: 85 },
      { name: "Real-time Deployment", level: 91 },
    ],
  },
  {
    title: "Software & Automation",
    icon: "Terminal",
    skills: [
      { name: "Python", level: 95 },
      { name: "Flask", level: 84 },
      { name: "REST APIs", level: 82 },
      { name: "Databases", level: 78 },
      { name: "Google Apps Script", level: 82 },
      { name: "Git / GitHub", level: 88 },
      { name: "Linux", level: 86 },
      { name: "Workflow Automation", level: 84 },
    ],
  },
];

export const EXPERIENCE = [
  {
    role: "Freelance AI Engineer",
    company: "Independent",
    website: "https://sreehari-developer.vercel.app",
    period: "Aug 2025 — Jul 2026",
    highlights: [
      "Delivered AI and ML solutions across Computer Vision, NLP and Generative AI use cases",
      "Built LLM-based chatbots and scripted conversational workflows",
      "Designed WhatsApp business automation using QuickReply, Google Sheets and Google Apps Script",
      "Integrated Shopify with lead qualification, product recommendation, customer/order management and follow-up workflows",
    ],
  },
  {
    role: "AI Intern",
    company: "Campervan Factory Pvt Ltd, Chennai",
    website: "https://campervanfactory.com/",
    period: "Nov 2024 — Jul 2025",
    highlights: [
      "Designed and deployed a hybrid LiDAR + camera obstacle detection system for caravan safety",
      "Integrated Raspberry Pi, sensors and camera modules for real-time AI inference",
      "Implemented visual and audio alerting using OpenCV and Python",
      "Achieved 92% detection accuracy across urban and forest environments",
      "Reduced power consumption by 25–35% through intelligent camera activation logic",
      "Conducted real-world validation and iterative performance tuning",
    ],
  },
  {
    role: "AI Intern",
    company: "ISMO Bio-Photonics Pvt Ltd, Chennai",
    website: "https://ismobiophotonics.com/",
    period: "Aug 2024 — Nov 2024",
    highlights: [
      "Developed YOLO-based object detection pipelines for dynamic video environments",
      "Optimized inference using GPU acceleration with ONNX and TensorRT",
      "Reduced median inference latency from 14ms to 4ms, a 71% improvement",
      "Curated and labeled 7,500+ training images",
      "Built real-time video tracking pipelines and performance benchmarks",
    ],
  },
  {
    role: "Data Analyst Intern",
    company: "Kanini Software Solutions, Coimbatore",
    website: "https://www.kanini.com/",
    period: "Jul 2022 — Aug 2022",
    highlights: [
      "Data cleaning and exploratory analysis in R and Excel",
      "Supported internal reporting and visualization workflows",
    ],
  },
];

export type Project = {
  title: string;
  category: "Computer Vision" | "Embedded AI" | "GenAI" | "Machine Learning";
  image: string;
  tags: string[];
  metric?: string;
  summary: string;
  detail: string;
};

export const PROJECTS: Project[] = [
  {
    title: "Intelligent Traffic Management",
    category: "Computer Vision",
    image: traffic,
    tags: ["YOLO", "OpenCV", "Python"],
    metric: "98% detection accuracy",
    summary: "Dynamic traffic signal optimization from live video.",
    detail:
      "A YOLO-based prototype that processes live video to count vehicles and dynamically adjust signal timings. Achieved 98% detection accuracy in controlled tests, prioritizing high-volume lanes while guaranteeing fairness through minimum wait times.",
  },
  {
    title: "Hybrid LiDAR + Camera Safety System",
    category: "Embedded AI",
    image: lidar,
    tags: ["YOLO", "TensorRT", "OpenCV", "Raspberry Pi"],
    metric: "92% accuracy",
    summary: "Real-time obstacle detection for caravan safety.",
    detail:
      "Fused LiDAR range data with camera detections on a Raspberry Pi for real-time obstacle alerting. Delivered visual and audio warnings, validated across urban and forest environments, and cut power draw 25–35% with intelligent camera activation logic.",
  },
  {
    title: "Fake Currency Detection",
    category: "Computer Vision",
    image: currency,
    tags: ["ORB", "SSIM", "Python"],
    metric: "94% detection accuracy",
    summary: "Automated forgery detection for Indian currency.",
    detail:
      "Verifies security features such as bleed lines, security threads and watermarks using ORB keypoint matching and SSIM comparison, achieving 94% detection accuracy on forged notes.",
  },
  {
    title: "AI Voicebot",
    category: "GenAI",
    image: voicebot,
    tags: ["LLM", "NLP", "Flask", "TTS"],
    metric: "Text + voice interaction",
    summary: "Conversational assistant with text and voice interaction.",
    detail:
      "Combines NLP, deep learning models and text-to-speech to hold natural conversations across text and voice. Deployed with Flask for local testing and visual inference.",
  },
  {
    title: "Medical Image Analyzer",
    category: "Machine Learning",
    image: medical,
    tags: ["Computer Vision", "Deep Learning"],
    summary: "Deep learning analysis of medical imagery.",
    detail:
      "Exploratory deep learning pipeline for analyzing medical scans — preprocessing, augmentation, model training and evaluation with precision/recall reporting.",
  },
  {
    title: "Sentiment Analysis",
    category: "Machine Learning",
    image: sentiment,
    tags: ["NLP", "ML"],
    summary: "Text sentiment classification pipeline.",
    detail:
      "End-to-end NLP prototype covering tokenization, embeddings and classifier training to score sentiment polarity across customer text data.",
  },
  {
    title: "Traffic Sign Detection",
    category: "Computer Vision",
    image: signs,
    tags: ["YOLO", "OpenCV"],
    summary: "Road sign recognition in live video.",
    detail:
      "YOLO detector trained to recognize road signage in varied lighting, with a real-time OpenCV inference loop and benchmarked frame latency.",
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
