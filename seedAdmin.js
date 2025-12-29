require('dotenv').config(); 
const db = require('./config/db');
const bcrypt = require('bcryptjs');

const seedSuperAdmin = async () => {
    
    try {
        const username = 'superadmin';
        const plainPassword = 'admin123';
        const role = 'admin';
        const fullName = 'System Administrator';

        const [existing] = await db.query(
            'SELECT * FROM users WHERE username = ?', 
            [username]
        );

        if (existing.length > 0) {
            console.log("Super Admin already exists. Skipping.");
            return; 
        }

        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        await db.query(
            'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, role, fullName]
        );

        console.log("Super Admin created successfully!");
        console.log(`Username: ${username}`);
        console.log(`Password: ${plainPassword}`);

    } catch (error) {
        console.error("Seed Failed:", error);
    } finally {
        process.exit();
    }
};

seedSuperAdmin();