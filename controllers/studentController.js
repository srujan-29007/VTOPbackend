const db = require('../config/db');

exports.registerCourse = async (req, res) => {
    const studentId = req.user.id; 
    const { classId } = req.body; 

    if (!classId) return res.status(400).json({ message: 'Class ID is required' });

    const connection = await db.getConnection(); 

    try {
        await connection.beginTransaction();

        const [targetClass] = await connection.query(
            `SELECT c.slot, co.credits, co.code, c.available_seats 
             FROM classes c 
             JOIN courses co ON c.course_code = co.code 
             WHERE c.id = ? FOR UPDATE`, 
            [classId]
        );

        if (targetClass.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Class not found' });
        }
        
        const { slot: newSlot, credits: newCredits, available_seats: seats } = targetClass[0];

        if (seats <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Class is full (0 seats remaining)' });
        }

        const [myEnrollments] = await connection.query(
            `SELECT c.slot, co.credits 
             FROM enrollments e
             JOIN classes c ON e.class_id = c.id
             JOIN courses co ON c.course_code = co.code
             WHERE e.student_id = ?`,
            [studentId]
        );

        const hasClash = myEnrollments.some(enrollment => enrollment.slot === newSlot);
        if (hasClash) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `CLASH DETECTED: You already have a class in slot ${newSlot}` 
            });
        }

        const currentCredits = myEnrollments.reduce((sum, item) => sum + item.credits, 0);
        if (currentCredits + newCredits > 27) {
            await connection.rollback();
            return res.status(400).json({ 
                message: `CREDIT LIMIT EXCEEDED: You have ${currentCredits}, adding ${newCredits} would exceed 27.` 
            });
        }

        await connection.query(
            'INSERT INTO enrollments (student_id, class_id) VALUES (?, ?)',
            [studentId, classId]
        );

        await connection.query(
            'UPDATE classes SET available_seats = available_seats - 1 WHERE id = ?',
            [classId]
        );

        await connection.commit();
        res.status(200).json({ message: 'Course Registered Successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'You are already registered for this class' });
        }
        res.status(500).json({ message: 'Server Error' });
    } finally {
        connection.release();
    }
};

