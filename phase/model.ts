import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    phaseName: { type: String,unique: true},
    colorCode: { type: String}
}, { timestamps: true }
);
schema.plugin(mongoosePaginate);
export const phaseSchema = model("phase", schema);