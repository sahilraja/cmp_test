import { Schema, model } from "mongoose";
import * as mongoosepaginate from 'mongoose-paginate';

const userSchema = new Schema({
    firstName: { type: String, trim: true },
    secondName: { type: String, trim: true },
    email: {
        type: String,
        unique: true,
        trim: true,
        match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    },
    emailVerified: { type: Boolean, default: false },
    password: { type: String, trim: true },
    phone: { type: Number, max: 10, min: 10, trim: true },
    phoneVerified: { type: Boolean, default: false },
    aboutme: { type: String, trim: true },
    uploadPhoto: { type: String },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.plugin(mongoosepaginate);
export const Users = model("users", userSchema);

