import { Schema, model } from "mongoose";
import * as mongoosepaginate from 'mongoose-paginate';


const userSchema = new Schema({
    username: { type: String, trim: true },
    role: { type: Schema.Types.ObjectId, ref: 'role' },
    email: {
        type: String,
        trim: true,
        match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    },
    phone: { type: Number, max: 10, min: 10, trim: true },
    aboutme: { type: String, trim: true },
    password: { type: String, trim: true },
    upload_photo: { type: String, trim: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });


userSchema.plugin(mongoosepaginate);
export const Users = model("users", userSchema);

