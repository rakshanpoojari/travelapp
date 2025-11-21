const express = require('express');
const router = express.Router();
const axios = require('axios');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Example: proxy to Google Directions to avoid exposing key
router.get('/directions', async (req, res) => {
  try {
    const { origin, destination, mode } = req.query; // e.g. mode=transit|driving|bicycling|walking
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode || 'driving'}&key=${GOOGLE_KEY}&alternatives=true`;
    const r = await axios.get(url);
    res.json(r.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'directions error' });
  }
});

// Save/Load favorite routes (pseudo)
const Route = require('../models/Route');
router.post('/routes', async (req,res) => {
  const doc = new Route(req.body);
  await doc.save();
  res.json(doc);
});
router.get('/routes', async (req,res) => {
  const list = await Route.find().sort({createdAt:-1}).limit(50);
  res.json(list);
});

module.exports = router;
