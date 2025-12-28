const db = require('../config/db');
const bcrypt = require('bcryptjs');

exports.createUser = async (req, res) => {
    const { username, password, role, full_name, child_username } = req.body;

    if (!username || !password || !role || !full_name) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (role === 'parent' && !child_username) {
        return res.status(400).json({ message: 'To create a Parent, you must provide a child_username' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction(); 

        let childId = null;
        if (role === 'parent') {
            const [students] = await connection.query(
                'SELECT id FROM users WHERE username = ? AND role = "student"', 
                [child_username]
            );
            if (students.length === 0) {
                throw new Error('Child student not found!'); 
            }
            childId = students[0].id;
        }

        const [existing] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            throw new Error('User already exists');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.query(
            'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, role, full_name]
        );
        
        const newUserId = userResult.insertId;

        if (role === 'parent') {
            await connection.query(
                'INSERT INTO parent_student_map (parent_id, student_id) VALUES (?, ?)',
                [newUserId, childId]
            );
        }

        await connection.commit(); 
        res.status(201).json({ message: `User (${role}) created and linked successfully` });

    } catch (err) {
        await connection.rollback(); 
        console.error(err);
        res.status(400).json({ message: err.message || 'Server Error' });
    } finally {
        connection.release(); 
    }
};

exports.handleReevaluation = async (req, res) => {
    const { requestId, status } = req.body; 

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    try {
        const [result] = await db.query(
            'UPDATE reevaluation_requests SET status = ? WHERE id = ?',
            [status, requestId]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Request not found' });

        res.json({ message: `Request marked as ${status}` });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.createCourse = async (req, res) => {
    const { code, name, credits } = req.body;

    if (!code || !name || !credits) {
        return res.status(400).json({ message: 'All fields (code, name, credits) are required' });
    }

    try {
        const [existing] = await db.query('SELECT * FROM courses WHERE code = ?', [code]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Course code already exists' });
        }

        await db.query(
            'INSERT INTO courses (code, name, credits) VALUES (?, ?, ?)',
            [code, name, credits]
        );

        res.status(201).json({ message: `Course ${code} created successfully` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.openClass = async (req, res) => {
    const { courseCode, facultyId, slot, totalSeats } = req.body;

    if (!courseCode || !facultyId || !slot || !totalSeats) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const [course] = await db.query('SELECT * FROM courses WHERE code = ?', [courseCode]);
        if (course.length === 0) return res.status(404).json({ message: 'Course not found' });

        const [faculty] = await db.query('SELECT * FROM users WHERE id = ? AND role = "faculty"', [facultyId]);
        if (faculty.length === 0) return res.status(404).json({ message: 'Faculty not found' });

        const [clash] = await db.query(
            'SELECT * FROM classes WHERE faculty_id = ? AND slot = ?',
            [facultyId, slot]
        );
        if (clash.length > 0) {
            return res.status(400).json({ message: 'This faculty is already teaching another class in this slot!' });
        }

        await db.query(
            'INSERT INTO classes (course_code, faculty_id, slot, total_seats, available_seats) VALUES (?, ?, ?, ?, ?)',
            [courseCode, facultyId, slot, totalSeats, totalSeats]
        );

        res.status(201).json({ message: `Class opened for ${courseCode} in slot ${slot}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};