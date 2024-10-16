const express = require('express');
const multer = require('multer');
const path = require('path');
// const mysql = require('mysql2/promise'); 
const { Pool } = require('pg')
const bcrypt = require('bcrypt');;

const cors = require('cors');

const app = express();
const port = 5000;


app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); 
  },
});

const upload = multer({ storage });


const dbConfig = {
  user: 'postgres',
  host: 'localhost',
  database: 'gps_tracking',
  password: '123',
  port: 5432,
}

const pool = new Pool(dbConfig);

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]); 
      const user = result.rows[0];

      if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
          return res.status(401).json({ error: 'Invalid username or password' });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM drivers');
    res.json(result.rows);  
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get drivers filtered by vehicle type
app.get('/api/drivers', async (req, res) => {
  const { jenis_kendaraan } = req.query;
  let query = 'SELECT * FROM drivers';
  const params = [];

  if (jenis_kendaraan) {
    query += ' WHERE vehicle_type = $1';
    params.push(jenis_kendaraan); 
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/drivers', upload.fields([{ name: 'ktp' }, { name: 'sim' }]), async (req, res) => {
  const { name, vehicleNumber, phone, status, vehicleType } = req.body;
  const ktpFile = req.files['ktp'] ? req.files['ktp'][0].filename : null;
  const simFile = req.files['sim'] ? req.files['sim'][0].filename : null;

  try {
    const result = await pool.query(
      'INSERT INTO drivers (name, vehicle_number, phone, status, vehicle_type, ktp_url, sim_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, vehicleNumber, phone, status, vehicleType, ktpFile, simFile]
    );
    res.status(201).json({ id: result.rows[0].id, name, vehicleNumber, phone, status, vehicle_type: vehicleType, ktp: ktpFile, sim: simFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.put('/api/drivers/:id', upload.fields([{ name: 'ktp' }, { name: 'sim' }]), async (req, res) => {
  const { id } = req.params;
  const { name, vehicleNumber, phone, status, vehicleType } = req.body;
  const ktpFile = req.files['ktp'] ? req.files['ktp'][0].filename : null;
  const simFile = req.files['sim'] ? req.files['sim'][0].filename : null;

  try {
    await pool.query(
      'UPDATE drivers SET name = $1, vehicle_number = $2, phone = $3, status = $4, ktp_url = $5, sim_url = $6, vehicle_type = $7 WHERE id = $8',
      [name, vehicleNumber, phone, status, ktpFile, simFile, vehicleType, id]
    );
    res.json({ message: 'Driver updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM drivers WHERE id = $1', [id]);
    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/drivers/:id/location', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, timestamp } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and Longitude are required' });
  }

  try {
    await pool.query('UPDATE drivers SET latitude = $1, longitude = $2, last_update = $3 WHERE id = $4', [latitude, longitude, timestamp, id]);
    res.json({ message: 'Driver location updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver location
app.get('/api/drivers/:id/location', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT latitude, longitude, last_update FROM drivers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
