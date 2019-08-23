import { Schema, model } from "mongoose";

const schema = new Schema({
    role: { type: String, unique: true, trim: true },
    scope: { type: String, trim: true },
    description: { type: String, trim: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const roles = model("roles", schema);