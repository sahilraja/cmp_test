import { Schema, model } from "mongoose";

const schema = new Schema({
    tag: { type: String, unique: true, trim: true },
    description: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false}
}, { timestamps: true });

export const tags = model("tags", schema);