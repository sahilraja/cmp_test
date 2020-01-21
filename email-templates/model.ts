import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    content: { type: String },
    templateName: { type: String, unique: true },
    displayName: { type: String },
    subject: { type: String },
    form: { type: String, default: 'html' },
    category: { type: String}
}, { timestamps: true }
);
schema.plugin(mongoosePaginate);
export const TemplateSchema = model("template", schema);