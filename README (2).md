# LearnSpace – Cloud-Based E-Learning Platform

A full-stack educational project built using HTML, CSS, JavaScript, Node.js, Express and SQLite.

## Features
- Student registration and login
- Password hashing using bcrypt
- JWT-based login sessions
- Course catalogue with search
- Course enrollment
- Lesson content access for enrolled students
- Mark lessons as completed
- Student learning dashboard with progress count
- Admin account can create courses and lessons
- SQLite database is created automatically
- Helmet security headers and API rate limiting

## Requirements
- Node.js 20 LTS recommended (Node.js 18 or later)
- npm
- Web browser

## Setup on Windows / VS Code

1. Extract the ZIP and open the project folder in VS Code.
2. Open Terminal → New Terminal.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create `.env` from the example:

   ```bash
   copy .env.example .env
   ```

5. Open `.env`. Change `JWT_SECRET` to a long random value (at least 32 characters). Set a private admin password of at least 12 characters in `ADMIN_PASSWORD`.

   To generate a JWT secret, run:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

6. Start the server:

   ```bash
   npm start
   ```

7. Open **http://localhost:3000**.
8. Register a student account and explore the sample courses.

## Admin login

The server creates an admin account at startup if `ADMIN_PASSWORD` is at least 12 characters long.

- Email: `ADMIN_USERNAME` + `@elearning.local`
- Example username: `admin` means email `admin@elearning.local`
- Password: the value you set in `.env` as `ADMIN_PASSWORD`

Change the example admin password before running. Do not share your `.env` file.

## Project folder structure

```text
cloud-based-e-learning-platform/
├── public/
│   ├── index.html       # Frontend page
│   ├── style.css        # Design and responsive layout
│   └── app.js           # Frontend logic and API calls
├── data/                # Created automatically; SQLite database
├── server.js            # Backend and REST API
├── package.json
├── .env.example
└── README.md
```

## API endpoints

| Method | Endpoint | Description | Login |
|---|---|---|---|
| POST | `/api/register` | Register student | No |
| POST | `/api/login` | Login and receive token | No |
| GET | `/api/courses` | View all courses | No |
| GET | `/api/courses/:id` | View course and lesson list | No |
| POST | `/api/courses/:id/enroll` | Enroll in a course | Yes |
| GET | `/api/my-courses` | View enrolled courses and progress | Yes |
| GET | `/api/courses/:courseId/lessons/:lessonId` | Read lesson | Yes, enrolled |
| POST | `/api/lessons/:lessonId/complete` | Mark lesson completed | Yes, enrolled |
| POST | `/api/admin/courses` | Create course and lessons | Admin |

Protected endpoints require `Authorization: Bearer <token>`.

## Database tables
- `users`: student and admin account details
- `courses`: course information
- `lessons`: lesson text linked to a course
- `enrollments`: student-to-course registrations
- `progress`: completed lessons for each student

## How the project works
1. A student creates an account and logs in.
2. The frontend requests course information from the Express backend.
3. The student chooses a course and enrolls.
4. The backend checks enrollment before showing lesson content.
5. When a student completes a lesson, the backend saves progress in SQLite.
6. An administrator can add new courses and lessons.

## Important note
This is a local, college-project demonstration of a cloud-style e-learning application. It runs on your computer by default; it is not automatically hosted on a public cloud. To deploy it as a real cloud application, host the Node.js server on a cloud platform, use a managed database, HTTPS, secure cookies, backups, monitoring and proper access controls. Do not use demo credentials in production.
