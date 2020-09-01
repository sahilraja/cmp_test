import { Schema, model } from "mongoose";

const schema = new Schema({
    theme: { type: String, unique: true, trim: true },
    description: { type: String, trim: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const themes: any = model("themes", schema);