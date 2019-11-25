import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    content: { type: String },
    templateName: { type: String, unique: true },
    displayName: { type: String },
}, { timestamps: true }
);
schema.plugin(mongoosePaginate);
export const smsTemplateSchema = model("sms_template", schema);