import { Schema, model, Types } from "mongoose";
const uniqueValidator = require('mongoose-unique-validator');

const schema = new Schema({
    percentage: { type: Number, trim: true, required: true },
    phase: { type: String, trim: true, unique: true, required: true, uniqueCaseInsensitive: true },
    projectId: { type: Types.ObjectId, ref: 'project' },
    createdBy: { type: String },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true })

schema.plugin(uniqueValidator, { message: 'Error, expected {PATH} to be unique.' });
export const financialSchema = model('financial_info', schema)