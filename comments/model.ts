import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    type: { type: String, trim: true },
    comment: { type: String, trim: true },
    entity_id: { type: String },
    user_id: { type: String }
  },
  { timestamps: true }
);

export const comments = model("comments", schema);
