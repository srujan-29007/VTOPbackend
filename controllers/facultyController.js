const db = require('../config/db');

exports.getClassStudents = async (req, res) => {
    const facultyId = req.user.id;
    const { classId } = req.params;

    try {
        const [classes] = await db.query(
            'SELECT * FROM classes WHERE id = ? AND faculty_id = ?', 
            [classId, facultyId]
        );

        if (classes.length === 0) {
            return res.status(403).json({ message: 'Access Denied: You do not teach this class.' });
        }

        const [students] = await db.query(
            `SELECT u.id, u.full_name, u.username, e.marks, e.grade 
             FROM enrollments e
             JOIN users u ON e.student_id = u.id
             WHERE e.class_id = ?`,
            [classId]
        );

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

const calculateGrade = (marks) => {
    if (marks >= 90) return 'S';
    if (marks >= 80) return 'A';
    if (marks >= 70) return 'B';
    if (marks >= 60) return 'C';
    if (marks >= 50) return 'D';
    return 'F';
};

exports.uploadMarks = async (req, res) => {
    const facultyId = req.user.id;
    const { studentId, classId, marks } = req.body;

    try {
        const [currentData] = await db.query(
            'SELECT grade FROM enrollments WHERE student_id = ? AND class_id = ?',
            [studentId, classId]
        );

        if (currentData.length === 0) return res.status(404).json({ message: 'Student not found' });

        if (currentData[0].grade) {
            const [request] = await db.query(
                `SELECT id FROM reevaluation_requests 
                 WHERE student_id = ? AND class_id = ? AND status = 'approved'`,
                [studentId, classId]
            );

            if (request.length === 0) {
                return res.status(403).json({ 
                    message: 'Grade is locked. Student must submit a re-evaluation request, and Admin must approve it.' 
                });
            }

            await db.query('UPDATE reevaluation_requests SET status = "completed" WHERE id = ?', [request[0].id]);
        }

        const newGrade = calculateGrade(marks);
        await db.query(
            'UPDATE enrollments SET marks = ?, grade = ? WHERE student_id = ? AND class_id = ?',
            [marks, newGrade, studentId, classId]
        );

        res.json({ message: 'Marks updated successfully', newGrade });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.uploadMaterial = async (req, res) => {
    const facultyId = req.user.id;
    const { courseCode, title } = req.body;
    const file = req.file; 

    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        await db.query(
            'INSERT INTO course_materials (course_code, faculty_id, title, file_path) VALUES (?, ?, ?, ?)',
            [courseCode, facultyId, title, file.path]
        );

        res.status(201).json({ message: 'File uploaded successfully', path: file.path });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.markAttendance = async (req, res) => {
    const facultyId = req.user.id;
    const { classId, absentStudentIds } = req.body; 

    try {
        const [classCheck] = await db.query(
            'SELECT id FROM classes WHERE id = ? AND faculty_id = ?', 
            [classId, facultyId]
        );
        if (classCheck.length === 0) return res.status(403).json({ message: 'Access Denied' });

        await db.query(
            'UPDATE enrollments SET classes_held = classes_held + 1 WHERE class_id = ?',
            [classId]
        );

        let query = 'UPDATE enrollments SET classes_attended = classes_attended + 1 WHERE class_id = ?';
        let params = [classId];

        if (absentStudentIds && absentStudentIds.length > 0) {
            query += ` AND student_id NOT IN (?)`;
            params.push(absentStudentIds);
        }

        await db.query(query, params);

        await db.query(
            `UPDATE enrollments 
             SET attendance_percentage = (classes_attended / classes_held) * 100 
             WHERE class_id = ?`,
            [classId]
        );

        res.json({ message: 'Attendance updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getClassStudents = async (req, res) => {
    const facultyId = req.user.id;
    const { classId } = req.params;

    try {
        const [classCheck] = await db.query(
            'SELECT id FROM classes WHERE id = ? AND faculty_id = ?',
            [classId, facultyId]
        );
        if (classCheck.length === 0) return res.status(403).json({ message: 'Access Denied: You do not teach this class' });

        const [students] = await db.query(
            `SELECT u.id, u.full_name, u.username, e.marks, e.grade, e.attendance_percentage 
             FROM enrollments e
             JOIN users u ON e.student_id = u.id
             WHERE e.class_id = ?`,
            [classId]
        );

        res.json(students);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};