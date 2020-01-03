import { Schema, model } from "mongoose";
import plugin from "mongoose-transform";
const uniqueValidator = require('mongoose-unique-validator');

const SchemaDef = new Schema({
    name: { type: String, trim: true, required: 'Name is required', unique: true, uniqueCaseInsensitive: true },
    createdBy: { type: String },
    disabled: { type: Boolean, default: false }
}, { timestamps: true })

SchemaDef.plugin(uniqueValidator, { message: 'Error, expected {PATH} to be unique.' });
SchemaDef.plugin(plugin)
export const PillarSchema = model('pillars', SchemaDef)