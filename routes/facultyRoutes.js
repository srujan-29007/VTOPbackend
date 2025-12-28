const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController');
const { authenticateUser, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../config/uploadConfig');

router.use(authenticateUser, authorizeRoles('faculty'));

router.get('/students/:classId', 
    facultyController.getClassStudents
);

router.post('/upload-marks', 
    facultyController.uploadMarks
);

router.post('/upload-content', 
    upload.single('material'), 
    facultyController.uploadMaterial
);

router.post('/mark-attendance', 
    facultyController.markAttendance
);

router.get('/class-students/:classId', 
    facultyController.getClassStudents);

module.exports = router;