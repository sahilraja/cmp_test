import { Schema, model } from "mongoose";

const schema = new Schema({
    ctiy_code: { type: String, unique: true, trim: true },
    city_name: { type: String, trim: true },
    description: { type: String, trim: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const city_code: any = model("city_code", schema);