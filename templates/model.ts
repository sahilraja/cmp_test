import {Schema,model} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    content: { type: String },
    templateName: { type: String, unique: true},
    subject: { type: String }
    },{ timestamps: true }
);
schema.plugin(mongoosePaginate);
export const TemplateSchema = model("template", schema);