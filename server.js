/**
 * NK Solar Tech - Backend Server with Supabase Support
 * 
 * HOSTING: Deploy this folder to Render.com (Free)
 * 
 * SETUP:
 * 1. Run: npm install
 * 2. Run: node server.js
 * 
 * WITH SUPABASE:
 * 1. Create account at https://supabase.com (FREE)
 * 2. Create new project
 * 3. Copy .env.example to .env
 * 4. Add your Supabase URL and Key to .env
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================================================
// SUPABASE CONFIGURATION
// ========================================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const useSupabase = supabaseUrl && supabaseKey;

let supabaseClient = null;

if (useSupabase) {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Supabase connected');
} else {
    console.log('⚠️  Supabase not configured (using local JSON files)');
}

// ========================================================================
// CORS CONFIGURATION (Important for GitHub Pages!)
// ========================================================================

// Your GitHub Pages URL - CHANGE THIS to your actual GitHub Pages URL!
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CLIENT_URL);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// ========================================================================
// MIDDLEWARE
// ========================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
    secret: process.env.JWT_SECRET || 'nk-solar-tech-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static('public'));
app.use('/videos', express.static(__dirname));

// Session
app.use(session({
    secret: process.env.JWT_SECRET || 'nk-solar-tech-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file) return cb(null, true);
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error('Only image files are allowed!'));
    }
});

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

// Read data from local JSON
const readData = (filename) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', filename), 'utf8'));
    } catch (err) {
        return [];
    }
};

// Write data to local JSON
const writeData = (filename, data) => {
    fs.writeFileSync(path.join(__dirname, 'data', filename), JSON.stringify(data, null, 2));
};

// Upload image to Supabase Storage
async function uploadToSupabase(buffer, originalName, mimeType) {
    if (!supabaseClient) throw new Error('Supabase not configured');
    
    const fileId = uuidv4();
    const ext = path.extname(originalName);
    const filePath = `products/${fileId}${ext}`;
    
    const { data, error } = await supabaseClient.storage
        .from('product-images')
        .upload(filePath, buffer, { contentType: mimeType });
    
    if (error) throw error;
    
    const { data: urlData } = supabaseClient.storage
        .from('product-images')
        .getPublicUrl(filePath);
    
    return urlData.publicUrl;
}

// Delete image from Supabase
async function deleteFromSupabase(imageUrl) {
    if (!supabaseClient || !imageUrl) return;
    
    try {
        const parts = imageUrl.split('/');
        const filename = parts.slice(-2).join('/');
        await supabaseClient.storage.from('product-images').remove([filename]);
    } catch (err) {
        console.warn('Could not delete image:', err.message);
    }
}

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized. Please login.' });
    }
};

// ========================================================================
// AUTH ROUTES
// ========================================================================

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (useSupabase) {
        // Use Supabase database
        supabaseClient.from('users').select('*')
            .eq('username', username).limit(1)
            .then(({ data, error }) => {
                if (error || data.length === 0 || data[0].password !== password) {
                    return res.status(401).json({ success: false, error: 'Invalid credentials' });
                }
                req.session.userId = data[0].id;
                req.session.username = data[0].username;
                res.json({ success: true, message: 'Login successful' });
            });
    } else {
        // Use local JSON
        const users = readData('users.json');
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            req.session.userId = user.id;
            req.session.username = user.username;
            res.json({ success: true, message: 'Login successful' });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// ========================================================================
// PRODUCTS ROUTES
// ========================================================================

app.get('/api/products', (req, res) => {
    if (useSupabase) {
        supabaseClient.from('products').select('*').order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) return res.status(500).json({ error: error.message });
                res.json(data || []);
            });
    } else {
        res.json(readData('products.json'));
    }
});

app.post('/api/products', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, price, description, whatsappLink } = req.body;
        let imageUrl = req.body.image || '';
        
        // Upload to Supabase if configured and file provided
        if (useSupabase && req.file) {
            imageUrl = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        
        const newProduct = {
            id: `prod-${uuidv4().substring(0, 8)}`,
            title,
            price: price || '',
            description: description || '',
            image: imageUrl,
            whatsappLink: whatsappLink || `https://wa.me/233501234567?text=Hello%20NK%20Solar%2C%20I%20want%20to%20buy%20${encodeURIComponent(title)}`,
            createdAt: new Date().toISOString()
        };
        
        if (useSupabase) {
            const { data, error } = await supabaseClient.from('products')
                .insert([{ id: newProduct.id, title, price: price || '', description: description || '', image: imageUrl, whatsapp_link: newProduct.whatsappLink, created_at: new Date().toISOString() }])
                .select().single();
            if (error) throw error;
            res.json({ success: true, product: data });
        } else {
            const products = readData('products.json');
            products.push(newProduct);
            writeData('products.json', products);
            res.json({ success: true, product: newProduct });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, price, description, whatsappLink } = req.body;
        
        if (useSupabase) {
            const { data: existing } = await supabaseClient.from('products').select('*').eq('id', id).single();
            if (!existing) return res.status(404).json({ error: 'Not found' });
            
            let imageUrl = existing.image;
            if (req.file) {
                if (imageUrl) await deleteFromSupabase(imageUrl);
                imageUrl = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
            }
            
            const { data, error } = await supabaseClient.from('products')
                .update({ title, price, description, image: imageUrl, whatsapp_link: whatsappLink, updated_at: new Date().toISOString() })
                .eq('id', id).select().single();
            if (error) throw error;
            res.json({ success: true, product: data });
        } else {
            const products = readData('products.json');
            const index = products.findIndex(p => p.id === id);
            if (index === -1) return res.status(404).json({ error: 'Not found' });
            
            if (req.file) {
                const oldImage = products[index].image;
                if (oldImage && oldImage.startsWith('/uploads/')) {
                    try { fs.unlinkSync(path.join(__dirname, 'public', oldImage)); } catch (e) {}
                }
                products[index].image = `/uploads/${req.file.filename}`;
            }
            
            products[index] = { ...products[index], title, price, description, whatsappLink, updatedAt: new Date().toISOString() };
            writeData('products.json', products);
            res.json({ success: true, product: products[index] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (useSupabase) {
            const { data: product } = await supabaseClient.from('products').select('image').eq('id', id).single();
            if (product?.image) await deleteFromSupabase(product.image);
            const { error } = await supabaseClient.from('products').delete().eq('id', id);
            if (error) throw error;
            res.json({ success: true, message: 'Deleted' });
        } else {
            const products = readData('products.json');
            const product = products.find(p => p.id === id);
            if (product?.image && product.image.startsWith('/uploads/')) {
                try { fs.unlinkSync(path.join(__dirname, 'public', product.image)); } catch (e) {}
            }
            writeData('products.json', products.filter(p => p.id !== id));
            res.json({ success: true, message: 'Deleted' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================================
// COURSES ROUTES
// ========================================================================

app.get('/api/courses', (req, res) => {
    if (useSupabase) {
        supabaseClient.from('courses').select('*').order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (error) return res.status(500).json({ error: error.message });
                res.json(data || []);
            });
    } else {
        res.json(readData('courses.json'));
    }
});

app.post('/api/courses', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, date, comments, description, content } = req.body;
        let imageUrl = req.body.image || '';
        
        if (useSupabase && req.file) {
            imageUrl = await uploadToSupabase(req.file.buffer, req.file.originalname, req.file.mimetype);
        }
        
        const newCourse = {
            id: `course-${uuidv4().substring(0, 8)}`,
            title,
            date: date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            comments: parseInt(comments) || 0,
            description: description || '',
            content: content || '',
            image: imageUrl,
            createdAt: new Date().toISOString()
        };
        
        if (useSupabase) {
            const { data, error } = await supabaseClient.from('courses')
                .insert([{ id: newCourse.id, title, date: newCourse.date, comments: newCourse.comments, description, content, image: imageUrl, created_at: new Date().toISOString() }])
                .select().single();
            if (error) throw error;
            res.json({ success: true, course: data });
        } else {
            const courses = readData('courses.json');
            courses.push(newCourse);
            writeData('courses.json', courses);
            res.json({ success: true, course: newCourse });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/courses/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (useSupabase) {
            const { data: course } = await supabaseClient.from('courses').select('image').eq('id', id).single();
            if (course?.image) await deleteFromSupabase(course.image);
            const { error } = await supabaseClient.from('courses').delete().eq('id', id);
            if (error) throw error;
            res.json({ success: true, message: 'Deleted' });
        } else {
            const courses = readData('courses.json');
            const course = courses.find(c => c.id === id);
            if (course?.image && course.image.startsWith('/uploads/')) {
                try { fs.unlinkSync(path.join(__dirname, 'public', course.image)); } catch (e) {}
            }
            writeData('courses.json', courses.filter(c => c.id !== id));
            res.json({ success: true, message: 'Deleted' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================================
// PAGE ROUTES (Optional - for standalone backend, you can remove these)
// ========================================================================

// Remove or comment out the root route since this is just an API server
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

app.get('/admin', (req, res) => {
    if (req.session && req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
    } else {
        res.redirect('/admin-login.html');
    }
});

app.get('/admin-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🚀 NK Solar Tech Server Started!');
    console.log('='.repeat(50));
    console.log(`Website: http://localhost:${PORT}`);
    console.log(`Admin:   http://localhost:${PORT}/admin-login.html`);
    console.log(`Mode:    ${useSupabase ? '✓ Supabase (Images saved online)' : '⚠️  Local files (Images lost on restart)'}`);
    console.log('='.repeat(50));
    console.log('');
    
    if (!useSupabase) {
        console.log('📌 TO SAVE IMAGES FOREVER:');
        console.log('1. Go to https://supabase.com and create FREE account');
        console.log('2. Create new project');
        console.log('3. Copy .env.example to .env');
        console.log('4. Add your Supabase URL and Key to .env');
        console.log('5. Restart server (Ctrl+C, then node server.js)');
        console.log('');
    }
});
