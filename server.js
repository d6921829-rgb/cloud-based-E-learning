require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "";
if (JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET in .env to a random value of at least 32 characters.");
  process.exit(1);
}
const DATA_DIR = path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "elearning.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'student',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 description TEXT NOT NULL,
 instructor TEXT NOT NULL,
 duration TEXT NOT NULL,
 level TEXT NOT NULL DEFAULT 'Beginner',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lessons (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 course_id INTEGER NOT NULL,
 title TEXT NOT NULL,
 content TEXT NOT NULL,
 position INTEGER NOT NULL,
 FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS enrollments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 course_id INTEGER NOT NULL,
 enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id, course_id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(course_id) REFERENCES courses(id)
);
CREATE TABLE IF NOT EXISTS progress (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 lesson_id INTEGER NOT NULL,
 completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id, lesson_id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(lesson_id) REFERENCES lessons(id)
);
`);

const courseCount = db.prepare("SELECT COUNT(*) AS n FROM courses").get().n;
if (!courseCount) {
  const insertCourse = db.prepare("INSERT INTO courses (title, category, description, instructor, duration, level) VALUES (?, ?, ?, ?, ?, ?)");
  const insertLesson = db.prepare("INSERT INTO lessons (course_id, title, content, position) VALUES (?, ?, ?, ?)");
  const seed = [
    ["Introduction to Cloud Computing", "Cloud Computing", "Learn cloud concepts, service models, deployment models and real-world cloud uses.", "Arun Kumar", "4 weeks", "Beginner", [
      ["What is Cloud Computing?", "Cloud computing provides computing services such as servers, storage, databases and software over the internet. It helps users access resources when needed."],
      ["Cloud Service Models", "IaaS provides infrastructure, PaaS provides a development platform, and SaaS provides ready-to-use software."],
      ["Cloud Deployment Models", "Public cloud is shared through a provider, private cloud is dedicated to one organization, and hybrid cloud combines both."]
    ]],
    ["Python Programming Basics", "Programming", "Understand Python variables, data types, conditions, loops and functions with simple examples.", "Meena Raj", "3 weeks", "Beginner", [
      ["Introduction to Python", "Python is a popular, easy-to-read programming language used in web development, automation, data science and AI."],
      ["Variables and Data Types", "Variables store values. Common data types include integer, float, string and boolean."],
      ["Conditions and Loops", "if statements help make decisions. for and while loops repeat a block of code."]
    ]],
    ["Web Development Fundamentals", "Web Development", "Build the foundation of websites using HTML, CSS and JavaScript.", "Priya Sharma", "5 weeks", "Beginner", [
      ["HTML Basics", "HTML defines the structure of a web page using elements such as headings, paragraphs, links and forms."],
      ["CSS Styling", "CSS controls colors, spacing, layout, fonts and responsive design."],
      ["JavaScript Basics", "JavaScript adds interaction to websites, such as form validation, menus and dynamic content."]
    ]],
    ["Introduction to Data Analytics", "Data Science", "Learn the basics of data, data cleaning, visualization and analytical thinking.", "Vijay Anand", "4 weeks", "Intermediate", [
      ["What is Data Analytics?", "Data analytics is the process of examining data to find useful information and support decisions."],
      ["Data Cleaning", "Data cleaning identifies and handles missing, duplicate, incorrect and inconsistent values."],
      ["Data Visualization", "Charts such as bar charts, line charts and pie charts help communicate patterns in data."]
    ]]
  ];
  const transaction = db.transaction(() => {
    for (const c of seed) {
      const result = insertCourse.run(...c.slice(0, 6));
      c[6].forEach((lesson, i) => insertLesson.run(result.lastInsertRowid, lesson[0], lesson[1], i + 1));
    }
  });
  transaction();
}

async function ensureAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "";
  if (password.length < 12) {
    console.warn("ADMIN_PASSWORD is not set to at least 12 characters. Admin account was not created.");
    return;
  }
  const email = `${username}@elearning.local`;
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run("Platform Admin", email, hash);
    console.log(`Demo admin created: ${email}`);
  }
}
ensureAdmin().catch(console.error);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false }));

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please log in." });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Session expired. Please log in again." }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
  next();
}

app.post("/api/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: "Name must be between 2 and 60 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must contain at least 8 characters." });
  try {
    const hash = await bcrypt.hash(password, 12);
    db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)").run(name, email, hash);
    res.status(201).json({ message: "Account created. Please log in." });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "An account with this email already exists." });
    res.status(500).json({ error: "Could not create account." });
  }
});
app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Incorrect email or password." });
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "4h" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get("/api/courses", (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, COUNT(DISTINCT l.id) AS lesson_count
    FROM courses c LEFT JOIN lessons l ON l.course_id = c.id
    GROUP BY c.id ORDER BY c.id DESC
  `).all();
  res.json(rows);
});
app.get("/api/courses/:id", (req, res) => {
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found." });
  const lessons = db.prepare("SELECT id, title, position FROM lessons WHERE course_id = ? ORDER BY position").all(course.id);
  res.json({ ...course, lessons });
});
app.post("/api/courses/:id/enroll", auth, (req, res) => {
  const course = db.prepare("SELECT id FROM courses WHERE id = ?").get(req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found." });
  try {
    db.prepare("INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)").run(req.user.id, course.id);
    res.status(201).json({ message: "You are enrolled in this course." });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "You are already enrolled." });
    res.status(500).json({ error: "Could not enroll." });
  }
});
app.get("/api/my-courses", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, e.enrolled_at, COUNT(DISTINCT l.id) AS lesson_count,
      COUNT(DISTINCT p.lesson_id) AS completed_count
    FROM enrollments e JOIN courses c ON c.id = e.course_id
    LEFT JOIN lessons l ON l.course_id = c.id
    LEFT JOIN progress p ON p.user_id = e.user_id AND p.lesson_id = l.id
    WHERE e.user_id = ? GROUP BY c.id ORDER BY e.enrolled_at DESC
  `).all(req.user.id);
  res.json(rows);
});
app.get("/api/courses/:courseId/lessons/:lessonId", auth, (req, res) => {
  const enrolled = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?").get(req.user.id, req.params.courseId);
  if (!enrolled) return res.status(403).json({ error: "Enroll in this course to access lessons." });
  const lesson = db.prepare("SELECT id, course_id, title, content, position FROM lessons WHERE id = ? AND course_id = ?").get(req.params.lessonId, req.params.courseId);
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });
  const completed = !!db.prepare("SELECT id FROM progress WHERE user_id = ? AND lesson_id = ?").get(req.user.id, lesson.id);
  res.json({ ...lesson, completed });
});
app.post("/api/lessons/:lessonId/complete", auth, (req, res) => {
  const lesson = db.prepare("SELECT * FROM lessons WHERE id = ?").get(req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });
  const enrolled = db.prepare("SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?").get(req.user.id, lesson.course_id);
  if (!enrolled) return res.status(403).json({ error: "You are not enrolled in this course." });
  db.prepare("INSERT OR IGNORE INTO progress (user_id, lesson_id) VALUES (?, ?)").run(req.user.id, lesson.id);
  res.json({ message: "Lesson marked as completed." });
});

app.post("/api/admin/courses", auth, adminOnly, (req, res) => {
  const { title, category, description, instructor, duration, level, lessons } = req.body;
  if (![title, category, description, instructor, duration].every(v => typeof v === "string" && v.trim())) return res.status(400).json({ error: "Fill in all course details." });
  if (!Array.isArray(lessons) || lessons.length < 1 || lessons.length > 30) return res.status(400).json({ error: "Add between 1 and 30 lessons." });
  const insertCourse = db.prepare("INSERT INTO courses (title, category, description, instructor, duration, level) VALUES (?, ?, ?, ?, ?, ?)");
  const insertLesson = db.prepare("INSERT INTO lessons (course_id, title, content, position) VALUES (?, ?, ?, ?)");
  try {
    const transaction = db.transaction(() => {
      const result = insertCourse.run(title.trim(), category.trim(), description.trim(), instructor.trim(), duration.trim(), String(level || "Beginner"));
      lessons.forEach((l, i) => {
        if (!l.title || !l.content) throw new Error("Every lesson needs a title and content.");
        insertLesson.run(result.lastInsertRowid, String(l.title).trim(), String(l.content).trim(), i + 1);
      });
      return result.lastInsertRowid;
    });
    res.status(201).json({ message: "Course created.", id: transaction() });
  } catch (e) { res.status(400).json({ error: e.message || "Could not create course." }); }
});

app.listen(PORT, () => console.log(`E-Learning Platform running at http://localhost:${PORT}`));