exports.requestReevaluation = async (req, res) => {
    const studentId = req.user.id;
    const { classId, reason } = req.body;

    try {
        const [enrollment] = await db.query(
            'SELECT grade FROM enrollments WHERE student_id = ? AND class_id = ?',
            [studentId, classId]
        );

        if (enrollment.length === 0) return res.status(404).json({ message: 'Not enrolled' });
        if (!enrollment[0].grade) return res.status(400).json({ message: 'No grade assigned yet' });

        const [existing] = await db.query(
            'SELECT * FROM reevaluation_requests WHERE student_id = ? AND class_id = ? AND status = "pending"',
            [studentId, classId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'You already have a pending request for this subject' });
        }

        await db.query(
            'INSERT INTO reevaluation_requests (student_id, class_id, reason) VALUES (?, ?, ?)',
            [studentId, classId, reason]
        );

        res.status(201).json({ message: 'Re-evaluation request submitted to Admin.' });

    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

exports.getCourseMaterials = async (req, res) => {
    const { courseCode } = req.params;

    try {
        const [materials] = await db.query(
            'SELECT title, file_path, uploaded_at FROM course_materials WHERE course_code = ?',
            [courseCode]
        );
        res.json(materials);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};


const SLOT_MAPPING = {
    'A1': [
        { day: 'Monday',    time: '08:00 AM - 08:50 AM' },
        { day: 'Wednesday', time: '09:00 AM - 09:50 AM' }
    ],
    'A2': [
        { day: 'Monday',    time: '02:00 PM - 02:50 PM' },
        { day: 'Wednesday', time: '03:00 PM - 03:50 PM' }
    ],
    'B1': [
        { day: 'Tuesday',   time: '08:00 AM - 08:50 AM' },
        { day: 'Thursday',  time: '09:00 AM - 09:50 AM' }
    ],
    'B2': [
        { day: 'Tuesday',   time: '02:00 PM - 02:50 PM' },
        { day: 'Thursday',  time: '03:00 PM - 03:50 PM' }
    ],
    'C1': [
        { day: 'Wednesday', time: '08:00 AM - 08:50 AM' },
        { day: 'Friday',    time: '09:00 AM - 09:50 AM' }
    ],
    'C2': [
        { day: 'Wednesday', time: '02:00 PM - 02:50 PM' },
        { day: 'Friday',    time: '03:00 PM - 03:50 PM' }
    ],
    'D1': [
        { day: 'Thursday',  time: '08:00 AM - 08:50 AM' },
        { day: 'Monday',    time: '10:00 AM - 10:50 AM' }
    ],
    'D2': [
        { day: 'Thursday',  time: '02:00 PM - 02:50 PM' },
        { day: 'Monday',    time: '04:00 PM - 04:50 PM' }
    ],
    'E1': [
        { day: 'Friday',    time: '08:00 AM - 08:50 AM' },
        { day: 'Tuesday',   time: '10:00 AM - 10:50 AM' }
    ],
    'E2': [
        { day: 'Friday',    time: '02:00 PM - 02:50 PM' }, 
        { day: 'Tuesday',   time: '04:00 PM - 04:50 PM' }  
    ],
    'F1': [
        { day: 'Monday',    time: '09:00 AM - 09:50 AM' },
        { day: 'Wednesday', time: '10:00 AM - 10:50 AM' }
    ],
    'F2': [
        { day: 'Monday',    time: '03:00 PM - 03:50 PM' },
        { day: 'Wednesday', time: '04:00 PM - 04:50 PM' }
    ],
    'G1': [
        { day: 'Tuesday',   time: '09:00 AM - 09:50 AM' },
        { day: 'Thursday',  time: '10:00 AM - 10:50 AM' }
    ],
    'G2': [
        { day: 'Tuesday',   time: '03:00 PM - 03:50 PM' },
        { day: 'Thursday',  time: '04:00 PM - 04:50 PM' }
    ],
    'TB1':  [{ day: 'Monday',   time: '11:00 AM - 11:50 AM' }],
    'TG1':  [{ day: 'Monday',   time: '12:00 PM - 12:50 PM' }],
    'TC1':  [{ day: 'Tuesday',  time: '11:00 AM - 11:50 AM' }],
    'TAA1': [{ day: 'Tuesday',  time: '12:00 PM - 12:50 PM' }],
    'V1':   [{ day: 'Wednesday',time: '11:00 AM - 11:50 AM' }],
    'V2':   [{ day: 'Wednesday',time: '12:00 PM - 12:50 PM' }],
    'TE1':  [{ day: 'Thursday', time: '11:00 AM - 11:50 AM' }],
    'TCC1': [{ day: 'Thursday', time: '12:00 PM - 12:50 PM' }],
    'TA1':  [{ day: 'Friday',   time: '10:00 AM - 10:50 AM' }],
    'TF1':  [{ day: 'Friday',   time: '11:00 AM - 11:50 AM' }],
    'TD1':  [{ day: 'Friday',   time: '12:00 PM - 12:50 PM' }],
    'TB2':  [{ day: 'Monday',   time: '05:00 PM - 05:50 PM' }],
    'TG2':  [{ day: 'Monday',   time: '06:00 PM - 06:50 PM' }],
    'TC2':  [{ day: 'Tuesday',  time: '05:00 PM - 05:50 PM' }],
    'TAA2': [{ day: 'Tuesday',  time: '06:00 PM - 06:50 PM' }],
    'TD2':  [{ day: 'Wednesday',time: '05:00 PM - 05:50 PM' }],
    'TBB2': [{ day: 'Wednesday',time: '06:00 PM - 06:50 PM' }],
    'TE2':  [{ day: 'Thursday', time: '05:00 PM - 05:50 PM' }],
    'TCC2': [{ day: 'Thursday', time: '06:00 PM - 06:50 PM' }],
    'TA2':  [{ day: 'Friday',   time: '04:00 PM - 04:50 PM' }],
    'TF2':  [{ day: 'Friday',   time: '05:00 PM - 05:50 PM' }],
    'TDD2': [{ day: 'Friday',   time: '06:00 PM - 06:50 PM' }],
    'V3':   [{ day: 'Monday',   time: '07:00 PM - 07:50 PM' }],
    'V4':   [{ day: 'Tuesday',  time: '07:00 PM - 07:50 PM' }],
    'V5':   [{ day: 'Wednesday',time: '07:00 PM - 07:50 PM' }],
    'V6':   [{ day: 'Thursday', time: '07:00 PM - 07:50 PM' }],
    'V7':   [{ day: 'Friday',   time: '07:00 PM - 07:50 PM' }],

    'L1': [{ day: 'Monday', time: '08:00 AM - 08:50 AM' }],
    'L2': [{ day: 'Monday', time: '08:51 AM - 09:40 AM' }],
    'L3': [{ day: 'Monday', time: '09:51 AM - 10:40 AM' }],
    'L4': [{ day: 'Monday', time: '10:41 AM - 11:30 AM' }],
    'L5': [{ day: 'Monday', time: '11:40 AM - 12:30 PM' }],
    'L6': [{ day: 'Monday', time: '12:31 PM - 01:20 PM' }],
    'L31': [{ day: 'Monday', time: '02:00 PM - 02:50 PM' }],
    'L32': [{ day: 'Monday', time: '02:51 PM - 03:40 PM' }],
    'L33': [{ day: 'Monday', time: '03:51 PM - 04:40 PM' }],
    'L34': [{ day: 'Monday', time: '04:41 PM - 05:30 PM' }],
    'L35': [{ day: 'Monday', time: '05:40 PM - 06:30 PM' }],
    'L36': [{ day: 'Monday', time: '06:31 PM - 07:20 PM' }],
    'L7':  [{ day: 'Tuesday', time: '08:00 AM - 08:50 AM' }],
    'L8':  [{ day: 'Tuesday', time: '08:51 AM - 09:40 AM' }],
    'L9':  [{ day: 'Tuesday', time: '09:51 AM - 10:40 AM' }],
    'L10': [{ day: 'Tuesday', time: '10:41 AM - 11:30 AM' }],
    'L11': [{ day: 'Tuesday', time: '11:40 AM - 12:30 PM' }],
    'L12': [{ day: 'Tuesday', time: '12:31 PM - 01:20 PM' }],
    'L37': [{ day: 'Tuesday', time: '02:00 PM - 02:50 PM' }],
    'L38': [{ day: 'Tuesday', time: '02:51 PM - 03:40 PM' }],
    'L39': [{ day: 'Tuesday', time: '03:51 PM - 04:40 PM' }],
    'L40': [{ day: 'Tuesday', time: '04:41 PM - 05:30 PM' }],
    'L41': [{ day: 'Tuesday', time: '05:40 PM - 06:30 PM' }],
    'L42': [{ day: 'Tuesday', time: '06:31 PM - 07:20 PM' }],
    'L13': [{ day: 'Wednesday', time: '08:00 AM - 08:50 AM' }],
    'L14': [{ day: 'Wednesday', time: '08:51 AM - 09:40 AM' }],
    'L15': [{ day: 'Wednesday', time: '09:51 AM - 10:40 AM' }],
    'L16': [{ day: 'Wednesday', time: '10:41 AM - 11:30 AM' }],
    'L17': [{ day: 'Wednesday', time: '11:40 AM - 12:30 PM' }],
    'L18': [{ day: 'Wednesday', time: '12:31 PM - 01:20 PM' }],
    'L43': [{ day: 'Wednesday', time: '02:00 PM - 02:50 PM' }],
    'L44': [{ day: 'Wednesday', time: '02:51 PM - 03:40 PM' }],
    'L45': [{ day: 'Wednesday', time: '03:51 PM - 04:40 PM' }],
    'L46': [{ day: 'Wednesday', time: '04:41 PM - 05:30 PM' }],
    'L47': [{ day: 'Wednesday', time: '05:40 PM - 06:30 PM' }],
    'L48': [{ day: 'Wednesday', time: '06:31 PM - 07:20 PM' }],
    'L19': [{ day: 'Thursday', time: '08:00 AM - 08:50 AM' }],
    'L20': [{ day: 'Thursday', time: '08:51 AM - 09:40 AM' }],
    'L21': [{ day: 'Thursday', time: '09:51 AM - 10:40 AM' }],
    'L22': [{ day: 'Thursday', time: '10:41 AM - 11:30 AM' }],
    'L23': [{ day: 'Thursday', time: '11:40 AM - 12:30 PM' }],
    'L24': [{ day: 'Thursday', time: '12:31 PM - 01:20 PM' }],
    'L49': [{ day: 'Thursday', time: '02:00 PM - 02:50 PM' }],
    'L50': [{ day: 'Thursday', time: '02:51 PM - 03:40 PM' }],
    'L51': [{ day: 'Thursday', time: '03:51 PM - 04:40 PM' }],
    'L52': [{ day: 'Thursday', time: '04:41 PM - 05:30 PM' }],
    'L53': [{ day: 'Thursday', time: '05:40 PM - 06:30 PM' }],
    'L54': [{ day: 'Thursday', time: '06:31 PM - 07:20 PM' }],
    'L25': [{ day: 'Friday', time: '08:00 AM - 08:50 AM' }],
    'L26': [{ day: 'Friday', time: '08:51 AM - 09:40 AM' }],
    'L27': [{ day: 'Friday', time: '09:51 AM - 10:40 AM' }],
    'L28': [{ day: 'Friday', time: '10:41 AM - 11:30 AM' }],
    'L29': [{ day: 'Friday', time: '11:40 AM - 12:30 PM' }],
    'L30': [{ day: 'Friday', time: '12:31 PM - 01:20 PM' }],
    'L55': [{ day: 'Friday', time: '02:00 PM - 02:50 PM' }],
    'L56': [{ day: 'Friday', time: '02:51 PM - 03:40 PM' }],
    'L57': [{ day: 'Friday', time: '03:51 PM - 04:40 PM' }],
    'L58': [{ day: 'Friday', time: '04:41 PM - 05:30 PM' }],
    'L59': [{ day: 'Friday', time: '05:40 PM - 06:30 PM' }],
    'L60': [{ day: 'Friday', time: '06:31 PM - 07:20 PM' }]
};

exports.viewTimetable = async (req, res) => {
    const studentId = req.user.id;

    try {
        const [enrollments] = await db.query(
            `SELECT co.code, co.name, c.slot, u.full_name as faculty
             FROM enrollments e
             JOIN classes c ON e.class_id = c.id
             JOIN courses co ON c.course_code = co.code
             JOIN users u ON c.faculty_id = u.id
             WHERE e.student_id = ?`,
            [studentId]
        );

        const timetable = enrollments.flatMap(item => {
            const sessions = SLOT_MAPPING[item.slot] || [];
            
            return sessions.map(session => ({
                courseCode: item.code,
                courseName: item.name,
                faculty: item.faculty,
                slot: item.slot,
                day: session.day,  
                time: session.time  
            }));
        });

        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5 };
        timetable.sort((a, b) => {
            if (dayOrder[a.day] !== dayOrder[b.day]) {
                return dayOrder[a.day] - dayOrder[b.day];
            }
            return a.time.localeCompare(b.time);
        });

        res.json(timetable);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};