/**
 * NK Solar Tech - Data Migration Script
 * 
 * USE THIS ONLY AFTER:
 * 1. You have Supabase configured
 * 2. You have created the database tables (see SETUP.md)
 * 3. You want to move local JSON data to Supabase
 * 
 * Run: node migrate-data.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️  Supabase not configured!');
    console.log('Please add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env file');
    console.log('See SETUP.md for instructions.');
    process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = path.join(__dirname, 'data');

async function migrate() {
    console.log('Starting migration...\n');
    
    // Migrate users
    console.log('📦 Migrating users...');
    try {
        const usersData = fs.readFileSync(path.join(DATA_DIR, 'users.json'), 'utf8');
        const users = JSON.parse(usersData);
        for (const user of users) {
            await supabase.from('users').upsert([{
                id: user.id,
                username: user.username,
                password: user.password,
                role: user.role || 'admin',
                created_at: user.createdAt || new Date().toISOString()
            }]);
        }
        console.log(`✓ Migrated ${users.length} users`);
    } catch (e) {
        console.log('  No users.json or empty');
    }
    
    // Migrate products
    console.log('📦 Migrating products...');
    try {
        const productsData = fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8');
        const products = JSON.parse(productsData);
        for (const product of products) {
            await supabase.from('products').upsert([{
                id: product.id,
                title: product.title,
                price: product.price || '',
                description: product.description || '',
                image: product.image || '',
                whatsapp_link: product.whatsappLink || '',
                created_at: product.createdAt || new Date().toISOString()
            }]);
        }
        console.log(`✓ Migrated ${products.length} products`);
    } catch (e) {
        console.log('  No products.json or empty');
    }
    
    // Migrate courses
    console.log('📦 Migrating courses...');
    try {
        const coursesData = fs.readFileSync(path.join(DATA_DIR, 'courses.json'), 'utf8');
        const courses = JSON.parse(coursesData);
        for (const course of courses) {
            await supabase.from('courses').upsert([{
                id: course.id,
                title: course.title,
                date: course.date || '',
                comments: course.comments || 0,
                description: course.description || '',
                content: course.content || '',
                image: course.image || '',
                created_at: course.createdAt || new Date().toISOString()
            }]);
        }
        console.log(`✓ Migrated ${courses.length} courses`);
    } catch (e) {
        console.log('  No courses.json or empty');
    }
    
    console.log('\n✅ Migration complete!');
}

migrate().catch(console.error);
