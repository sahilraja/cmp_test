import { Schema, model } from "mongoose";
const SchemaDef = new Schema({
    userId: { type: String },
    access_token: { type: String },
    lastUsedAt: { type: Date, default: new Date() }
}, { timestamps: true })

export const RefreshTokenSchema = model('refresh_tokens', SchemaDef)