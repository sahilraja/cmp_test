import { Schema, model } from "mongoose";
const SchemaDef = new Schema({
    userId: { type: String },
    access_token: { type: String },
    lastUsedAt: { type: Date, default: new Date() }
}, { timestamps: true })

SchemaDef.index({userId: 1})
SchemaDef.index({access_token: 1})
SchemaDef.index({access_token: 1, userId: 1})
export const RefreshTokenSchema = model('refresh_tokens', SchemaDef)