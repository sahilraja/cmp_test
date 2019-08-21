import { Schema, model } from "mongoose";
import * as mongoosepaginate from 'mongoose-paginate';
import * as bcrypt from "bcryptjs";
const SALT_WORK_FACTOR = 10;


const userSchema = new Schema({
    username: { type: String, trim: true },
    role: { type: Schema.Types.ObjectId, ref: 'role' },
    email: {
        type: String,
        trim: true,
        match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
    },
    password: { type: String, trim: true },
    phone: { type: Number, max: 10, min: 10, trim: true },
    aboutme: { type: String, trim: true },
    upload_photo: { type: String, trim: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.method("comparePassword", function (candidatePassword: any) {
    let password = this.password;
    return new Promise((resolve, reject) => {
        if (!password) {
            return reject({ message: `You haven't created password` });
        }
        bcrypt.compare(candidatePassword, password, function (err, isMatch) {
            if (err) return reject(err);
            resolve(isMatch);
        });
    });
});

userSchema.pre('save', function (next) {
    var user: any = this;
    // only hash the password if it has been modified (or is new)
    if (!user.isModified('password')) {
        return next();
    }
    // generate a salt

    bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
        if (err) return next(err);
        // hash the password using our new salt
        bcrypt.hash(user.password, salt, function (err, hash) {
            if (err) return next(err);
            // override the cleartext password with the hashed one
            user.password = hash;
            next();
        });
    });
});

userSchema.plugin(mongoosepaginate);
export const Users = model("users", userSchema);

