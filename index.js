const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
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
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gps_tracking', 
};

const pool = mysql.createPool(dbConfig);


app.get('/api/drivers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM drivers');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/drivers', upload.fields([{ name: 'vehicle_data' }, { name: 'sim' }]), async (req, res) => {
  const { name, vehicleNumber, phone, status } = req.body;
  const vehicleDataFile = req.files['vehicle_data'] ? req.files['vehicle_data'][0].filename : null;
  const simFile = req.files['sim'] ? req.files['sim'][0].filename : null;

  try {
    const [result] = await pool.query('INSERT INTO drivers (name, vehicle_number, phone, status, ktp_url, sim_url) VALUES (?, ?, ?, ?, ?, ?)', [
      name,
      vehicleNumber,
      phone,
      status,
      vehicleDataFile,
      simFile,
    ]);
    res.status(201).json({ id: result.insertId, name, vehicleNumber, phone, status, vehicle_data: vehicleDataFile, sim: simFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.put('/api/drivers/:id', upload.fields([{ name: 'vehicle_data' }, { name: 'sim' }]), async (req, res) => {
  const { id } = req.params;
  const { name, vehicleNumber, phone, status } = req.body;
  const vehicleDataFile = req.files['vehicle_data'] ? req.files['vehicle_data'][0].filename : null;
  const simFile = req.files['sim'] ? req.files['sim'][0].filename : null;

  try {
    await pool.query('UPDATE drivers SET name = ?, vehicle_number = ?, phone = ?, status = ?, ktp_url = ?, sim_url = ? WHERE id = ?', [
      name,
      vehicleNumber,
      phone,
      status,
      vehicleDataFile,
      simFile,
      id,
    ]);
    res.json({ message: 'Driver updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/drivers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM drivers WHERE id = ?', [id]);
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

    await pool.query('UPDATE drivers SET latitude = ?, longitude = ?, last_update = ? WHERE id = ?', [
      latitude,
      longitude,
      timestamp,
      id,
    ]);
    res.json({ message: 'Driver location updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/drivers/:id/location', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT latitude, longitude, last_update FROM drivers WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
