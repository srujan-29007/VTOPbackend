# University Portal Backend (VTOP Clone)

A comprehensive backend system for a university management portal inspired by VTOP. 

## Features

* **Role-Based Access Control (RBAC):** Distinct capabilities for Admins, Students, Faculty, and Parents.
* **JWT Authentication:** Secure, stateless login for all users.
* **Smart Course Registration:**
    * Checks for Slot Clashes (e.g., cannot book two classes in Slot A1).
    * Enforces Credit Limits (Max 27 credits per semester).
    * Manages Seat Availability (Concurrency-safe database transactions).
* **Timetable Generation:** Automatically maps abstract slots (e.g., "A1", "L31") to real-world days and times using a complex mapping algorithm.
* **Re-evaluation Workflow:** Students can request grade reviews; Faculty can only edit grades after Admin approval.
* **Parent Portal:** Parents can view their linked child's live marks, grades, attendance, and timetable.
* **File Handling:** Faculty can upload course materials; Students can download them.

## Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MySQL
* **Authentication:** JSON Web Tokens (JWT) + bcryptjs
* **File Uploads:** Multer

## Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/srujan-29007/VTOPbackend.git
    cd VTOPBACKEND
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Database Setup**
    * Ensure MySQL is running.
    * Open `config/db.js` and update your MySQL `user` and `password`.
    * Run the provided SQL script in database_setup.sql to create tables.

4. Create Super Admin
    To securely create your first Admin user
    ```bash
    node seedAdmin.js
    ``` 

5.  **Start the Server**
    ```bash
    node server.js
    ```
    The server will start on `http://localhost:3000`.

## Default Super Admin Credentials

* **Super Admin:** `superadmin`
* **Password:** `admin123`

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Login and receive JWT token. Returns user role. |

### Admin
*Requires Header:* `Authorization: Bearer <admin_token>`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/create-user` | Create Faculty, Student, or Parent accounts. (Parents require `child_username`). |
| `POST` | `/api/admin/create-course` | Create a new subject (e.g., "CSE101"). |
| `POST` | `/api/admin/open-class` | Assign a course to a faculty in a specific slot (e.g., "CSE101" to "Dr. Strange" in "A1"). |
| `POST` | `/api/admin/handle-reeval` | Approve or Reject a student's re-evaluation request. |

### Student
*Requires Header:* `Authorization: Bearer <student_token>`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/student/register` | Register for a class. Checks for credits, clashes, and seats. |
| `GET` | `/api/student/timetable` | View personalized weekly timetable with Day/Time mappings. |
| `POST` | `/api/student/request-reeval` | Submit a request to review a grade. |
| `GET` | `/api/student/materials/:courseCode` | View list of uploaded files for a specific course. |

### Faculty
*Requires Header:* `Authorization: Bearer <faculty_token>`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/faculty/class-students/:classId` | View list of all students enrolled in a specific class. |
| `POST` | `/api/faculty/mark-attendance` | Mark attendance. Updates "Classes Held" for all, and "Attended" for present students. |
| `POST` | `/api/faculty/upload-marks` | Upload/Update marks. (Locked if re-eval request exists but isn't approved). |
| `POST` | `/api/faculty/upload-content` | Upload course material (PDFs/Images). |

### Parent
*Requires Header:* `Authorization: Bearer <parent_token>`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/parent/my-child` | View linked child's marks, grades, and attendance percentage. |
| `GET` | `/api/parent/child-timetable` | View linked child's complete weekly timetable. |

---

## Project Structure

```text
university-portal-backend/
├── config/             # Database & Upload configurations
├── controllers/        # Business logic for each role
├── middleware/         # Auth & Role verification
├── routes/             # API Route definitions
├── utils/              # Helper files (e.g., Slot Mapping)
├── uploads/            # Storage for uploaded files
├── server.js           # Entry point
└── README.md           # Documentation