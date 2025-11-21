const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const RouteSchema = new Schema({
  userId: String,
  origin: String,
  destination: String,
  modeCombination: [String], // e.g. ["bus","train","walk"]
  directionsResponse: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Route', RouteSchema);
